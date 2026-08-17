import { describe, it, expect, beforeEach } from 'vitest';
import { Question } from '../types';
import { DomainPack, DomainRule } from '../src/Evaluation/pipeline/interfaces';
import { computeCoverage } from '../src/Evaluation/expert/CoverageScorer';
import { evaluateDomainRules } from '../src/Evaluation/expert/DomainRules';
import { computeNegativeMarks, MISCONCEPTION_PENALTY_CAP, NEGATIVE_PENALTY_CAP } from '../src/Evaluation/expert/NegativeMarking';
import { generateFeedback, FeedbackInput } from '../src/Evaluation/expert/FeedbackGenerator';
import { ExpertEvaluator } from '../src/Evaluation/expert/ExpertEvaluator';
import { compileWeightedRubric, clearWeightedRubricCache, ExpertRubric, ExpertDimensionWeights, ExpertImportance } from '../src/Evaluation/expert/WeightedRubric';
import { embedSentences } from '../src/Evaluation/expert/Embeddings';
import { ConceptGraph, ConceptGraphAnalysis } from '../src/Evaluation/expert/ConceptGraph';
import { Contradiction, ExpertConceptMatchSummary, CoverageReport, ExpertLanguageAnalysis, NegativeMark } from '../src/Evaluation/expert/types';

const stackQuestion: Question = {
  id: 'expert_coverage_stack_q',
  question: 'Explain Stacks in detail and why we use them.',
  questionType: 'Definition',
  evaluationGuide: ['LIFO pattern', 'Push and Pop operations'],
  knowledgeModel: [
    {
      conceptId: 'stacks',
      expected: { definition: true, mechanism: true, purpose: true, useCase: true, limitations: true },
      relationships: ['arrays -> stacks', 'linked_lists -> stacks'],
      commonMistakes: ['FIFO', 'First In First Out'],
    },
  ],
};

const DETAILED_ANSWER =
  'A stack is a data structure based on LIFO, meaning Last In First Out. ' +
  'Internally it works by pushing elements onto the stack and popping them off. ' +
  'We implement it using arrays or linked lists, which allows us to keep track of call stacks or undo histories.';

const dbQuestion: Question = {
  id: 'expert_coverage_db_q',
  question: 'Explain database transactions.',
  questionType: 'Definition',
  evaluationGuide: ['Atomicity', 'Commit and rollback'],
  knowledgeModel: [
    { conceptId: 'transactions', expected: { definition: true, mechanism: true, purpose: true, useCase: true, limitations: true } },
  ],
};

const dbPack: DomainPack = {
  domain: 'databases',
  version: '1.0.0',
  concepts: [],
  misconceptions: [
    { id: 'acid_optional', keywords: ['acid is optional'], severity: 'moderate', explanation: 'ACID is not optional in production systems.' },
  ],
  rules: [
    {
      id: 'db_txn_commit',
      description: 'Discussed transactions but did not mention commit, rollback or isolation.',
      triggerPhrases: ['transaction', 'transactions', 'acid'],
      expectedPhrases: ['commit', 'rollback', 'isolation'],
      severity: 'medium',
      penalty: 1.0,
    },
  ],
};

function dims(overrides: Partial<ExpertDimensionWeights>): ExpertDimensionWeights {
  return {
    definition: 0, mechanism: 0, purpose: 0, useCase: 0, limitations: 0,
    tradeoffs: 0, alternatives: 0, failureCases: 0, dependencies: 0,
    ...overrides,
  };
}

function summary(conceptId: string, opts: {
  matched: boolean;
  weight: number;
  importance: ExpertImportance;
  satisfied: string[];
  missing: string[];
}): ExpertConceptMatchSummary {
  return {
    conceptId,
    label: conceptId,
    weight: opts.weight,
    importance: opts.importance,
    matched: opts.matched,
    confidence: opts.matched ? 0.9 : 0,
    similarityScore: opts.matched ? 0.85 : 0,
    matchKind: opts.matched ? 'lexical' : 'none',
    bestSentenceIndex: opts.matched ? 0 : -1,
    matchedPhrases: opts.matched ? [conceptId] : [],
    satisfiedDimensions: opts.satisfied as ExpertConceptMatchSummary['satisfiedDimensions'],
    missingDimensions: opts.missing as ExpertConceptMatchSummary['missingDimensions'],
  };
}

