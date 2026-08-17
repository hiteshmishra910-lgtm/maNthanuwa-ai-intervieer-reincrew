/**
 * Hybrid Report Builder
 *
 * Pure aggregation logic for the HYBRID evaluation mode, extracted from the
 * `evaluate-hybrid-job` Edge Function so it can be unit-tested. The Edge Function itself
 * imports Deno-only URLs, so nothing in it is reachable from the Vitest suite — which is
 * why the 0-10 vs 0-100 scale mismatch shipped undetected.
 *
 * Keep this module free of Deno/Node/browser APIs so both runtimes can import it.
 */

// NOTE: the explicit `.ts` extension is required by Deno (this module is imported by the
// `evaluate-hybrid-job` Edge Function) and is permitted on the Vite/Vitest side by
// `allowImportingTsExtensions` in tsconfig.json.
import {
  computeRecommendation,
  perQuestionAverageToOverallScore,
  type Recommendation,
} from "./scoringPolicy.ts";

/**
 * Per-question evaluation result. Contains the LLM's raw scoring fields
 * (accuracy, conceptUnderstanding, etc.) plus frontend-mapped fields
 * (score, questionText, feedback, analysis) that QuestionCard reads.
 *
 * The `accuracy` field is kept on the 0-10 scale for:
 *   - averagePerQuestionAccuracy() aggregation
 *   - databaseUpdater backfill of session_responses.content_score
 *
 * The `score` field is the same value, exposed under the name that
 * SessionReportView's QuestionCard reads.
 */
export interface HybridQuestionResult {
  /** Per-question score on a 0-10 scale (raw LLM field). */
  accuracy?: number;
  /** Per-question score on a 0-10 scale (frontend alias for accuracy). */
  score?: number;
  /** Question text from the original session data. */
  questionText?: string;
  /** Difficulty level (defaults to 'medium'). */
  difficulty?: string;
  /** Candidate's answer / transcript. */
  userAnswer?: string;
  /** Structured feedback for the frontend. */
  feedback?: {
    observation?: string;
    demonstrated?: string[];
    gaps?: string[];
    nextSteps?: string[];
  };
  /** Dimension scores on 0-10 scale. */
  analysis?: {
    understanding?: number;
    reasoning?: number;
    coverage?: number;
    communication?: number;
  };
  /** Concepts the candidate mentioned. */
  mentionedConcepts?: string[];
  /** Concepts the candidate explained. */
  explainedConcepts?: string[];
  /** Key points the candidate missed. */
  missingKeyPoints?: string[];
  /** Technical errors — raw LLM objects or already-stringified entries. */
  technicalErrors?: (string | { error?: string; severity?: string; explanation?: string; [k: string]: unknown })[];
  /** Catch-all for any additional LLM fields. */
  [key: string]: unknown;
}

/** Original response data from the session, used to populate questionText and userAnswer. */
export interface ResponseData {
  questionText?: string;
  question?: string;
  text?: string;
  type?: string;
  answer?: string;
  candidate_answer?: string;
  transcript?: string;
}

export interface HybridReport {
  reportType: "final_ai";
  evaluationStatus: "COMPLETED";
  executiveSummary: {
    recommendation: Recommendation;
    /** 0-100 */
    technicalScore: number;
    summary: string;
  };
  overallScores: {
    /** 0-100 */
    knowledgeScore: number;
    /** 0-100 */
    trustAdjustedScore: number;
    /** 0-100 */
    difficultyWeightedPerformance: number;
  };
  questionBreakdown: HybridQuestionResult[];
}

/**
 * Average the per-question `accuracy` values (0-10) returned by the LLM.
 * Missing/non-numeric entries count as 0, matching the previous `(r.accuracy || 0)` behaviour.
 */
export function averagePerQuestionAccuracy(results: readonly HybridQuestionResult[]): number {
  if (!results || results.length === 0) return 0;
  let total = 0;
  for (const r of results) {
    const v = typeof r?.accuracy === "number" && Number.isFinite(r.accuracy) ? r.accuracy : 0;
    total += v;
  }
  return total / results.length;
}

/**
 * Map a single raw LLM result to the frontend-expected questionBreakdown shape.
 *
 * The LLM returns fields like `accuracy`, `conceptUnderstanding`, `reasoning`,
 * `clarity`, `positiveEvidence`, `missingKeyPoints`. The frontend's QuestionCard
 * reads `score`, `analysis.understanding`, `analysis.reasoning`, `analysis.coverage`,
 * `analysis.communication`, `feedback.observation`, `feedback.gaps`, etc.
 *
 * @param raw       Raw LLM result (contains `accuracy` and dimension scores).
 * @param response  Original session response data (contains `questionText`, `answer`).
 * @param index     0-based question index (used for fallback labels).
 */
