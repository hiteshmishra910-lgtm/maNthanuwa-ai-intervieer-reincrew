import { describe, it, expect, beforeEach } from 'vitest';
import { Question, EvaluationMode } from '../types';
import { embedPhrase, embedSentences, cosineSimilarity, hashString32 } from '../src/Evaluation/expert/Embeddings';
import { compileWeightedRubric, clearWeightedRubricCache, detectQuestionType } from '../src/Evaluation/expert/WeightedRubric';
import { buildConceptGraph, analyzeConceptGraph } from '../src/Evaluation/expert/ConceptGraph';
import { PhraseMap, tokenizeForPhrase, SynonymRegistry } from '../src/Evaluation/expert/SynonymMap';
import { ExpertEvaluator, ExpertEvaluation } from '../src/Evaluation/expert/ExpertEvaluator';
import { ExpertEvaluationModule } from '../src/Evaluation/expert/module';
import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { setExpertEngineEnabled, isExpertEngineEnabled } from '../src/Evaluation/expert/config';
import { EVALUATION_PROFILES_REGISTRY } from '../src/Evaluation/pipeline/interfaces';

const stackQuestion: Question = {
  id: 'expert_stack_q',
  question: 'Explain Stacks in detail and why we use them.',
  questionType: 'Definition',
  evaluationGuide: ['LIFO pattern', 'Push and Pop operations'],
  knowledgeModel: [
    {
      conceptId: 'stacks',
      expected: {
        definition: true,
        mechanism: true,
        purpose: true,
        useCase: true,
        limitations: true,
      },
      relationships: ['arrays -> stacks', 'linked_lists -> stacks'],
      commonMistakes: ['FIFO', 'First In First Out'],
    },
  ],
};

const DETAILED_ANSWER =
  'A stack is a data structure based on LIFO, meaning Last In First Out. ' +
  'Internally it works by pushing elements onto the stack and popping them off. ' +
  'We implement it using arrays or linked lists, which allows us to keep track of call stacks or undo histories.';

const KEYWORD_ANSWER = 'Stack. LIFO. Push. Pop. Array. Linked list. Undo operation.';