function makeGraph(concepts: ExpertRubric['concepts'], relatesEdges: number): ConceptGraph {
  const nodes = new Map(concepts.map(c => [c.id, c]));
  const edges = [];
  for (let i = 0; i < relatesEdges; i++) {
    const a = concepts[i % concepts.length];
    const b = concepts[(i + 1) % concepts.length];
    edges.push({ from: a.id, to: b.id, relation: `${a.id} -> ${b.id}`, weight: 0.5, kind: 'relates' as const });
  }
  const totalWeight = concepts.reduce((s, c) => s + c.weight, 0);
  return {
    nodes,
    edges,
    adjacency: new Map(),
    prerequisites: new Map(),
    roots: concepts.map(c => c.id),
    maxDepth: 1,
    totalWeight,
  };
}

function baseAnalysis(validRelations: string[]): ConceptGraphAnalysis {
  return {
    weightedCoverage: 0,
    reachedDepth: 1,
    maxDepth: 1,
    missedPrerequisites: [],
    validRelations,
    missedRelations: [],
    depthRatio: 1,
  };
}

describe('computeCoverage', () => {
  it('computes dimension-adjusted weighted coverage with tier + dimension breakdowns', () => {
    const c1 = { id: 'c1', label: 'c1', aliases: [], importance: 'critical' as const, weight: 0.6, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 0.4, mechanism: 0.6 }) };
    const c2 = { id: 'c2', label: 'c2', aliases: [], importance: 'important' as const, weight: 0.4, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 1 }) };
    const rubric: ExpertRubric = {
      version: 'test', questionId: 'q', questionText: '', questionType: 'Technical',
      concepts: [c1, c2], misconceptions: [], expectedExamples: [], expectedTradeoffs: [],
      domains: [], domainRules: [],
    };
    const graph = makeGraph([c1, c2], 1);
    const summaries = [
      summary('c1', { matched: true, weight: 0.6, importance: 'critical', satisfied: ['definition'], missing: ['mechanism'] }),
      summary('c2', { matched: false, weight: 0.4, importance: 'important', satisfied: [], missing: ['definition'] }),
    ];

    const coverage = computeCoverage(summaries, rubric, graph, baseAnalysis([]));

    expect(coverage.overall).toBe(2.4);
    expect(coverage.ratio).toBeCloseTo(0.24, 3);
    expect(coverage.coveredWeight).toBeCloseTo(0.24, 3);
    expect(coverage.totalWeight).toBe(1);
    expect(coverage.dimensionCoverage).toBe(4);
    expect(coverage.relationshipCoverage).toBe(0);

    const critical = coverage.tiers.find(t => t.tier === 'critical')!;
    const important = coverage.tiers.find(t => t.tier === 'important')!;
    expect(critical).toMatchObject({ expectedConcepts: 1, matchedConcepts: 1, ratio: 1 });
    expect(important).toMatchObject({ expectedConcepts: 1, matchedConcepts: 0, ratio: 0 });
    expect(coverage.tiers).toHaveLength(4);
  });

  it('scores relationship coverage from evidenced relates edges', () => {
    const c1 = { id: 'c1', label: 'c1', aliases: [], importance: 'critical' as const, weight: 0.5, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 1 }) };
    const c2 = { id: 'c2', label: 'c2', aliases: [], importance: 'critical' as const, weight: 0.5, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 1 }) };
    const rubric: ExpertRubric = {
      version: 'test', questionId: 'q', questionText: '', questionType: 'Technical',
      concepts: [c1, c2], misconceptions: [], expectedExamples: [], expectedTradeoffs: [],
      domains: [], domainRules: [],
    };
    const graph = makeGraph([c1, c2], 1);
    const summaries = [
      summary('c1', { matched: true, weight: 0.5, importance: 'critical', satisfied: ['definition'], missing: [] }),
      summary('c2', { matched: true, weight: 0.5, importance: 'critical', satisfied: ['definition'], missing: [] }),
    ];

    const coverage = computeCoverage(summaries, rubric, graph, baseAnalysis(['c1 -> c2']));

    expect(coverage.relationshipCoverage).toBe(10);
    expect(coverage.overall).toBe(10);
  });

  it('defaults relationship coverage to 10 when there are no relates edges', () => {
    const c1 = { id: 'c1', label: 'c1', aliases: [], importance: 'critical' as const, weight: 1, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 1 }) };
    const rubric: ExpertRubric = {
      version: 'test', questionId: 'q', questionText: '', questionType: 'Technical',
      concepts: [c1], misconceptions: [], expectedExamples: [], expectedTradeoffs: [],
      domains: [], domainRules: [],
    };
    const graph = makeGraph([c1], 0);
    const summaries = [summary('c1', { matched: true, weight: 1, importance: 'critical', satisfied: ['definition'], missing: [] })];

    const coverage = computeCoverage(summaries, rubric, graph, baseAnalysis([]));
    expect(coverage.relationshipCoverage).toBe(10);
  });
});

