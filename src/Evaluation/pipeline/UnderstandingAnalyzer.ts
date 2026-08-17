import { PipelineContext, EvaluationModule, EVALUATION_PROFILES_REGISTRY } from './interfaces';
import { CONCEPT_REGISTRY } from './ConceptRegistry';
import { Normalizer } from './Normalizer';
import { Tokenizer } from './Tokenizer';
import { Stemmer } from './Stemmer';

/**
 * Pronouns that signal anaphoric reference to a concept explained in the previous sentence.
 * e.g. "A stack is LIFO. It works by pushing elements onto the top." — "it" refers to "stack".
 */
const ANAPHORIC_PRONOUNS = new Set([
  'it', 'its', 'they', 'their', 'them', 'this', 'these', 'that', 'those', 'such'
]);

export class UnderstandingAnalyzer implements EvaluationModule {
  readonly name = 'UnderstandingAnalyzer';

  /**
   * Dimension triggers — what kinds of language signal each explanation dimension.
   * Values are raw English phrases; they are stemmed at runtime once.
   */
  private static readonly dimensionTriggers: Record<string, string[]> = {
    definition:   ['is a', 'refer to', 'defined as', 'means', 'stand for', 'is an', 'is called', 'known as'],
    mechanism:    ['how it works', 'internally', 'by using', 'process', 'execute', 'runs', 'mechanism',
                   'works by', 'operates', 'step by step', 'under the hood', 'implemented'],
    purpose:      ['purpose', 'why we use', 'intended to', 'allows us to', 'goal is', 'so that',
                   'prevents', 'ensures', 'helps', 'benefit', 'advantage', 'used to', 'useful for'],
    useCase:      ['use case', 'practical', 'scenario', 'example', 'industry', 'production',
                   'application', 'real world', 'for instance', 'such as', 'like when'],
    limitations:  ['drawback', 'limitation', 'downside', 'shortcoming', 'weakness', 'disadvantage',
                   'not suitable', 'cannot', 'problem with'],
    tradeoffs:    ['trade-off', 'tradeoff', 'compromise', 'exchange for', 'balance', 'versus', 'vs'],
    alternatives: ['alternative', 'instead of', 'rather than', 'replace', 'prefer', 'compared to'],
    failureCases: ['fail', 'error', 'broken', 'crash', 'overflow', 'underflow', 'bug', 'exception'],
    dependencies: ['depends on', 'requires', 'needs', 'prerequisite', 'relies on', 'built on top of']
  };

  private static _stemmedTriggers: Record<string, string[]> | null = null;

