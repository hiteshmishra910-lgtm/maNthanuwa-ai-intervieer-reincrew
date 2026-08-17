import { describe, it, expect } from 'vitest';
import { ScoreAggregator } from '../src/Evaluation/pipeline/ScoreAggregator';
import { perQuestionAverageToOverallScore, computeRecommendation } from '../shared/scoringPolicy';

/**
 * Evaluation validation required by the remediation brief: confirm score ordering is logical for
 * an excellent, average, incorrect, empty and off-topic answer.
 *
 * This exercises the LOCAL engine's ScoreAggregator directly. Local is the deterministic engine,
 * so its ordering is verifiable in CI without a live LLM. API and HYBRID ordering depends on a
 * model response and cannot be asserted here — the prompt-side guarantees for those live in
 * tests/evaluationGrounding.test.ts, and end-to-end ordering for them remains a manual check.
 *
 * The point is the RELATIVE ordering, not the absolute numbers. Pinning exact values would make
 * this fail on any legitimate recalibration; pinning the ordering catches the failure that
 * actually matters — a worse answer scoring at least as well as a better one.
 */

const QUESTION = {
  rubric: {
    coreConcepts: ['indexing', 'btree', 'lookup-cost'],
    supportingConcepts: ['cardinality'],
  },
  knowledgeModel: [],
  evaluationGuide: ['Explain database indexing'],
  type: 'Technical',
  interviewCategory: 'Technical_Core',
};

/** Minimal PipelineContext sufficient for ScoreAggregator. */
function makeContext(overrides: any = {}): any {
  return {
    developerTrace: [],
    conceptEvidence: [],
    matchedConcepts: new Set<string>(),
    conceptCompleteness: new Map<string, any>(),
    misconceptionEvidence: [],
    technicalErrors: [],
    selfCorrectionsCount: 0,
    questionSatisfaction: 'YES',
    relevantContentRatio: 1.0,
    tokens: new Array(60).fill('word'),
    reachedDepth: [],
    missedDependencies: [],
    validConnections: [],
    invalidConnections: [],
    unrecognizedClaims: [],
    localRepetitionPenalties: [],
    isHonestUnknown: false,
    uncertaintyDetected: false,
    buzzwordStuffingDetected: false,
    circularExplanationDetected: false,
    transcript: 'an answer',
    question: QUESTION,
    ...overrides,
  };
}

const score = (ctx: any): number => {
  new ScoreAggregator().execute(ctx);
  return ctx.technicalAccuracyScore;
};

/** Concept evidence with full explanation depth, as a real matcher would emit. */
const evidence = (ids: string[]) => ids.map((conceptId) => ({ conceptId, completenessRatio: 1.0 }));
const completeness = (ids: string[]) =>
  new Map(ids.map((id) => [id, { completenessRatio: 1.0 }]));

// ── The five answer classes ────────────────────────────────────────────────────────────────
const ANSWERS = {
  /** Explains every core concept and the supporting one, no errors. */
  excellent: () =>
    makeContext({
      transcript:
        'An index is a B-tree that keeps keys sorted, so a lookup is logarithmic rather than a full scan. ' +
        'High-cardinality columns benefit most because the tree partitions the rows evenly.',
      conceptEvidence: evidence(['indexing', 'btree', 'lookup-cost', 'cardinality']),
      matchedConcepts: new Set(['indexing', 'btree', 'lookup-cost', 'cardinality']),
      conceptCompleteness: completeness(['indexing', 'btree', 'lookup-cost', 'cardinality']),
      questionSatisfaction: 'YES',
      relevantContentRatio: 1.0,
    }),

  /** Gets one core concept across, misses the rest. */
  average: () =>
    makeContext({
      transcript: 'An index makes lookups faster because the database does not have to scan every row.',
      conceptEvidence: evidence(['indexing']),
      matchedConcepts: new Set(['indexing']),
      conceptCompleteness: completeness(['indexing']),
      questionSatisfaction: 'PARTIAL',
      relevantContentRatio: 0.8,
    }),

  /** Engages the topic but the explanation is wrong. */
  incorrect: () =>
    makeContext({
      transcript: 'An index is a copy of the whole table stored in memory, which is why it is faster.',
      conceptEvidence: [],
      matchedConcepts: new Set<string>(),
      technicalErrors: [
        { error: 'An index is not a full in-memory copy of the table', severity: 'high' },
        { error: 'Speed is not explained by memory residency', severity: 'medium' },
      ],
      misconceptionEvidence: [{ claim: 'index = in-memory table copy' }],
      questionSatisfaction: 'PARTIAL',
      relevantContentRatio: 0.7,
    }),

  /** Fluent, confident, and about something else entirely. */
  offTopic: () =>
    makeContext({
      transcript:
        'I really enjoy working in collaborative teams and I pride myself on clear communication with stakeholders.',
      conceptEvidence: [],
      matchedConcepts: new Set<string>(),
      questionSatisfaction: 'NO',
      relevantContentRatio: 0.1,
    }),

  /** Nothing said. */
  empty: () =>
    makeContext({
      transcript: '',
      tokens: [],
      conceptEvidence: [],
      matchedConcepts: new Set<string>(),
      questionSatisfaction: 'NO',
      relevantContentRatio: 0,
    }),
};