describe('evaluateDomainRules', () => {
  const rules: DomainRule[] = [
    {
      id: 'db_txn_commit', domain: 'databases', description: 'Discussed transactions but not commit/rollback.',
      triggerPhrases: ['transaction', 'transactions', 'acid'], expectedPhrases: ['commit', 'rollback'],
      severity: 'medium', penalty: 1.0,
    },
  ];

  it('passes when triggered and an expected phrase is present', () => {
    const results = evaluateDomainRules(rules, embedSentences('ACID transactions must commit or roll back as a unit.'));
    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(true);
    expect(results[0].passed).toBe(true);
    expect(results[0].matchedTriggers).toEqual(expect.arrayContaining(['transactions', 'acid']));
  });

  it('fails when triggered but no expected phrase appears, listing the missing phrases', () => {
    const results = evaluateDomainRules(rules, embedSentences('We discussed transactions today.'));
    expect(results[0].triggered).toBe(true);
    expect(results[0].passed).toBe(false);
    expect(results[0].missingPhrases).toEqual(expect.arrayContaining(['commit', 'rollback']));
  });

  it('is inert when no trigger phrase appears', () => {
    const results = evaluateDomainRules(rules, embedSentences('Commit and rollback guarantee consistency.'));
    expect(results[0].triggered).toBe(false);
    expect(results[0].passed).toBe(true);
    expect(results[0].matchedTriggers).toHaveLength(0);
  });

  it('is whole-word and hyphen-tolerant', () => {
    const rules2: DomainRule[] = [
      { id: 'idx', domain: 'db', description: 'd', triggerPhrases: ['b-tree'], expectedPhrases: ['binary search'], severity: 'low', penalty: 0.5 },
    ];
    const hit = evaluateDomainRules(rules2, embedSentences('We use a B-Tree for lookups.'));
    expect(hit[0].triggered).toBe(true);
    expect(hit[0].passed).toBe(false);

    const notHit = evaluateDomainRules(rules2, embedSentences('Indexing is unrelated.'));
    expect(notHit[0].triggered).toBe(false);
  });
});

