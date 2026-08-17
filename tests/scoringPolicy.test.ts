import { describe, it, expect } from 'vitest';
import {
  computeRecommendation,
  perQuestionAverageToOverallScore,
  PER_QUESTION_SCORE_MAX,
  OVERALL_SCORE_MAX,
} from '../shared/scoringPolicy';
import {
  buildHybridReport,
  averagePerQuestionAccuracy,
} from '../shared/hybridReportBuilder';

/**
 * Regression guard for CR-3.
 *
 * The HYBRID Edge Function averaged per-question `accuracy` (0-10) and passed the result
 * straight into `computeRecommendation`, whose thresholds are on a 0-100 scale. The best
 * possible candidate therefore scored 10/100 and every HYBRID candidate was stored as
 * "Reject" (verified in production: 9 of 9 hybrid sessions, including one averaging 10/10).
 */

const perfect = (n: number) => Array.from({ length: n }, () => ({ accuracy: 10 }));
const scored = (values: number[]) => values.map(accuracy => ({ accuracy }));

/** Responses data for mapping questionText/userAnswer in questionBreakdown. */
const mockResponses = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    questionText: `What is concept ${i + 1}?`,
    type: 'Technical',
    answer: `Answer for question ${i + 1}`,
  }));

describe('scoringPolicy: scale contract', () => {
  it('declares the two scales explicitly', () => {
    expect(PER_QUESTION_SCORE_MAX).toBe(10);
    expect(OVERALL_SCORE_MAX).toBe(100);
  });

  it('converts a per-question average (0-10) to the overall scale (0-100)', () => {
    expect(perQuestionAverageToOverallScore(0)).toBe(0);
    expect(perQuestionAverageToOverallScore(5)).toBe(50);
    expect(perQuestionAverageToOverallScore(10)).toBe(100);
  });

  it('rounds once at the end, preserving sub-point precision', () => {
    // 4.6/10 must become 46, not 50 (which the old `Math.round` before scaling produced).
    expect(perQuestionAverageToOverallScore(4.6)).toBe(46);
    expect(perQuestionAverageToOverallScore(6.7)).toBe(67);
  });

  it('clamps finite out-of-range input into the valid band', () => {
    expect(perQuestionAverageToOverallScore(-3)).toBe(0);
    expect(perQuestionAverageToOverallScore(99)).toBe(100);
  });

  it('fails closed on non-finite input rather than awarding a top score', () => {
    // NaN/Infinity mean the upstream data is corrupt. Scoring them 0 (and therefore
    // "Reject") is deliberate: malformed evaluation data must never be able to manufacture
    // a hire recommendation. A reviewer sees a 0 and investigates; a 100 would ship silently.
    expect(perQuestionAverageToOverallScore(NaN)).toBe(0);
    expect(perQuestionAverageToOverallScore(Infinity)).toBe(0);
    expect(perQuestionAverageToOverallScore(-Infinity)).toBe(0);
  });
});

describe('scoringPolicy: computeRecommendation thresholds (0-100 input)', () => {
  it.each([
    [100, 'Strong Hire'],
    [80, 'Strong Hire'],
    [79, 'Hire'],
    [65, 'Hire'],
    [64, 'Consider'],
    [50, 'Consider'],
    [49, 'Reject'],
    [0, 'Reject'],
  ])('score %i -> %s', (score, expected) => {
    expect(computeRecommendation(score, 100)).toBe(expected);
  });

  it('applies the integrity hard floor regardless of performance', () => {
    expect(computeRecommendation(100, 39)).toBe('Reject');
    expect(computeRecommendation(100, 40)).toBe('Strong Hire');
  });
});