function mapToQuestionBreakdown(
  raw: HybridQuestionResult,
  response: ResponseData | undefined,
  index: number,
): HybridQuestionResult {
  const accuracy = typeof raw.accuracy === 'number' ? raw.accuracy : 5;
  const type = (response as any)?.type ?? 'Technical';

  // ── Feedback ──
  const mentionedConcepts = raw.mentionedConcepts ?? [];
  const explainedConcepts = raw.explainedConcepts ?? [];
  const missingKeyPoints = raw.missingKeyPoints ?? [];

  // Stringify technicalErrors (LLM returns [{error, severity}], frontend expects string[])
  const rawErrors = raw.technicalErrors ?? [];
  const technicalErrors: string[] = (Array.isArray(rawErrors) ? rawErrors : [])
    .map((err: any) => {
      if (typeof err === 'string') return err;
      if (err && typeof err === 'object') return err.error || err.explanation || '';
      return '';
    })
    .filter((s: string) => s.trim().length > 0);

  const positiveEvidence = raw.positiveEvidence as any ?? {};

  // Build observation from the strongest evidence signals
  const observationParts: string[] = [];
  if (explainedConcepts.length > 0) {
    observationParts.push(`Explained: ${explainedConcepts.slice(0, 3).join(', ')}`);
  }
  if (missingKeyPoints.length > 0) {
    observationParts.push(`Missed: ${missingKeyPoints.slice(0, 3).join(', ')}`);
  }
  if (technicalErrors.length > 0) {
    observationParts.push(`Errors: ${technicalErrors.slice(0, 2).join('; ')}`);
  }
  if (positiveEvidence.strongExample) observationParts.push('Provided strong example');
  if (positiveEvidence.realProject) observationParts.push('Referenced real project experience');
  if (positiveEvidence.tradeoffDiscussion) observationParts.push('Discussed trade-offs');

  const observation = observationParts.length > 0
    ? observationParts.join('. ') + '.'
    : (accuracy >= 7
      ? 'Solid answer with good conceptual coverage.'
      : accuracy >= 5
        ? 'Basic understanding demonstrated, some gaps in depth.'
        : 'Significant gaps in understanding or incomplete response.');

  const demonstrated = [
    ...(explainedConcepts.length > 0 ? ['Conceptual understanding'] : []),
    ...(accuracy >= 7 ? ['Clear explanation'] : []),
    ...(positiveEvidence.practicalExperience ? ['Practical experience'] : []),
    ...(positiveEvidence.tradeoffDiscussion ? ['Trade-off analysis'] : []),
  ];

  const gaps = [
    ...missingKeyPoints,
    ...(technicalErrors.length > 0 ? ['Technical accuracy issues'] : []),
  ];

  const nextSteps: string[] = [];
  if (missingKeyPoints.length > 0) {
    nextSteps.push(`Review: ${missingKeyPoints.slice(0, 2).join(', ')}`);
  }
  if (technicalErrors.length > 0) {
    nextSteps.push('Address technical misconceptions');
  }
  if (accuracy < 7) {
    nextSteps.push('Practice explaining concepts with concrete examples');
  }

  // ── Analysis dimensions (LLM dimension scores are 0-10, matching frontend) ──
  const understanding = typeof raw.conceptUnderstanding === 'number' ? raw.conceptUnderstanding : accuracy;
  const reasoningVal = typeof raw.reasoning === 'number' ? raw.reasoning : accuracy;
  const coverage = typeof raw.depth === 'number' ? raw.depth : accuracy;
  const communication = typeof raw.clarity === 'number' ? raw.clarity : accuracy;

  return {
    ...raw,
    // Frontend-mapped fields
    score: accuracy,
    questionText: response?.questionText || (response as any)?.question || (response as any)?.text || `Question ${index + 1}`,
    difficulty: type.toLowerCase() === 'behavioral' ? 'medium' : 'medium',
    userAnswer: response?.answer || (response as any)?.candidate_answer || (response as any)?.transcript || '',
    feedback: {
      observation,
      demonstrated,
      gaps,
      nextSteps,
    },
    analysis: {
      understanding,
      reasoning: reasoningVal,
      coverage,
      communication,
    },
    mentionedConcepts,
    explainedConcepts,
    missingKeyPoints,
    technicalErrors,
  };
}

/**
 * Build the HYBRID final report.
 *
 * @param results        Per-question LLM results (`accuracy` on a 0-10 scale).
 * @param integrityScore Proctoring integrity on a 0-100 scale. Defaults to 100 because the
 *   Edge Function does not currently load proctoring data — see the note in the audit; until
 *   it does, HYBRID cannot apply the `integrityScore < 40` hard floor that LOCAL applies.
 * @param responsesData  Original session response data for populating questionText/userAnswer.
 */
export function buildHybridReport(
  results: readonly HybridQuestionResult[],
  integrityScore = 100,
  responsesData?: readonly ResponseData[],
): HybridReport {
  const averageAccuracy = averagePerQuestionAccuracy(results);
  const overallScore = perQuestionAverageToOverallScore(averageAccuracy);
  const recommendation = computeRecommendation(overallScore, integrityScore);

  return {
    reportType: "final_ai",
    evaluationStatus: "COMPLETED",
    executiveSummary: {
      recommendation,
      technicalScore: overallScore,
      summary: `Evaluated ${results.length} questions.`,
    },
    overallScores: {
      knowledgeScore: overallScore,
      trustAdjustedScore: overallScore,
      difficultyWeightedPerformance: overallScore,
    },
    questionBreakdown: results.map((r, i) => mapToQuestionBreakdown(r, responsesData?.[i], i)),
  };
}