describe('computeNegativeMarks', () => {
  const rubric: ExpertRubric = {
    version: 'test', questionId: 'q', questionText: '', questionType: 'Technical',
    concepts: [],
    misconceptions: [
      { id: 'm1', triggerPhrases: ['x'], severity: 'critical', explanation: 'Bad x.', penalty: 1.5 },
      { id: 'm2', triggerPhrases: ['y'], severity: 'moderate', explanation: 'Bad y.', penalty: 1.5 },
      { id: 'm3', triggerPhrases: ['z'], severity: 'minor', explanation: 'Bad z.', penalty: 0.5 },
    ],
    expectedExamples: [], expectedTradeoffs: [], domains: [], domainRules: [],
  };

  const domainFailures = [
    { ruleId: 'db_txn_commit', domain: 'databases', description: 'No commit.', triggered: true, passed: false, matchedTriggers: ['transaction'], missingPhrases: ['commit'], severity: 'high' as const, penalty: 2.0 },
  ];

  it('caps misconception-only penalties at the legacy cap', () => {
    const r = computeNegativeMarks({
      misconceptionHits: [
        { misconceptionId: 'm1', triggerPhrase: 'x', negated: false },
        { misconceptionId: 'm2', triggerPhrase: 'y', negated: false },
        { misconceptionId: 'm3', triggerPhrase: 'z', negated: false },
      ],
      rubric, contradictions: [], domainRuleFailures: [],
    });
    expect(r.misconceptionPenalty).toBe(MISCONCEPTION_PENALTY_CAP);
    expect(r.rawPenalty).toBe(3.5);
    expect(r.negativeMarks).toHaveLength(3);
  });

  it('skips negated misconception hits entirely', () => {
    const r = computeNegativeMarks({
      misconceptionHits: [{ misconceptionId: 'm1', triggerPhrase: 'x', negated: true }],
      rubric, contradictions: [], domainRuleFailures: [],
    });
    expect(r.negativeMarks).toHaveLength(0);
    expect(r.penalty).toBe(0);
    expect(r.misconceptionPenalty).toBe(0);
  });

  it('maps contradiction severity to documented penalties', () => {
    const contradictions: Contradiction[] = [
      { ruleId: 'a', sentenceA: 0, sentenceB: 1, explanation: 'A', severity: 'high' },
      { ruleId: 'b', sentenceA: 2, sentenceB: 3, explanation: 'B', severity: 'low' },
    ];
    const r = computeNegativeMarks({ misconceptionHits: [], rubric, contradictions, domainRuleFailures: [] });
    expect(r.negativeMarks.map(m => m.penalty)).toEqual([2.0, 0.5]);
    expect(r.penalty).toBe(2.5);
  });

  it('caps the combined penalty across all sources at the negative cap', () => {
    const r = computeNegativeMarks({
      misconceptionHits: [{ misconceptionId: 'm1', triggerPhrase: 'x', negated: false }],
      rubric,
      contradictions: [
        { ruleId: 'a', sentenceA: 0, sentenceB: 1, explanation: '', severity: 'high' },
        { ruleId: 'b', sentenceA: 0, sentenceB: 1, explanation: '', severity: 'high' },
        { ruleId: 'c', sentenceA: 0, sentenceB: 1, explanation: '', severity: 'high' },
      ],
      domainRuleFailures: domainFailures,
    });
    expect(r.penalty).toBe(NEGATIVE_PENALTY_CAP);
    expect(r.misconceptionPenalty).toBe(1.5);
    expect(r.rawPenalty).toBe(9.5);
  });

  it('emits a domain_rule mark with the rule penalty', () => {
    const r = computeNegativeMarks({ misconceptionHits: [], rubric, contradictions: [], domainRuleFailures: domainFailures });
    expect(r.negativeMarks).toHaveLength(1);
    expect(r.negativeMarks[0]).toMatchObject({ source: 'domain_rule', penalty: 2.0, severity: 'high' });
  });

  it('falls back to a 1.0 penalty for unknown misconception ids', () => {
    const r = computeNegativeMarks({ misconceptionHits: [{ misconceptionId: 'missing', triggerPhrase: 'q', negated: false }], rubric, contradictions: [], domainRuleFailures: [] });
    expect(r.negativeMarks[0].penalty).toBe(1.0);
  });
});

