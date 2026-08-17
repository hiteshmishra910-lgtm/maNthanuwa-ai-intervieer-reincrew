import { Question, QuestionType } from '../../../types';
import { DomainPack } from '../pipeline/interfaces';
import { determineVerdict } from '../../../shared/verdictPolicy';
import { compileWeightedRubric, ExpertConcept, ExpertDimension, ExpertRubric } from './WeightedRubric';
import { buildConceptGraph, analyzeConceptGraph, ConceptGraph, ConceptGraphAnalysis } from './ConceptGraph';
import { ConceptSemanticMatch, SemanticMatcher } from './SemanticMatcher';
import { SynonymRegistry, tokenizeForPhrase } from './SynonymMap';
import { embedSentences, SentenceEmbedding } from './Embeddings';
import { Stemmer } from '../pipeline/Stemmer';
import { ExpertAnalysis, ExpertConceptMatchSummary, ExpertScores } from './types';
import { parseDependencies } from './syntax';
import { analyzeGrammar } from './GrammarAnalyzer';
import { analyzeReadability } from './ReadabilityAnalyzer';
import { detectRepetition } from './RepetitionDetector';
import { detectContradictions } from './ContradictionDetector';
import { synthesizeLanguage, buildSyntaxSummary } from './language';
import { computeCoverage } from './CoverageScorer';
import { CoverageReport } from './types';
import { computeNegativeMarks } from './NegativeMarking';
import { evaluateDomainRules } from './DomainRules';
import { generateFeedback } from './FeedbackGenerator';
import { applyUnifiedScoringPolicy } from '../../../shared/evaluationScoringPolicy';

/**
 * ExpertEvaluator — deterministic orchestrator of the expert local-evaluation engine.
 *
 * Pipeline: weighted rubric -> concept graph -> phrase-map matching -> semantic matching
 * (subword embeddings) -> graph analysis -> misconception scan -> weighted score synthesis.
 *
 * Pure and offline: no network, no LLM, no model weights. Runs in well under a millisecond on
 * typical answers and returns a fully explainable result (every score is traceable to evidence).
 */

export interface ExpertEvaluateOptions {
  questionType?: QuestionType;
  domainPacks?: DomainPack[];
  matchThreshold?: number;
}

export interface MisconceptionHit {
  misconceptionId: string;
  triggerPhrase: string;
  sentenceIndex: number;
  negated: boolean;
}

export interface ExpertEvaluation {
  rubric: ExpertRubric;
  graph: ConceptGraph;
  graphAnalysis: ConceptGraphAnalysis;
  conceptMatches: ConceptSemanticMatch[];
  misconceptionHits: MisconceptionHit[];
  analysis: ExpertAnalysis;
  trace: string[];
  latencyMs: number;
}

const NEGATION_WORDS = new Set([
  'not', 'never', 'no', 'isnt', 'arent', 'dont', 'doesnt', 'wont', 'cant',
  'cannot', 'shouldnt', 'without', 'neither', 'nor',
]);

const HONEST_UNKNOWN_PATTERNS = [
  'i dont know', 'i do not know', 'not sure', 'havent learned', 'never studied',
  'dont remember', 'not familiar', 'no idea', 'cant recall', 'cannot recall',
  'havent worked with', 'no clue', 'dunno', 'idk',
];

const EXPECTED_DIMENSION_WEIGHT = 0.02;

const SCORE_WEIGHTS = {
  coverage: 0.4,
  relevance: 0.15,
  depth: 0.15,
  relationship: 0.1,
  language: 0.2,
};