  /** Stem all trigger phrases once and cache them. */
  private static getStemmedTriggers(): Record<string, string[]> {
    if (UnderstandingAnalyzer._stemmedTriggers) return UnderstandingAnalyzer._stemmedTriggers;
    const result: Record<string, string[]> = {};
    for (const [dim, phrases] of Object.entries(UnderstandingAnalyzer.dimensionTriggers)) {
      result[dim] = phrases.map(p =>
        Tokenizer.tokenize(Normalizer.normalize(p)).map(t => Stemmer.stem(t)).join(' ')
      );
    }
    UnderstandingAnalyzer._stemmedTriggers = result;
    return result;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Word-boundary match: checks that `pattern` appears as a whole word/phrase
   * in `text`, not as a substring of a larger token.
   * e.g. "oop" must NOT match inside "loops".
   */
  private static matchesWordBoundary(text: string, pattern: string): boolean {
    if (!pattern) return false;
    const escaped = UnderstandingAnalyzer.escapeRegex(pattern);
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(text);
  }

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting UnderstandingAnalyzer (Phase 2: word-boundary + anaphora resolution)...');

    if (context.matchedConcepts.size === 0) {
      context.developerTrace.push('UnderstandingAnalyzer: No matched concepts, skipping.');
      context.detectorConfidences['understandingAnalyzer'] = 90;
      return;
    }

    const stemmedTriggers = UnderstandingAnalyzer.getStemmedTriggers();

    // ── Pre-compute stemmed aliases for every matched concept ──────────────────
    const conceptAliasMap = new Map<string, string[]>();
    context.matchedConcepts.forEach(conceptId => {
      const entry = CONCEPT_REGISTRY[conceptId];
      if (!entry) return;
      const rawAliases = [entry.concept, ...(entry.aliases || [])];
      const stemmed = rawAliases
        .map(a => Tokenizer.tokenize(Normalizer.normalize(a)).map(t => Stemmer.stem(t)).join(' '))
        .filter(Boolean);
      conceptAliasMap.set(conceptId, stemmed);
    });

    // ── Determine expected dimensions for each concept ─────────────────────────
    // We pull from the question's knowledgeModel first, then fall back to the
    // evaluation profile for the question type, then to a sensible default.
    const profile = EVALUATION_PROFILES_REGISTRY[context.questionType];
    const profileDims: string[] = profile?.requiredDimensions ?? ['definition', 'mechanism'];

    const conceptExpectedDimsMap = new Map<string, string[]>();
    context.matchedConcepts.forEach(conceptId => {
      if (context.question.knowledgeModel) {
        const modelConcept = context.question.knowledgeModel.find(c => c.conceptId === conceptId);
        if (modelConcept) {
          const dims = Object.entries(modelConcept.expected)
            .filter(([, isExpected]) => isExpected)
            .map(([dim]) => dim);
          conceptExpectedDimsMap.set(conceptId, dims);
          return;
        }
      }
      conceptExpectedDimsMap.set(conceptId, profileDims);
    });

    // ── Sentence-first pass: collect satisfied dimensions per concept ──────────
    // This ordering allows us to do anaphora resolution (pronoun tracking).
    const satisfiedMap = new Map<string, Set<string>>();
    context.matchedConcepts.forEach(conceptId => satisfiedMap.set(conceptId, new Set()));

    let prevActiveConceptIds = new Set<string>();

    for (const sentenceTokens of context.sentences) {
      const sentenceStr = sentenceTokens.join(' ');
      if (!sentenceStr.trim()) continue;

      const firstToken = sentenceTokens[0] ?? '';
      const isAnaphoric = ANAPHORIC_PRONOUNS.has(firstToken);

      // ── Determine active concepts for this sentence ──────────────────────────
      const currentActiveConceptIds = new Set<string>();

      context.matchedConcepts.forEach(conceptId => {
        const stemmedAliases = conceptAliasMap.get(conceptId) ?? [];

        // Direct match: the concept (or one of its aliases) appears as a whole word/phrase
        const isDirectMatch = stemmedAliases.some(alias =>
          UnderstandingAnalyzer.matchesWordBoundary(sentenceStr, alias)
        );

        // Anaphoric match: sentence starts with a pronoun AND this concept was
        // active in the immediately preceding sentence.
        const isAnaphoricMatch = isAnaphoric && prevActiveConceptIds.has(conceptId);

        if (isDirectMatch || isAnaphoricMatch) {
          currentActiveConceptIds.add(conceptId);
          if (isAnaphoricMatch && !isDirectMatch) {
            context.developerTrace.push(`[Anaphora] Concept [${conceptId}] carried into sentence via pronoun "${firstToken}".`);
          }
        }
      });

      // ── Check dimension triggers for all active concepts ─────────────────────
      currentActiveConceptIds.forEach(conceptId => {
        const satisfied = satisfiedMap.get(conceptId)!;
        for (const [dim, triggers] of Object.entries(stemmedTriggers)) {
          if (!satisfied.has(dim)) {
            const hasTrigger = triggers.some(trigger => sentenceStr.includes(trigger));
            if (hasTrigger) {
              satisfied.add(dim);
            }
          }
        }
      });

      prevActiveConceptIds = currentActiveConceptIds;
    }

    // ── Update conceptCompleteness in the pipeline context ────────────────────
    context.matchedConcepts.forEach(conceptId => {
      const existingComp = context.conceptCompleteness.get(conceptId);
      const existingSatisfied = existingComp ? existingComp.satisfiedDimensions : [];
      const satisfiedSet = new Set([...existingSatisfied, ...(satisfiedMap.get(conceptId) ?? [])]);
      const satisfied = Array.from(satisfiedSet);
      const expectedDims = conceptExpectedDimsMap.get(conceptId) ?? ['definition', 'mechanism'];

      const satisfiedExpected = satisfied.filter(d => expectedDims.includes(d));
      const ratio = expectedDims.length > 0 ? satisfiedExpected.length / expectedDims.length : 1.0;

      context.conceptCompleteness.set(conceptId, {
        satisfiedDimensions: satisfied,
        completenessRatio: ratio
      });

      context.developerTrace.push(
        `Concept [${conceptId}] completeness: ${Math.round(ratio * 100)}% ` +
        `(Satisfied: [${satisfiedExpected.join(', ')}] / Expected: [${expectedDims.join(', ')}])`
      );
    });

    context.detectorConfidences['understandingAnalyzer'] = 90;
    context.developerTrace.push('UnderstandingAnalyzer (Phase 2) completed.');
  }
}