describe('Embeddings (lightweight subword)', () => {
  it('is deterministic for identical input', () => {
    const a = embedPhrase('stack push pop');
    const b = embedPhrase('stack push pop');
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('returns a unit vector', () => {
    const v = embedPhrase('stack push pop');
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    expect(Math.sqrt(norm)).toBeCloseTo(1, 5);
  });

  it('ranks related text above unrelated text', () => {
    const related = cosineSimilarity(
      embedPhrase('a stack works by push and pop'),
      embedPhrase('stack push pop LIFO'),
    );
    const unrelated = cosineSimilarity(
      embedPhrase('a stack works by push and pop'),
      embedPhrase('database joins and index queries'),
    );
    expect(related).toBeGreaterThan(unrelated + 0.15);
  });

  it('gives partial credit to inflected forms via shared n-grams', () => {
    const sim = cosineSimilarity(embedPhrase('inheritance'), embedPhrase('inherit'));
    expect(sim).toBeGreaterThan(0.1);
  });

  it('uses a deterministic 32-bit hash', () => {
    expect(hashString32('lifo')).toBe(hashString32('lifo'));
    expect(hashString32('lifo')).not.toBe(hashString32('fifo'));
  });
});

describe('WeightedRubric', () => {
  beforeEach(() => clearWeightedRubricCache());

  it('detects question type from text', () => {
    expect(detectQuestionType(stackQuestion)).toBe('Definition');
    expect(detectQuestionType({ id: 1, question: 'Difference between TCP and UDP' })).toBe('Comparison');
  });

  it('compiles knowledgeModel concepts with weights that sum to ~1', () => {
    const rubric = compileWeightedRubric(stackQuestion);
    expect(rubric.concepts.length).toBe(1);
    expect(rubric.concepts[0].id).toBe('stacks');
    expect(rubric.concepts[0].weight).toBeCloseTo(1, 5);
    expect(rubric.misconceptions.length).toBe(2); // FIFO + First In First Out
  });

  it('assigns higher weight to critical than supporting concepts', () => {
    const chain = compileWeightedRubric({ id: 2, question: 'Explain X', evaluationGuide: ['A', 'B', 'C'] });
    const weights = chain.concepts.map(c => c.weight);
    const total = weights.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(weights[0]).toBeGreaterThan(weights[1]); // critical > important
    expect(weights[1]).toBe(weights[2]);
  });

  it('respects profile requiredDimensions in per-concept dimension weights', () => {
    const rubric = compileWeightedRubric(stackQuestion);
    const dims = rubric.concepts[0].dimensions;
    expect(dims.definition).toBeGreaterThan(0.02);
    expect(dims.mechanism).toBeGreaterThan(0.02);
    // Definition questions do not expect tradeoffs
    expect(dims.tradeoffs).toBeLessThan(0.02);
  });
});

describe('SynonymMap / phrase mapping', () => {
  it('tokenizes hyphenated phrases into separate tokens', () => {
    expect(tokenizeForPhrase('last-in-first-out')).toEqual(['last', 'in', 'first', 'out']);
  });

  it('matches curated multi-word phrases', () => {
    const map = new PhraseMap();
    map.register('last in first out', ['stacks'], 'phrase');
    const matches = map.find(tokenizeForPhrase('it works on a last in first out basis'));
    expect(matches.length).toBe(1);
    expect(matches[0].conceptIds).toContain('stacks');
  });

  it('resolves synonyms from the global registry', () => {
    const registry = SynonymRegistry.getInstance();
    const concepts = registry.findConcepts('Data hiding is enforced with private fields and getters and setters');
    const ids = new Set(Array.from(concepts.keys()));
    expect(ids.has('encapsulation')).toBe(true);
  });

  it('matches "referential integrity" to the foreign key concept', () => {
    const registry = SynonymRegistry.getInstance();
    const concepts = registry.findConcepts('a foreign key maintains referential integrity between tables');
    const ids = new Set(Array.from(concepts.keys()));
    expect(ids.has('foreign_key')).toBe(true);
    expect(ids.has('primary_key')).toBe(false);
  });
});

describe('ConceptGraph', () => {
  it('builds a prerequisite chain from evaluationGuide fallback', () => {
    const rubric = compileWeightedRubric({ id: 3, question: 'Explain X', evaluationGuide: ['A', 'B', 'C'] });
    const graph = buildConceptGraph(rubric);
    expect(graph.maxDepth).toBe(3);
    expect(graph.prerequisites.get('concept_1')).toEqual(['concept_0']);
  });

  it('computes weighted coverage and reached depth', () => {
    const rubric = compileWeightedRubric({ id: 4, question: 'Explain X', evaluationGuide: ['A', 'B', 'C'] });
    const graph = buildConceptGraph(rubric);
    const partial = analyzeConceptGraph(graph, new Set(['concept_0', 'concept_1']));
    expect(partial.weightedCoverage).toBeCloseTo(0.717, 2);
    expect(partial.reachedDepth).toBe(2);
    expect(partial.depthRatio).toBeCloseTo(2 / 3, 5);

    const full = analyzeConceptGraph(graph, new Set(['concept_0', 'concept_1', 'concept_2']));
    expect(full.weightedCoverage).toBeCloseTo(1, 5);
    expect(full.missedPrerequisites.length).toBe(0);
  });
});

describe('ExpertEvaluator (end-to-end)', () => {
  it('scores a detailed answer higher than keyword listing', () => {
    const detailed = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });
    const keyword = ExpertEvaluator.evaluate({ question: stackQuestion, answer: KEYWORD_ANSWER });

    expect(detailed.analysis.scores.weightedTotal).toBeGreaterThan(keyword.analysis.scores.weightedTotal);
    expect(detailed.analysis.scores.conceptCoverage).toBeGreaterThan(keyword.analysis.scores.conceptCoverage);
    expect(detailed.analysis.concepts[0].matched).toBe(true);
    expect(detailed.analysis.concepts[0].satisfiedDimensions).toContain('definition');
    expect(detailed.analysis.concepts[0].satisfiedDimensions).toContain('mechanism');
  });

  it('is deterministic for the same input', () => {
    const a = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });
    const b = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });
    expect(a.analysis.scores.weightedTotal).toBe(b.analysis.scores.weightedTotal);
  });

  it('reports valid relationships when both endpoints are matched', () => {
    const evaluation = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });
    expect(evaluation.graphAnalysis.validRelations.length).toBe(2);
    expect(evaluation.analysis.scores.relationship).toBe(10);
  });

  it('penalizes an explicit misconception (stack = FIFO)', () => {
    const evaluation = ExpertEvaluator.evaluate({
      question: stackQuestion,
      answer: 'A stack is a contiguous structure that follows FIFO. We add elements via push and remove them via pop.',
    });
    expect(evaluation.analysis.misconceptionHits).toContain('FIFO');
    expect(evaluation.analysis.scores.misconceptionPenalty).toBeGreaterThan(0);
  });

  it('does not penalize a negated misconception claim', () => {
    const evaluation = ExpertEvaluator.evaluate({
      question: stackQuestion,
      answer: 'A stack is a contiguous structure that is not FIFO. It works by pushing on top and popping from the top.',
    });
    expect(evaluation.misconceptionHits.filter(h => !h.negated).length).toBe(0);
    expect(evaluation.analysis.scores.misconceptionPenalty).toBe(0);
  });

  it('returns Fail verdict for an honest unknown', () => {
    const evaluation = ExpertEvaluator.evaluate({ question: stackQuestion, answer: 'I do not know' });
    expect(evaluation.analysis.verdict).toBe('Fail');
    expect(evaluation.analysis.scores.weightedTotal).toBe(0);
  });

  it('maps a strong answer to a Pass verdict and returns explainable evidence', () => {
    const evaluation = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });
    expect(evaluation.analysis.verdict).toBe('Pass');
    expect(evaluation.trace.length).toBeGreaterThan(3);
    expect(evaluation.analysis.graph.weightedCoverage).toBeGreaterThan(0.5);
  });

  it('maps gibberish to Fail', () => {
    const evaluation = ExpertEvaluator.evaluate({
      question: stackQuestion,
      answer: 'The weather is nice today and I like to code.',
    });
    expect(evaluation.analysis.verdict).toBe('Fail');
  });

  it('keeps latency negligible on typical answers', () => {
    const evaluation = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });
    expect(evaluation.latencyMs).toBeLessThan(50);
  });
});

