import { describe, it, expect } from 'vitest';
import { ScoreAggregator } from '../src/Evaluation/pipeline/ScoreAggregator';
import { mergeBatchLLMResult } from '../src/shared/evaluation/synthesizer';
import { computeRecommendation, perQuestionAverageToOverallScore } from '../shared/scoringPolicy';

/**
 * PHASES 5-8 regression guards: LOCAL engine scoring, HYBRID merge, and evaluation fairness.
 *
 * The LOCAL engine (the production default) weights five components:
 *   facts 30% | misconceptions 25% | questionSatisfaction 20% | relevance 15% | completeness 10%
 *
 * Three of those award marks for the ABSENCE of a negative signal rather than for demonstrated
 * knowledge: misconceptions starts at 10 and only decreases; questionSatisfaction defaults to
 * 'YES'; relevance is floored at 0.1 (and is 1.0 when nothing is expected).
 *
 * A candidate matching NONE of the expected concepts but producing fluent, on-topic text scored
 *   0*0.30 + 10*0.25 + 10*0.20 + 10*0.15 + 0*0.10 = 6.0/10 -> 60/100 -> "Consider".
 * Saying nothing incorrect was worth more than saying anything correct. Score Gravity did not
 * catch it — that only engages at accuracy <= 2.0.
 */

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
    // Collections ScoreAggregator dereferences directly — all must be present.
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
    transcript: 'a fluent but empty answer',
    question: { rubric: null, knowledgeModel: [], evaluationGuide: ['Explain the concept'] },
    ...overrides,
  };
}

const runAggregator = (ctx: any) => { new ScoreAggregator().execute(ctx); return ctx; };

describe('Phase 5/8: the knowledge gate stops empty answers scoring a pass', () => {
  it('caps a fluent answer that demonstrates none of the expected concepts', () => {
    const ctx = runAggregator(makeContext({
      question: {
        rubric: { coreConcepts: ['tcp-handshake', 'reliability'], supportingConcepts: [] },
        knowledgeModel: [],
        evaluationGuide: ['Explain TCP'],
      },
      // Nothing matched: no conceptEvidence, no matchedConcepts.
      questionSatisfaction: 'YES',
      relevantContentRatio: 1.0,
    }));

    // Without the gate this aggregated to 6.0 -> 60/100 -> "Consider".
    expect(ctx.technicalAccuracyScore).toBeLessThanOrEqual(3.0);
    expect(computeRecommendation(perQuestionAverageToOverallScore(ctx.technicalAccuracyScore), 100))
      .toBe('Reject');
    expect(ctx.developerTrace.join(' ')).toMatch(/Knowledge Gate/);
  });

  it('leaves a candidate who DID demonstrate a concept unpenalised', () => {
    const ctx = runAggregator(makeContext({
      question: {
        rubric: { coreConcepts: ['tcp-handshake', 'reliability'], supportingConcepts: [] },
        knowledgeModel: [],
        evaluationGuide: ['Explain TCP'],
      },
      conceptEvidence: [{ conceptId: 'tcp-handshake', negated: false }],
      matchedConcepts: new Set(['tcp-handshake']),
    }));

    expect(ctx.technicalAccuracyScore).toBeGreaterThan(3.0);
    expect(ctx.developerTrace.join(' ')).not.toMatch(/Knowledge Gate/);
  });

  it('does NOT gate open questions that legitimately define no concepts', () => {
    // Behavioural questions have no rubric and no knowledgeModel; the fallback floor governs
    // them instead. Gating these would wrongly fail every behavioural answer.
    //
    // PASS 2 / FINDING 1B: the fixture now carries the metadata a real question has. Every one
    // of the 420 questions in the bank declares `type` and `interviewCategory` — the original
    // fixture declared neither, which no real question does. Since 1B, "no rubric" alone no
    // longer implies "open-ended": a technical question that merely lacks an authored rubric is
    // treated strictly. The intent of this test is unchanged; the fixture is now realistic.
    const ctx = runAggregator(makeContext({
      question: {
        rubric: null, knowledgeModel: [], evaluationGuide: ['Tell me about yourself'],
        type: 'Behavioral Experience', interviewCategory: 'Introduction',
      },
      questionSatisfaction: 'YES',
    }));

    expect(ctx.developerTrace.join(' ')).not.toMatch(/Knowledge Gate/);
    expect(ctx.technicalAccuracyScore).toBeGreaterThan(3.0);
  });

  it('ranks a non-answer below a wrong-but-attempted answer', () => {
    const empty = runAggregator(makeContext({
      question: { rubric: { coreConcepts: ['x'], supportingConcepts: [] }, knowledgeModel: [] },
    }));
    // The gate floors at a Reject-band score rather than 0, so an explicit "I don't know"
    // (forced to 0 by the Honest Unknown override) still ranks lowest.
    expect(empty.technicalAccuracyScore).toBeGreaterThan(0);
    expect(empty.technicalAccuracyScore).toBeLessThanOrEqual(3.0);
  });

  it('is deterministic — identical input yields an identical score', () => {
    const build = () => makeContext({
      question: { rubric: { coreConcepts: ['a', 'b'], supportingConcepts: ['c'] }, knowledgeModel: [] },
      conceptEvidence: [{ conceptId: 'a', negated: false }],
      matchedConcepts: new Set(['a']),
    });
    const first = runAggregator(build()).technicalAccuracyScore;
    for (let i = 0; i < 5; i++) {
      expect(runAggregator(build()).technicalAccuracyScore).toBe(first);
    }
  });
});

describe('Phase 6: the hybrid merge preserves heuristic evidence', () => {
  const heuristic = {
    executiveSummary: { summary: 'local summary', technicalScore: 72 },
    overallScores: { knowledgeScore: 72 },
    strengths: ['Explained TCP handshake'],
    weaknesses: ['Did not cover congestion control'],
  };
  const llm = {
    overallSummary: 'llm summary',
    strengths: ['Great communicator'],
    weaknesses: ['Needs depth'],
    recommendations: ['Study networking'],
  } as any;

  it('surfaces the LLM narrative without destroying the evidence-derived lists', () => {
    const merged = mergeBatchLLMResult(heuristic, llm, 'v3');
    // Displayed fields take the LLM values — unchanged behaviour.
    expect(merged.strengths).toEqual(['Great communicator']);
    expect(merged.weaknesses).toEqual(['Needs depth']);
    // ...but the heuristic lists remain available for audit.
    expect(merged.heuristicStrengths).toEqual(['Explained TCP handshake']);
    expect(merged.heuristicWeaknesses).toEqual(['Did not cover congestion control']);
  });

  it('never mutates the source heuristic report', () => {
    const source = JSON.parse(JSON.stringify(heuristic));
    mergeBatchLLMResult(source, llm, 'v3');
    expect(source.strengths).toEqual(['Explained TCP handshake']);
  });

  it('leaves the numeric scores to the local engine', () => {
    const merged = mergeBatchLLMResult(heuristic, llm, 'v3');
    // The LLM writes narrative only; it must not move the score.
    expect(merged.executiveSummary.technicalScore).toBe(72);
    expect(merged.overallScores.knowledgeScore).toBe(72);
  });

  it('tolerates a heuristic report with no strengths/weaknesses', () => {
    const merged = mergeBatchLLMResult({ executiveSummary: {} }, llm, 'v3');
    expect(merged.heuristicStrengths).toEqual([]);
    expect(merged.heuristicWeaknesses).toEqual([]);
  });
});