export class ExpertEvaluator {
  static evaluate(params: { question: Question; answer: string; options?: ExpertEvaluateOptions }): ExpertEvaluation {
    const start = performance.now();
    const { question } = params;
    const options = params.options || {};
    const answer = (params.answer || '').trim();
    const trace: string[] = [];
    const wordCount = answer.length > 0 ? answer.split(/\s+/).filter(Boolean).length : 0;
    const isHonestUnknown = ExpertEvaluator.detectHonestUnknown(answer);

    // 1. Weighted rubric
    const rubric = compileWeightedRubric(question, {
      questionType: options.questionType,
      domainPacks: options.domainPacks,
    });
    trace.push(`Rubric compiled: ${rubric.concepts.length} concepts, ${rubric.misconceptions.length} misconception rules (${rubric.version}).`);

    // 2. Concept graph
    const graph = buildConceptGraph(rubric);
    trace.push(`Concept graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges, max depth ${graph.maxDepth}.`);

    // 3. Semantic matching
    const registry = SynonymRegistry.getInstance();
    const matcher = new SemanticMatcher(
      registry.phraseMap,
      options.matchThreshold !== undefined ? { matchThreshold: options.matchThreshold } : {},
    );
    const sentences = embedSentences(answer);

    const matchById = new Map<string, ConceptSemanticMatch>();
    for (const concept of rubric.concepts) {
      const match = matcher.matchConcept(concept, sentences);
      matchById.set(concept.id, match);
    }

    // Relationship endpoints (e.g. `arrays` in `arrays -> stacks`) are often not rubric
    // concepts, so match them separately through the shared registry to validate relations.
    for (const [endpoint, match] of ExpertEvaluator.matchRelationEndpoints(graph, matcher, sentences)) {
      if (!matchById.has(endpoint)) matchById.set(endpoint, match);
    }

    const matched = new Set(
      Array.from(matchById.entries())
        .filter(([, m]) => m.matched)
        .map(([id]) => id),
    );
    trace.push(`Semantic matching: ${matched.size}/${rubric.concepts.length} concepts matched.`);

    // 4. Graph analysis
    const graphAnalysis = analyzeConceptGraph(graph, matched);

    // 5. Misconception scan
    const misconceptionHits = ExpertEvaluator.scanMisconceptions(rubric, sentences);
    const activeMisconceptionHits = misconceptionHits.filter(h => !h.negated);
    trace.push(`Misconception scan: ${activeMisconceptionHits.length} active hits (${misconceptionHits.length - activeMisconceptionHits.length} negated).`);

    // 6. Language layer — syntax / grammar / readability / repetition / contradiction.
    const parsedSentences = parseDependencies(sentences);
    const grammar = analyzeGrammar(parsedSentences);
    const readability = analyzeReadability(sentences);
    const repetition = detectRepetition(sentences);
    const contradictionReport = detectContradictions(sentences, parsedSentences, matched);
    const language = synthesizeLanguage(
      grammar,
      readability,
      repetition,
      contradictionReport,
      parsedSentences.length,
    );
    const syntax = buildSyntaxSummary(parsedSentences);
    trace.push(
      `Language layer: grammar=${grammar.score.toFixed(1)} readability=${readability.score.toFixed(1)} ` +
      `repetition=${repetition.score.toFixed(1)} contradictions=${contradictionReport.score.toFixed(1)} ` +
      `(${grammar.issues.length} grammar issues, ${contradictionReport.contradictions.length} contradictions).`,
    );

    // 7. Coverage scoring — tiered + dimension + relationship breakdown.
    const summaries = ExpertEvaluator.summarize(rubric, matchById);
    const coverage = computeCoverage(summaries, rubric, graph, graphAnalysis);
    const criticalRatio = coverage.tiers.find(t => t.tier === 'critical')?.ratio ?? 0;
    trace.push(
      `Coverage: overall=${coverage.overall.toFixed(1)} critical=${criticalRatio.toFixed(2)} ` +
      `dimensions=${coverage.dimensionCoverage.toFixed(1)} relationships=${coverage.relationshipCoverage.toFixed(1)}.`,
    );

    // 8. Domain rules — topic-specific expectations contributed by domain packs.
    const domainRuleResults = evaluateDomainRules(rubric.domainRules, sentences);
    const domainRuleFailures = domainRuleResults.filter(r => r.triggered && !r.passed);
    if (rubric.domainRules.length > 0) {
      const passed = domainRuleResults.filter(r => r.passed).length;
      trace.push(`Domain rules: ${passed}/${domainRuleResults.length} passed (${domainRuleFailures.length} failed).`);
    }

    // 9. Negative marking — every deduction in one explainable list.
    const negativeMarking = computeNegativeMarks({
      misconceptionHits,
      rubric,
      contradictions: contradictionReport.contradictions,
      domainRuleFailures,
    });
    trace.push(
      `Negative marking: ${negativeMarking.negativeMarks.length} marks, penalty=${negativeMarking.penalty.toFixed(1)} ` +
      `(${negativeMarking.negativeMarks.filter(m => m.source === 'misconception').length} misconception, ` +
      `${negativeMarking.negativeMarks.filter(m => m.source === 'contradiction').length} contradiction, ` +
      `${negativeMarking.negativeMarks.filter(m => m.source === 'domain_rule').length} domain rule).`,
    );

    // 10. Score synthesis
    let relevanceTotal = 0;
    let relevanceCount = 0;
    for (const summary of summaries) {
      if (!summary.matched) continue;
      relevanceTotal += summary.confidence;
      relevanceCount++;
    }
    const semanticRelevance = relevanceCount > 0 ? (relevanceTotal / relevanceCount) * 10 : 0;
    const depth = graphAnalysis.depthRatio * 10;
    const relatesEdges = graph.edges.filter(e => e.kind === 'relates').length;
    const relationship = relatesEdges > 0 ? (graphAnalysis.validRelations.length / relatesEdges) * 10 : 10;

    const positiveScore =
      coverage.overall * SCORE_WEIGHTS.coverage +
      semanticRelevance * SCORE_WEIGHTS.relevance +
      depth * SCORE_WEIGHTS.depth +
      relationship * SCORE_WEIGHTS.relationship +
      language.score * SCORE_WEIGHTS.language;

    // Detect behavioral questions for substance analysis
    const questionTextLower = (question.question || '').toLowerCase();
    const isBehavioral = /tell me about|describe a time|describe a situation|have you ever|experience|background|strength|weakness|introduce/i.test(questionTextLower) ||
      (options.questionType === 'HR' || options.questionType === 'Scenario');

    const scores = ExpertEvaluator.computeScores({
      coverage,
      semanticRelevance,
      depth,
      relationship,
      languageScore: language.score,
      negativePenalty: negativeMarking.penalty,
      misconceptionPenalty: negativeMarking.misconceptionPenalty,
      positiveScore,
      wordCount,
      isHonestUnknown,
      answer,
      evidenceCount: matched.size,
      isBehavioral,
    });

    // 11. Feedback generation — strengths / weaknesses / missing concepts.
    const feedback = generateFeedback({
      rubric,
      coverage,
      summaries,
      validRelations: graphAnalysis.validRelations,
      negativeMarks: negativeMarking.negativeMarks,
      language,
      positiveScore,
      negativePenalty: negativeMarking.penalty,
      finalScore: scores.weightedTotal,
    });
    trace.push(
      `Feedback: ${feedback.strengths.length} strengths, ${feedback.weaknesses.length} weaknesses, ` +
      `${feedback.missingConcepts.length} missing concepts.`,
    );

    const analysis: ExpertAnalysis = {
      engine: 'expert-local-v1',
      rubricVersion: rubric.version,
      questionType: rubric.questionType,
      graph: {
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
        maxDepth: graph.maxDepth,
        reachedDepth: graphAnalysis.reachedDepth,
        weightedCoverage: graphAnalysis.weightedCoverage,
      },
      concepts: summaries,
      misconceptionHits: activeMisconceptionHits.map(h => h.triggerPhrase),
      scores,
      verdict: isHonestUnknown || wordCount === 0 ? 'Fail' : determineVerdict(scores.weightedTotal),
      syntax,
      language,
      coverage,
      negativeMarks: negativeMarking.negativeMarks,
      domainRules: domainRuleResults,
      feedback,
    };

    trace.push(`Scores: coverage=${scores.conceptCoverage.toFixed(1)} relevance=${scores.semanticRelevance.toFixed(1)} depth=${scores.depth.toFixed(1)} relationship=${scores.relationship.toFixed(1)} language=${scores.language.toFixed(1)} negative=${scores.negativePenalty.toFixed(1)} total=${scores.weightedTotal.toFixed(1)}.`);
    if (isHonestUnknown) trace.push('Honest unknown detected: all scores forced to 0.');

    const latencyMs = Math.round(performance.now() - start);
    trace.push(`ExpertEvaluator completed in ${latencyMs}ms.`);

    return {
      rubric,
      graph,
      graphAnalysis,
      conceptMatches: Array.from(matchById.values()),
      misconceptionHits,
      analysis,
      trace,
      latencyMs,
    };
  }