describe('CR-3 regression: HYBRID must not reject every candidate', () => {
  it('a candidate averaging a perfect 10/10 is a Strong Hire, not a Reject', () => {
    const report = buildHybridReport(perfect(8));
    expect(report.executiveSummary.technicalScore).toBe(100);
    expect(report.executiveSummary.recommendation).toBe('Strong Hire');
  });

  it('reproduces the old bug only when the conversion is skipped', () => {
    // This is what the Edge Function used to do. Kept as an executable description of the
    // defect: if someone reintroduces it, the assertion below documents the consequence.
    const rawAverage = averagePerQuestionAccuracy(perfect(8)); // 10
    expect(computeRecommendation(rawAverage, 100)).toBe('Reject');
    // ...and this is the corrected path.
    expect(computeRecommendation(perQuestionAverageToOverallScore(rawAverage), 100))
      .toBe('Strong Hire');
  });

  it('spans the full recommendation range instead of collapsing to Reject', () => {
    const recommendations = [
      buildHybridReport(scored([10, 9, 9, 10])).executiveSummary.recommendation, // 95
      buildHybridReport(scored([7, 7, 7, 7])).executiveSummary.recommendation,   // 70
      buildHybridReport(scored([5, 5, 6, 5])).executiveSummary.recommendation,   // 53
      buildHybridReport(scored([2, 1, 3, 2])).executiveSummary.recommendation,   // 20
    ];
    expect(recommendations).toEqual(['Strong Hire', 'Hire', 'Consider', 'Reject']);
  });

  it('emits every aggregate field on the 0-100 scale', () => {
    const r = buildHybridReport(scored([8, 8, 8, 8]));
    expect(r.executiveSummary.technicalScore).toBe(80);
    expect(r.overallScores.knowledgeScore).toBe(80);
    expect(r.overallScores.trustAdjustedScore).toBe(80);
    // Read by supabaseService.saveEvaluationReport when deriving overall_score/total_score.
    expect(r.overallScores.difficultyWeightedPerformance).toBe(80);
  });

  it('leaves per-question breakdown on the 0-10 scale (matches session_responses.content_score)', () => {
    const results = scored([8, 4, 10]);
    const r = buildHybridReport(results);
    expect(r.questionBreakdown.map(q => q.accuracy)).toEqual([8, 4, 10]);
    // databaseUpdater backfills content_score from q.accuracy and derives verdict at 7/4.
    expect(r.questionBreakdown.every(q => (q.accuracy as number) <= PER_QUESTION_SCORE_MAX)).toBe(true);
  });
});

describe('CR-3 regression: cross-mode scale consistency', () => {
  /** How ReportGenerator (LOCAL/API path) aggregates: scale each score by 10, then average. */
  const localAggregate = (perQuestion: number[]) =>
    Math.round(perQuestion.reduce((a, s) => a + s * 10, 0) / perQuestion.length);

  it.each([
    [[10, 10, 10, 10]],
    [[8, 7, 9, 6]],
    [[5, 5, 5, 5]],
    [[0, 0, 0, 0]],
    [[3, 8, 2, 9]],
  ])('LOCAL and HYBRID agree on the overall score for %j', (perQuestion) => {
    const local = localAggregate(perQuestion);
    const hybrid = buildHybridReport(scored(perQuestion)).executiveSummary.technicalScore;
    expect(hybrid).toBe(local);
  });

  it('LOCAL and HYBRID agree on the recommendation for identical answers', () => {
    for (const perQuestion of [[10, 10], [7, 7], [5, 6], [2, 1], [9, 8, 7]]) {
      const local = computeRecommendation(localAggregate(perQuestion), 100);
      const hybrid = buildHybridReport(scored(perQuestion)).executiveSummary.recommendation;
      expect(hybrid).toBe(local);
    }
  });
});

describe('CR-3 regression: degenerate input', () => {
  it('an empty result set scores 0 and rejects, without NaN', () => {
    const r = buildHybridReport([]);
    expect(r.executiveSummary.technicalScore).toBe(0);
    expect(Number.isNaN(r.executiveSummary.technicalScore)).toBe(false);
    expect(r.executiveSummary.recommendation).toBe('Reject');
  });

  it('treats a missing or non-numeric accuracy as 0 rather than NaN', () => {
    const r = buildHybridReport([{ accuracy: 10 }, {}, { accuracy: 'ten' } as any, { accuracy: 10 }]);
    // (10 + 0 + 0 + 10) / 4 = 5 -> 50
    expect(r.executiveSummary.technicalScore).toBe(50);
    expect(r.executiveSummary.recommendation).toBe('Consider');
  });

  it('honours the integrity floor when a caller supplies a real integrity score', () => {
    expect(buildHybridReport(perfect(4), 20).executiveSummary.recommendation).toBe('Reject');
    expect(buildHybridReport(perfect(4), 100).executiveSummary.recommendation).toBe('Strong Hire');
  });
});