describe('ExpertEvaluationModule bridge', () => {
  it('installs and uninstalls itself before ScoreAggregator', () => {
    expect(EvaluationCore.getModules().some(m => m.name === 'ExpertEvaluationModule')).toBe(false);

    ExpertEvaluationModule.install();
    const modules = EvaluationCore.getModules();
    const idx = modules.findIndex(m => m.name === 'ExpertEvaluationModule');
    expect(idx).toBeGreaterThan(-1);
    expect(modules[idx + 1]?.name).toBe('ScoreAggregator');

    ExpertEvaluationModule.uninstall();
    expect(EvaluationCore.getModules().some(m => m.name === 'ExpertEvaluationModule')).toBe(false);
  });

  it('writes expert analysis + concept evidence into the pipeline context', () => {
    const ctx: any = {
      question: stackQuestion,
      answer: DETAILED_ANSWER,
      matchedConcepts: new Set<string>(),
      conceptCompleteness: new Map(),
      conceptEvidence: [],
      technicalErrors: [],
      developerTrace: [],
      detectorConfidences: {},
      tokens: [],
      stemmedTokens: [],
      sentences: [],
      normalizedAnswer: '',
    };

    new ExpertEvaluationModule().execute(ctx);

    expect(ctx.expert).toBeDefined();
    expect(ctx.expert.engine).toBe('expert-local-v1');
    expect(ctx.matchedConcepts.has('stacks')).toBe(true);
    expect(ctx.conceptEvidence.length).toBeGreaterThan(0);
    expect(ctx.conceptCompleteness.get('stacks').satisfiedDimensions).toContain('definition');
    expect(ctx.detectorConfidences['expertEngine']).toBe(100);
  });
});

describe('EvaluationCore boot-path integration', () => {
  beforeEach(() => setExpertEngineEnabled(undefined));

  it('is off by default: no expert module and no expert field', () => {
    expect(isExpertEngineEnabled()).toBe(false);
    const result = EvaluationCore.evaluateAnswer({
      session: { id: 's_off', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'C', email: 'c@example.com', role: 'Dev' },
      question: stackQuestion,
      response: DETAILED_ANSWER,
    });
    expect(result.expert).toBeUndefined();
    expect(EvaluationCore.getModules().some(m => m.name === 'ExpertEvaluationModule')).toBe(false);
  });

  it('produces expert analysis when the flag is enabled and restores the module list', () => {
    setExpertEngineEnabled(true);
    expect(isExpertEngineEnabled()).toBe(true);

    const result = EvaluationCore.evaluateAnswer({
      session: { id: 's_on', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'C', email: 'c@example.com', role: 'Dev' },
      question: stackQuestion,
      response: DETAILED_ANSWER,
    });

    expect(result.expert).toBeDefined();
    expect(result.expert?.engine).toBe('expert-local-v1');
    expect(result.expert?.concepts[0].matched).toBe(true);
    expect((result.detectorConfidences as any)['expertEngine']).toBe(100);

    expect(EvaluationCore.getModules().some(m => m.name === 'ExpertEvaluationModule')).toBe(false);
    setExpertEngineEnabled(undefined);
    expect(isExpertEngineEnabled()).toBe(false);
  });
});

describe('Semantic similarity integration', () => {
  it('matches a paraphrase to a concept without sharing surface words', () => {
    const question: Question = {
      id: 'paraphrase_q',
      question: 'What is a virtual memory?',
      questionType: 'Definition',
      knowledgeModel: [{ conceptId: 'virtual_memory', expected: { definition: true, mechanism: true, purpose: true, useCase: true, limitations: true } }],
    };
    const evaluation: ExpertEvaluation = ExpertEvaluator.evaluate({
      question,
      answer: 'Virtual memory lets programs address more space than the physical RAM by keeping pages on the disk and swapping them in through page faults.',
    });
    expect(evaluation.analysis.concepts[0].matched).toBe(true);
  });

  it('splits answers into sentences used for evidence attribution', () => {
    const sentences = embedSentences('First sentence here. Second one.');
    expect(sentences.length).toBe(2);
  });
});