  static detectHonestUnknown(answer: string): boolean {
    if (!answer) return true;
    const normalized = answer.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ');
    const isShort = words.length < 15;
    return isShort && HONEST_UNKNOWN_PATTERNS.some(pat => normalized.includes(pat));
  }

  /**
   * Match the source/target concepts referenced by relationship edges. Endpoints are resolved
   * through the shared registry (CONCEPT_REGISTRY + domain packs + curated phrases) even when
   * they are not rubric concepts, so a relation counts as evidenced only when both endpoints
   * actually appear in the answer.
   */
  private static matchRelationEndpoints(
    graph: ConceptGraph,
    matcher: SemanticMatcher,
    sentences: SentenceEmbedding[],
  ): Map<string, ConceptSemanticMatch> {
    const matches = new Map<string, ConceptSemanticMatch>();
    const seen = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.kind !== 'relates') continue;
      for (const endpoint of [edge.from, edge.to]) {
        if (seen.has(endpoint)) continue;
        seen.add(endpoint);
        const stub: ExpertConcept = {
          id: endpoint,
          label: endpoint.replace(/_/g, ' '),
          aliases: [],
          importance: 'supporting',
          weight: 0,
          prerequisites: [],
          relatesTo: [],
          dimensions: {
            definition: 0.32,
            mechanism: 0.24,
            purpose: 0.14,
            useCase: 0.1,
            limitations: 0.07,
            tradeoffs: 0.06,
            alternatives: 0.03,
            failureCases: 0.02,
            dependencies: 0.02,
          },
        };
        matches.set(endpoint, matcher.matchConcept(stub, sentences));
      }
    }
    return matches;
  }

  private static summarize(
    rubric: ExpertRubric,
    matchById: Map<string, ConceptSemanticMatch>,
  ): ExpertConceptMatchSummary[] {
    return rubric.concepts.map(concept => {
      const match = matchById.get(concept.id);
      const expected = ExpertEvaluator.expectedDimensions(concept.dimensions);
      const satisfied = match?.matched ? (match.satisfiedDimensions || []) : [];
      const satisfiedSet = new Set(satisfied);

      return {
        conceptId: concept.id,
        label: concept.label,
        weight: concept.weight,
        importance: concept.importance,
        matched: Boolean(match?.matched),
        confidence: match?.confidence || 0,
        similarityScore: match?.similarityScore || 0,
        matchKind: match?.matchKind || 'none',
        bestSentenceIndex: match?.bestSentenceIndex ?? -1,
        matchedPhrases: match?.matchedPhrases || [],
        satisfiedDimensions: satisfied,
        missingDimensions: expected.filter(d => !satisfiedSet.has(d)),
      };
    });
  }

  private static expectedDimensions(dimensions: ExpertRubric['concepts'][number]['dimensions']): ExpertDimension[] {
    return Object.keys(dimensions)
      .filter(d => dimensions[d as ExpertDimension] > EXPECTED_DIMENSION_WEIGHT)
      .map(d => d as ExpertDimension);
  }

  private static computeScores(args: {
    coverage: CoverageReport;
    semanticRelevance: number;
    depth: number;
    relationship: number;
    languageScore: number;
    negativePenalty: number;
    misconceptionPenalty: number;
    positiveScore: number;
    wordCount: number;
    isHonestUnknown: boolean;
    answer: string;
    evidenceCount: number;
    isBehavioral: boolean;
  }): ExpertScores {
    let weightedTotal = args.positiveScore - args.negativePenalty;

    if (args.isHonestUnknown) {
      weightedTotal = 0;
    }

    // Apply the unified scoring policy as a non-destructive ceiling.
    // This ensures Expert mode uses the same length/substance gates as Local and API modes.
    const rawScores: import('../../../shared/evaluationScoringPolicy').ScoreDimensions = {
      technicalAccuracy: Math.max(0, Math.min(10, weightedTotal)),
      conceptUnderstanding: round1(args.coverage.overall),
      reasoning: round1(args.depth),
      communication: round1(args.languageScore),
      confidence: round1(args.semanticRelevance),
    };

    const policyResult = applyUnifiedScoringPolicy(
      rawScores,
      args.answer,
      args.evidenceCount,
      args.isBehavioral,
      rawScores.technicalAccuracy,
    );

    // The policy-adjusted weightedTotal is the final ceiling
    weightedTotal = policyResult.scores.technicalAccuracy;

    return {
      conceptCoverage: round1(args.coverage.overall),
      semanticRelevance: round1(args.semanticRelevance),
      depth: round1(args.depth),
      relationship: round1(args.relationship),
      misconceptionPenalty: round1(args.misconceptionPenalty),
      language: round1(args.languageScore),
      negativePenalty: round1(args.negativePenalty),
      weightedTotal: round1(Math.max(0, Math.min(10, weightedTotal))),
    };
  }

  private static scanMisconceptions(rubric: ExpertRubric, sentences: { text: string }[]): MisconceptionHit[] {
    const hits: MisconceptionHit[] = [];
    for (const misconception of rubric.misconceptions) {
      for (const phrase of misconception.triggerPhrases) {
        const phraseTokens = tokenizeForPhrase(phrase).map(t => Stemmer.stem(t));
        if (phraseTokens.length === 0) continue;

        for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
          const sentenceTokens = tokenizeForPhrase(sentences[sIdx].text).map(t => Stemmer.stem(t));
          const position = ExpertEvaluator.indexOfSequence(sentenceTokens, phraseTokens);
          if (position === -1) continue;

          hits.push({
            misconceptionId: misconception.id,
            triggerPhrase: phrase,
            sentenceIndex: sIdx,
            negated: ExpertEvaluator.isNegated(sentenceTokens, position),
          });
          break; // one hit per misconception-rule pair is enough
        }
      }
    }
    return hits;
  }

  private static indexOfSequence(tokens: string[], sequence: string[]): number {
    outer:
    for (let i = 0; i <= tokens.length - sequence.length; i++) {
      for (let j = 0; j < sequence.length; j++) {
        if (tokens[i + j] !== sequence[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  private static isNegated(stemmedTokens: string[], phraseStart: number): boolean {
    const from = Math.max(0, phraseStart - 3);
    for (let i = from; i < phraseStart; i++) {
      if (NEGATION_WORDS.has(stemmedTokens[i])) return true;
    }
    return false;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