describe('hybridReportBuilder: questionBreakdown field mapping', () => {
  it('maps accuracy to score for the frontend', () => {
    const r = buildHybridReport(scored([8, 6, 9]));
    r.questionBreakdown.forEach((q, i) => {
      expect(q.score).toBe(scored([8, 6, 9])[i].accuracy);
    });
  });

  it('populates questionText from responsesData', () => {
    const responses = mockResponses(3);
    const r = buildHybridReport(scored([8, 6, 9]), 100, responses);
    expect(r.questionBreakdown[0].questionText).toBe('What is concept 1?');
    expect(r.questionBreakdown[1].questionText).toBe('What is concept 2?');
    expect(r.questionBreakdown[2].questionText).toBe('What is concept 3?');
  });

  it('falls back to "Question N" when responsesData is missing', () => {
    const r = buildHybridReport(scored([8, 6]));
    expect(r.questionBreakdown[0].questionText).toBe('Question 1');
    expect(r.questionBreakdown[1].questionText).toBe('Question 2');
  });

  it('populates userAnswer from responsesData', () => {
    const responses = mockResponses(2);
    const r = buildHybridReport(scored([7, 5]), 100, responses);
    expect(r.questionBreakdown[0].userAnswer).toBe('Answer for question 1');
    expect(r.questionBreakdown[1].userAnswer).toBe('Answer for question 2');
  });

  it('builds feedback.observation from LLM fields', () => {
    const results = [{
      accuracy: 8,
      explainedConcepts: ['React hooks', 'state management'],
      missingKeyPoints: ['error boundaries'],
      positiveEvidence: { strongExample: true, realProject: false, tradeoffDiscussion: true, practicalExperience: false },
    }];
    const r = buildHybridReport(results);
    const obs = r.questionBreakdown[0].feedback?.observation ?? '';
    expect(obs).toContain('React hooks');
    expect(obs).toContain('error boundaries');
    expect(obs).toContain('strong example');
    expect(obs).toContain('trade-offs');
  });

  it('builds feedback.gaps from missingKeyPoints and technicalErrors', () => {
    const results = [{
      accuracy: 5,
      missingKeyPoints: ['type safety', 'generics'],
      technicalErrors: [{ error: 'Wrong type annotation', severity: 'medium' }],
    }];
    const r = buildHybridReport(results);
    const gaps = r.questionBreakdown[0].feedback?.gaps ?? [];
    expect(gaps).toContain('type safety');
    expect(gaps).toContain('generics');
    expect(gaps).toContain('Technical accuracy issues');
  });

  it('maps LLM dimension scores to analysis.* fields', () => {
    const results = [{
      accuracy: 7,
      conceptUnderstanding: 8,
      reasoning: 6,
      depth: 9,
      clarity: 5,
    }];
    const r = buildHybridReport(results);
    const a = r.questionBreakdown[0].analysis;
    expect(a?.understanding).toBe(8);
    expect(a?.reasoning).toBe(6);
    expect(a?.coverage).toBe(9);
    expect(a?.communication).toBe(5);
  });

  it('defaults analysis.* to accuracy when LLM omits dimension scores', () => {
    const results = [{ accuracy: 7 }];
    const r = buildHybridReport(results);
    const a = r.questionBreakdown[0].analysis;
    expect(a?.understanding).toBe(7);
    expect(a?.reasoning).toBe(7);
    expect(a?.coverage).toBe(7);
    expect(a?.communication).toBe(7);
  });

  it('stringifies technicalErrors from object[] to string[]', () => {
    const results = [{
      accuracy: 6,
      technicalErrors: [
        { error: 'Incorrect time complexity', severity: 'high' },
        { error: 'Missing null check', severity: 'low' },
      ],
    }];
    const r = buildHybridReport(results);
    const errs = r.questionBreakdown[0].technicalErrors;
    expect(errs).toEqual(['Incorrect time complexity', 'Missing null check']);
  });

  it('preserves accuracy field for averagePerQuestionAccuracy and databaseUpdater', () => {
    const r = buildHybridReport(scored([8, 6, 9]));
    // accuracy still used by averagePerQuestionAccuracy()
    expect(r.questionBreakdown.map(q => q.accuracy)).toEqual([8, 6, 9]);
    // and by databaseUpdater for content_score backfill
    expect(averagePerQuestionAccuracy(r.questionBreakdown)).toBe(7.666666666666667);
  });

  it('preserves raw LLM fields via passthrough spread', () => {
    const results = [{
      accuracy: 7,
      relevanceScore: 8,
      conceptCoverage: 9,
      answerDirectnessScore: 6,
      mentionedConcepts: ['React', 'TypeScript'],
      explainedConcepts: ['hooks'],
      missingKeyPoints: ['context API'],
    }];
    const r = buildHybridReport(results);
    const q = r.questionBreakdown[0];
    // Raw LLM fields preserved via spread
    expect(q.relevanceScore).toBe(8);
    expect(q.conceptCoverage).toBe(9);
    expect(q.answerDirectnessScore).toBe(6);
    // Mapped fields also present
    expect(q.score).toBe(7);
    expect(q.mentionedConcepts).toEqual(['React', 'TypeScript']);
    expect(q.explainedConcepts).toEqual(['hooks']);
    expect(q.missingKeyPoints).toEqual(['context API']);
  });
});