describe('generateFeedback', () => {
  function baseInput(overrides: Partial<FeedbackInput>): FeedbackInput {
    const concepts: ExpertRubric['concepts'] = [
      { id: 'a', label: 'A', aliases: [], importance: 'critical', weight: 0.5, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 0.4, mechanism: 0.6 }) },
      { id: 'b', label: 'B', aliases: [], importance: 'important', weight: 0.3, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 1 }) },
      { id: 'c', label: 'C', aliases: [], importance: 'important', weight: 0.2, prerequisites: [], relatesTo: [], dimensions: dims({ definition: 1, mechanism: 1 }) },
    ];
    const rubric: ExpertRubric = {
      version: 'test', questionId: 'q', questionText: '', questionType: 'Technical',
      concepts, misconceptions: [], expectedExamples: [], expectedTradeoffs: [], domains: [], domainRules: [],
    };
    const coverage: CoverageReport = {
      overall: 8, ratio: 0.8,
      tiers: [
        { tier: 'critical', expectedConcepts: 1, matchedConcepts: 1, expectedWeight: 0.5, matchedWeight: 0.5, ratio: 1 },
        { tier: 'important', expectedConcepts: 2, matchedConcepts: 1, expectedWeight: 0.5, matchedWeight: 0.3, ratio: 0.6 },
        { tier: 'supporting', expectedConcepts: 0, matchedConcepts: 0, expectedWeight: 0, matchedWeight: 0, ratio: 0 },
        { tier: 'bonus', expectedConcepts: 0, matchedConcepts: 0, expectedWeight: 0, matchedWeight: 0, ratio: 0 },
      ],
      dimensionCoverage: 8, relationshipCoverage: 10, coveredWeight: 0.8, totalWeight: 1,
    };
    const language: ExpertLanguageAnalysis = {
      score: 9, sentenceCount: 2,
      grammar: { score: 10, issues: [] },
      readability: { score: 8, readingEase: 75, gradeLevel: 7, avgWordsPerSentence: 12, avgSyllablesPerWord: 1.4, longWordRatio: 0.1, lexicalDiversity: 0.8 },
      repetition: { score: 10, fillerCount: 0, fillerRatio: 0, typeTokenRatio: 1, repeatedChunks: [], duplicateSentencePairs: [] },
      contradictions: { score: 10, contradictions: [] },
    };
    const summaries = [
      summary('a', { matched: true, weight: 0.5, importance: 'critical', satisfied: ['definition', 'mechanism'], missing: [] }),
      summary('b', { matched: true, weight: 0.3, importance: 'important', satisfied: ['definition'], missing: [] }),
      summary('c', { matched: false, weight: 0.2, importance: 'important', satisfied: [], missing: ['definition', 'mechanism'] }),
    ];
    const negativeMarks: NegativeMark[] = [
      { id: 'contradiction_0_1', source: 'contradiction', description: 'Claimed LIFO then FIFO.', severity: 'high', penalty: 2.0 },
    ];
    const input: FeedbackInput = {
      rubric, coverage, summaries, validRelations: ['a -> b'], negativeMarks, language,
      positiveScore: 8.5, negativePenalty: 2.0, finalScore: 6.5,
    };
    return { ...input, ...overrides };
  }

  it('surfaces evidence-grounded strengths', () => {
    const feedback = generateFeedback(baseInput({}));
    expect(feedback.strengths[0]).toMatch(/Explained a/);
    expect(feedback.strengths).toContain('Correctly connected a to b.');
    expect(feedback.strengths).toContain('Grammar and sentence structure were clean.');
    expect(feedback.strengths).toContain('The answer was easy to read and well-paced.');
  });

  it('lists negative marks as weaknesses', () => {
    const feedback = generateFeedback(baseInput({}));
    expect(feedback.weaknesses).toContain('Claimed LIFO then FIFO.');
  });

  it('ranks missing concepts by importance then weight with expected dimensions', () => {
    const feedback = generateFeedback(baseInput({}));
    expect(feedback.missingConcepts).toHaveLength(1);
    expect(feedback.missingConcepts[0]).toContain('c (important)');
    expect(feedback.missingConcepts[0]).toContain('expected: definition, mechanism');
    expect(feedback.suggestions[0]).toContain('Explain c');
  });

  it('ranks a critical gap above an important one regardless of weight', () => {
    const summaries = baseInput({}).summaries.map(s =>
      s.conceptId === 'c'
        ? { ...s, importance: 'critical' as ExpertImportance, weight: 0.2 }
        : s,
    );
    const feedback = generateFeedback(baseInput({ summaries }));
    expect(feedback.missingConcepts[0]).toContain('c (critical)');
  });

  it('maps the verdict from the final score', () => {
    expect(generateFeedback(baseInput({ finalScore: 7.2 })).verdict).toBe('Pass');
    expect(generateFeedback(baseInput({ finalScore: 6.5 })).verdict).toBe('Borderline');
    expect(generateFeedback(baseInput({ finalScore: 4.2 })).verdict).toBe('Fail');
    expect(generateFeedback(baseInput({ finalScore: 7.2 })).summary).toContain('7.2/10');
  });

  it('adds a grammar weakness when grammar is poor', () => {
    const input = baseInput({});
    input.language.grammar = { score: 5, issues: [{ ruleId: 'r', sentenceIndex: 0, matchedText: 'x', explanation: 'y', severity: 'medium', penalty: 1 }] };
    const feedback = generateFeedback(input);
    expect(feedback.weaknesses).toContain('Several grammar issues reduce the clarity of the answer.');
  });
});

