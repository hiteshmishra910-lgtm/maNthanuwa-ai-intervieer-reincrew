// AUTO-GENERATED FILE — DO NOT EDIT.
// Source: shared/scoringPolicy.ts

/**
 * Centralized Scoring Policy
 * 
 * Single source of truth for hiring recommendations across all evaluation modes
 * (API, LOCAL, HYBRID) to prevent scoring inconsistencies.
 */

export type Recommendation = "Strong Hire" | "Hire" | "Consider" | "Reject" | "NOT GENERATED";

/**
 * Per-question scores (LLM `accuracy`, local `contentScore`) are on a 0-10 scale.
 * This is enforced for the API path in apiService.ts (`Math.min(10, ...)`) and is the
 * scale the batch evaluation prompt asks the model for.
 */
export const PER_QUESTION_SCORE_MAX = 10;

/**
 * Aggregate/report scores are on a 0-100 scale. This applies to every value that reaches
 * `interview_sessions.overall_score`, `evaluation_reports.total_score`,
 * `executiveSummary.technicalScore`, `overallScores.*` and the thresholds below.
 */
export const OVERALL_SCORE_MAX = 100;

/**
 * Convert an average per-question score (0-10) into the aggregate report scale (0-100).
 *
 * Mixing these two scales is what caused every HYBRID candidate to be scored out of 10
 * while the thresholds in `computeRecommendation` expect 0-100 — capping the best possible
 * candidate at 10/100 and returning "Reject" for everyone. Always route the conversion
 * through this function so the two scales can never drift apart again.
 *
 * Rounds only once, at the end, so a 4.6/10 average becomes 46 rather than 50.
 */
export function perQuestionAverageToOverallScore(averagePerQuestionScore: number): number {
  if (!Number.isFinite(averagePerQuestionScore)) return 0;
  const clamped = Math.max(0, Math.min(PER_QUESTION_SCORE_MAX, averagePerQuestionScore));
  return Math.round(clamped * (OVERALL_SCORE_MAX / PER_QUESTION_SCORE_MAX));
}

export function computeIntegrityScore(violationScore: number): number {
  if (typeof violationScore !== 'number' || !Number.isFinite(violationScore)) return 100;
  return Math.max(0, Math.min(100, 100 - violationScore));
}

/**
 * @param trustAdjustedScore Overall performance on a **0-100** scale. Passing a 0-10
 *   per-question average here silently yields "Reject" for every candidate — convert with
 *   {@link perQuestionAverageToOverallScore} first.
 * @param integrityScore Proctoring integrity on a **0-100** scale (100 = no violations).
 */
export function computeRecommendation(
  trustAdjustedScore: number,
  integrityScore: number
): Recommendation {
  // Hard floor for integrity violations
  if (integrityScore < 40) {
    return "Reject";
  }

  // Thresholds based on trustAdjustedScore
  if (trustAdjustedScore >= 80) {
    return "Strong Hire";
  }
  
  if (trustAdjustedScore >= 65) {
    return "Hire";
  }
  
  if (trustAdjustedScore >= 50) {
    return "Consider";
  }
  
  return "Reject";
}

/**
 * Phase 12 Strict Required-Element Coverage Ceiling.
 *
 * For Phase 12, any omission of at least one explicitly required trade-off or required
 * rubric element produces a fixed coverageCap = 5.50 / 10; otherwise coverageCap = 10.00 / 10.
 * The cap is applied as a non-destructive ceiling: Math.min(rawScore, coverageCap).
 */
export function calculateRequiredElementCoverageCap(
  hasRequiredElements: boolean,
  hasOmittedRequiredElement: boolean
): number {
  if (hasRequiredElements && hasOmittedRequiredElement) {
    return 5.50;
  }
  return 10.00;
}