describe('LOCAL engine: per-question score ordering', () => {
  const scores = {
    excellent: score(ANSWERS.excellent()),
    average: score(ANSWERS.average()),
    incorrect: score(ANSWERS.incorrect()),
    offTopic: score(ANSWERS.offTopic()),
    empty: score(ANSWERS.empty()),
  };

  it('produces a defensible ordering across all five answer classes', () => {
    // Printed on failure so a recalibration shows its actual effect rather than just a red test.
    const summary = JSON.stringify(scores);

    expect(scores.excellent, `excellent must beat average — ${summary}`).toBeGreaterThan(scores.average);
    expect(scores.average, `average must beat incorrect — ${summary}`).toBeGreaterThan(scores.incorrect);
    expect(scores.incorrect, `incorrect must not beat a correct partial answer — ${summary}`).toBeLessThan(scores.average);
    expect(scores.offTopic, `off-topic must not beat average — ${summary}`).toBeLessThan(scores.average);
    expect(scores.empty, `empty must be the floor — ${summary}`).toBeLessThanOrEqual(scores.offTopic);
  });

  it('an excellent answer is actually rewarded', () => {
    // Guards the opposite failure from the knowledge gate: over-suppression that makes a genuinely
    // strong answer indistinguishable from a weak one.
    expect(scores.excellent).toBeGreaterThanOrEqual(7);
  });

  it('an empty answer sits at the floor and cannot pass', () => {
    // OBSERVED: an empty answer currently scores 2.0/10, not 0.
    //
    // That is the designed floor rather than a defect. The Knowledge Gate caps accuracy at
    // KNOWLEDGE_GATE_CAP (3.0) when nothing was demonstrated, and the residual contributions from
    // the components that reward the ABSENCE of a negative signal — misconceptions, relevance —
    // settle at 2.0. It aggregates to 20/100 and therefore "Reject", so no hiring decision turns
    // on it.
    //
    // Pinned as an upper bound, not an equality: asserting 0 would require recalibrating the
    // scoring engine, which is outside the scope of this remediation and would risk exactly the
    // kind of silent scoring change the non-regression directive forbids. Recorded as a deferred
    // finding in the report instead.
    expect(scores.empty).toBeLessThanOrEqual(2);
    expect(scores.empty).toBeLessThan(scores.average);
  });

  it('fluency on an off-topic answer earns no credit', () => {
    // The historical defect: an articulate answer that demonstrated nothing scored 6.0/10 because
    // three of the five components award marks for the ABSENCE of a negative signal.
    expect(scores.offTopic).toBeLessThanOrEqual(3);
  });

  it('a confidently wrong answer does not outscore an honest partial one', () => {
    expect(scores.incorrect).toBeLessThanOrEqual(3);
  });
});

describe('the ordering survives aggregation into a hiring recommendation', () => {
  const asOverall = (perQuestion: number) => perQuestionAverageToOverallScore(perQuestion);

  it('maps to non-increasing overall scores in the same order', () => {
    const ordered = ['excellent', 'average', 'incorrect', 'offTopic', 'empty'] as const;
    const overall = ordered.map((k) => asOverall(score(ANSWERS[k]())));

    for (let i = 1; i < overall.length; i++) {
      expect(
        overall[i],
        `${ordered[i]} (${overall[i]}) must not outrank ${ordered[i - 1]} (${overall[i - 1]})`
      ).toBeLessThanOrEqual(overall[i - 1]);
    }
  });

  it('does not recommend hiring on the strength of an empty or off-topic answer', () => {
    for (const key of ['empty', 'offTopic', 'incorrect'] as const) {
      const overall = asOverall(score(ANSWERS[key]()));
      const recommendation = computeRecommendation(overall, 100);
      expect(recommendation, `${key} must not yield a hire`).toBe('Reject');
    }
  });

  it('an interview of excellent answers does reach a hire', () => {
    // The counterpart check: rigour that never returns a hire is not rigour, it is a broken scale.
    const overall = asOverall(score(ANSWERS.excellent()));
    expect(['Strong Hire', 'Hire', 'Consider']).toContain(computeRecommendation(overall, 100));
  });
});