describe('ExpertEvaluator coverage/negative-marking integration', () => {
  beforeEach(() => clearWeightedRubricCache());

  it('produces a clean pass for a detailed answer with no deductions', () => {
    const evaluation = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });

    expect(evaluation.analysis.coverage.tiers).toHaveLength(4);
    expect(evaluation.analysis.coverage.tiers[0]).toMatchObject({ tier: 'critical', expectedConcepts: 0 });
    expect(evaluation.analysis.coverage.tiers.find(t => t.tier === 'important')!.matchedConcepts).toBeGreaterThan(0);
    expect(evaluation.analysis.coverage.overall).toBeGreaterThan(0);
    expect(evaluation.analysis.negativeMarks).toHaveLength(0);
    expect(evaluation.analysis.scores.negativePenalty).toBe(0);
    expect(evaluation.analysis.domainRules).toEqual([]);

    expect(evaluation.analysis.feedback.verdict).toBe('Pass');
    expect(evaluation.analysis.feedback.finalScore).toBe(evaluation.analysis.scores.weightedTotal);
    expect(evaluation.analysis.feedback.finalScore).toBeCloseTo(evaluation.analysis.feedback.positiveScore, 0);
    expect(evaluation.analysis.feedback.strengths.length).toBeGreaterThan(0);
    expect(evaluation.trace.some(l => l.startsWith('Coverage:'))).toBe(true);
  });

  it('deducts negative marks for self-contradicting / misconception answers', () => {
    const evaluation = ExpertEvaluator.evaluate({
      question: stackQuestion,
      answer: 'A stack is LIFO. A stack follows FIFO.',
    });

    const sources = new Set(evaluation.analysis.negativeMarks.map(m => m.source));
    expect(sources.has('contradiction')).toBe(true);
    expect(sources.has('misconception')).toBe(true);
    expect(evaluation.analysis.scores.negativePenalty).toBeGreaterThan(0);
    expect(evaluation.analysis.feedback.finalScore).toBeLessThan(evaluation.analysis.feedback.positiveScore);
    expect(evaluation.analysis.feedback.weaknesses.length).toBeGreaterThan(0);
    expect(evaluation.trace.some(l => l.startsWith('Negative marking:'))).toBe(true);
  });

  it('collects domain pack rules into the rubric', () => {
    const rubric = compileWeightedRubric(dbQuestion, { domainPacks: [dbPack] });
    expect(rubric.domains).toEqual(['databases']);
    expect(rubric.domainRules).toHaveLength(1);
    expect(rubric.domainRules[0]).toMatchObject({ id: 'db_txn_commit', domain: 'databases', penalty: 1.0 });
  });

  it('passes a domain rule when the expected phrase appears', () => {
    const evaluation = ExpertEvaluator.evaluate({
      question: dbQuestion,
      answer: 'ACID transactions guarantee atomicity and a transaction should commit or rollback as one unit.',
      options: { domainPacks: [dbPack] },
    });

    expect(evaluation.analysis.domainRules).toHaveLength(1);
    expect(evaluation.analysis.domainRules[0].triggered).toBe(true);
    expect(evaluation.analysis.domainRules[0].passed).toBe(true);
    expect(evaluation.analysis.negativeMarks.some(m => m.source === 'domain_rule')).toBe(false);
  });

  it('fails a domain rule and deducts its penalty when expected phrases are missing', () => {
    const evaluation = ExpertEvaluator.evaluate({
      question: dbQuestion,
      answer: 'A transaction is a unit of work in a database.',
      options: { domainPacks: [dbPack] },
    });

    const rule = evaluation.analysis.domainRules[0];
    expect(rule.triggered).toBe(true);
    expect(rule.passed).toBe(false);
    expect(rule.missingPhrases).toEqual(expect.arrayContaining(['commit', 'rollback', 'isolation']));

    const marks = evaluation.analysis.negativeMarks.filter(m => m.source === 'domain_rule');
    expect(marks).toHaveLength(1);
    expect(marks[0].penalty).toBe(1.0);
    expect(evaluation.analysis.scores.negativePenalty).toBeGreaterThan(0);
    expect(evaluation.trace.some(l => l.includes('Domain rules: 0/1 passed'))).toBe(true);
  });

  it('flags un-negated domain-pack misconceptions as negative marks', () => {
    const evaluation = ExpertEvaluator.evaluate({
      question: dbQuestion,
      answer: 'ACID is optional in production systems.',
      options: { domainPacks: [dbPack] },
    });

    const marks = evaluation.analysis.negativeMarks.filter(m => m.source === 'misconception');
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].description).toContain('ACID is not optional');
    expect(evaluation.analysis.scores.misconceptionPenalty).toBeGreaterThan(0);
  });
});
