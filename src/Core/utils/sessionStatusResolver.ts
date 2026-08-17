export enum SessionEffectiveStatus {
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  FAILED = 'FAILED',
  IN_PROGRESS = 'IN_PROGRESS',
}

export enum EvaluationModeType {
  LOCAL = 'LOCAL',
  HYBRID = 'HYBRID',
  API = 'API',
  UNKNOWN = 'UNKNOWN',
}

export type EffectiveEvaluationMode = 'API' | 'LOCAL' | 'HYBRID' | 'API_FALLBACK';

export interface NormalizedSessionViewModel {
  effectiveStatus: SessionEffectiveStatus;
  displayStatusText: string;
  displayScoreText: string;
  displayRecommendation: string;
  evalMode: EvaluationModeType;
  isUnattempted: boolean;
}

export const SCORE_PLACEHOLDER = '—';
export const STATUS_LABELS = {
  PENDING_EVALUATION: 'Pending Evaluation',
  PROCESSING_EVALUATION: 'Evaluating...',
  FAILED_EVALUATION: 'Evaluation Failed',
  NOT_ATTEMPTED: 'Not Attempted',
  IN_PROGRESS: 'In Progress',
  TERMINATED: 'Terminated',
} as const;

export interface SessionStatusInput {
  session_status?: string | null;
  status?: string | null;
  questions_answered?: number | null;
  questionsAnswered?: number | null;
  results?: Array<{ userAnswer?: string | null }> | null;
  overall_score?: number | null;
  overallScore?: number | null;
  total_score?: number | null;
  recommendation?: string | null;
  hiring_recommendation?: string | null;
  jobStatus?: string | null;
  job_status?: string | null;
  evaluation_jobs?: Array<{ status?: string | null; created_at?: string | null; last_attempt_at?: string | null }> | { status?: string | null } | null;
  evaluationReport?: Record<string, any> | null;
  evaluation_logic?: Record<string, any> | null;
  interview_metadata?: Record<string, any> | null;
  job_settings_snapshot?: Record<string, any> | null;
  evaluationMode?: string | null;
  evaluation_mode?: string | null;
  [key: string]: any;
}

export function normalizeScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 && value <= 100 ? Math.round(value) : null;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.round(parsed) : null;
  }
  return null;
}

export function resolveCanonicalOverallScore(sessionOrReport: any): number | null {
  if (!sessionOrReport) return null;
  const candidates = [
    sessionOrReport.overall_score,
    sessionOrReport.overallScore,
    sessionOrReport.total_score,
    sessionOrReport.totalScore,
    sessionOrReport.layer1_snapshot?.overallScore,
    sessionOrReport.evaluation_logic?.overallScores?.trustAdjustedScore,
    sessionOrReport.overallScores?.trustAdjustedScore,
    sessionOrReport.evaluation_logic?.finalScore,
    sessionOrReport.finalScore,
    sessionOrReport.evaluation_report?.total_score,
    sessionOrReport.evaluation_report?.overall_score,
    sessionOrReport.evaluationReport?.total_score,
    sessionOrReport.evaluationReport?.overall_score,
    sessionOrReport.evaluationReport?.evaluation_logic?.overallScores?.trustAdjustedScore,
    sessionOrReport.evaluationReport?.evaluation_logic?.finalScore,
  ];

  for (const val of candidates) {
    const norm = normalizeScore(val);
    if (norm !== null) return norm;
  }
  return null;
}

export const extractSessionScore = resolveCanonicalOverallScore;

export function getDisplayEvalMode(mode: EffectiveEvaluationMode | string): string {
  if (!mode) return 'UNKNOWN';
  const norm = String(mode).toUpperCase();
  if (norm.includes('FALLBACK') || norm.includes('API_FALLBACK')) return 'API (Fallback)';
  if (norm.includes('HYBRID')) return 'HYBRID';
  if (norm.includes('API') || norm.includes('INTERACTIVE') || norm === 'AI') return 'API';
  if (norm.includes('LOCAL') || norm.includes('NEEDLE')) return 'LOCAL';
  return String(mode);
}

export const resolveSessionViewModel = (session?: SessionStatusInput | null): NormalizedSessionViewModel => {
  if (!session) {
    return {
      effectiveStatus: SessionEffectiveStatus.IN_PROGRESS,
      displayStatusText: SessionEffectiveStatus.IN_PROGRESS,
      displayScoreText: SCORE_PLACEHOLDER,
      displayRecommendation: STATUS_LABELS.IN_PROGRESS,
      evalMode: EvaluationModeType.UNKNOWN,
      isUnattempted: true,
    };
  }

  // 1. Questions answered calculation
  const questionsAnswered = Number(
    session.questions_answered ??
      session.questionsAnswered ??
      (Array.isArray(session.results)
        ? session.results.filter((r) => r?.userAnswer && String(r.userAnswer).trim().length > 0).length
        : 0)
  );

  const rawStatus = String(session.session_status || session.status || 'IN_PROGRESS').toUpperCase();
  const evaluationLogic = session.evaluation_logic || session.evaluationReport?.evaluation_logic;

  // 2. Timestamp-Sorted Background Job Status Resolution (last_attempt_at > created_at > fallback)
  let activeJobStatus: string | null = null;
  if (Array.isArray(session.evaluation_jobs) && session.evaluation_jobs.length > 0) {
    const sorted = [...session.evaluation_jobs].sort((a, b) => {
      const timeA = new Date(a.last_attempt_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_attempt_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
    activeJobStatus = sorted[0]?.status ?? null;
  } else if (session.evaluation_jobs && typeof session.evaluation_jobs === 'object' && 'status' in session.evaluation_jobs) {
    activeJobStatus = session.evaluation_jobs.status ?? null;
  }

  const rawJobStatus = String(
    activeJobStatus ||
    session.jobStatus ||
    session.job_status ||
    evaluationLogic?.evaluationStatus ||
    evaluationLogic?.evaluation_status ||
    ''
  ).toUpperCase();

  // 3. Precedence Hierarchy Decision Engine
  let effectiveStatus: SessionEffectiveStatus = SessionEffectiveStatus.IN_PROGRESS;

  if (rawStatus === 'TERMINATED') {
    effectiveStatus = SessionEffectiveStatus.TERMINATED;
  } else if (rawJobStatus === 'QUEUED' || rawJobStatus === 'FAILED_RETRYABLE') {
    effectiveStatus = SessionEffectiveStatus.QUEUED;
  } else if (rawJobStatus === 'PROCESSING') {
    effectiveStatus = SessionEffectiveStatus.PROCESSING;
  } else if (rawJobStatus === 'FAILED' || rawJobStatus === 'FAILED_PERMANENT') {
    effectiveStatus = SessionEffectiveStatus.FAILED;
  } else if (rawStatus === 'COMPLETED' || (rawStatus === 'CREATED' && questionsAnswered > 0)) {
    effectiveStatus = SessionEffectiveStatus.COMPLETED;
  } else {
    effectiveStatus = SessionEffectiveStatus.IN_PROGRESS;
  }

  const isUnattempted = questionsAnswered === 0 && !evaluationLogic;

  // 4. Resolve Evaluation Mode
  const modeVal =
    session?.evaluationReport?.evaluation_logic?.metadata?.evaluationMode ||
    session?.evaluationReport?.evaluation_logic?.metadata?.mode ||
    session?.evaluation_logic?.metadata?.evaluationMode ||
    session?.evaluation_logic?.metadata?.mode ||
    session?.evaluation_mode ||
    session?.interview_metadata?.job_settings_snapshot?.evaluationMode ||
    session?.interview_metadata?.evaluationMode ||
    session?.job_settings_snapshot?.evaluationMode ||
    session?.evaluationMode;

  let evalMode: EvaluationModeType = EvaluationModeType.UNKNOWN;
  if (modeVal) {
    const norm = String(modeVal).toUpperCase();
    if (norm.includes('HYBRID')) evalMode = EvaluationModeType.HYBRID;
    else if (norm.includes('API') || norm.includes('INTERACTIVE') || norm === 'AI') evalMode = EvaluationModeType.API;
    else if (norm.includes('LOCAL') || norm.includes('NEEDLE')) evalMode = EvaluationModeType.LOCAL;
  }

  if (evalMode === EvaluationModeType.UNKNOWN) {
    const provider =
      session?.evaluationReport?.evaluation_logic?.metadata?.provider ||
      session?.evaluation_logic?.metadata?.provider;
    if (provider === 'openrouter') evalMode = EvaluationModeType.API;
    else if (provider === 'local-heuristic') evalMode = EvaluationModeType.LOCAL;
  }

  // 5. Display Score Precedence
  let displayScoreText = SCORE_PLACEHOLDER;
  if (effectiveStatus === SessionEffectiveStatus.COMPLETED && !isUnattempted) {
    const score = extractSessionScore(session);
    if (score !== null) {
      displayScoreText = `${score}%`;
    }
  }

  // 6. Display Status Text & Recommendation
  let displayStatusText: string = effectiveStatus;
  let displayRecommendation = session.recommendation || session.hiring_recommendation || STATUS_LABELS.PENDING_EVALUATION;

  if (effectiveStatus === SessionEffectiveStatus.TERMINATED) {
    displayStatusText = isUnattempted ? 'TERMINATED (Incomplete)' : 'TERMINATED';
    displayRecommendation = isUnattempted ? 'TERMINATED (Incomplete)' : (session.recommendation || STATUS_LABELS.TERMINATED);
  } else if (effectiveStatus === SessionEffectiveStatus.QUEUED) {
    displayStatusText = 'QUEUED';
    displayRecommendation = STATUS_LABELS.PENDING_EVALUATION;
  } else if (effectiveStatus === SessionEffectiveStatus.PROCESSING) {
    displayStatusText = 'PROCESSING';
    displayRecommendation = STATUS_LABELS.PROCESSING_EVALUATION;
  } else if (effectiveStatus === SessionEffectiveStatus.FAILED) {
    displayStatusText = 'FAILED';
    displayRecommendation = STATUS_LABELS.FAILED_EVALUATION;
  } else if (isUnattempted) {
    displayRecommendation = STATUS_LABELS.NOT_ATTEMPTED;
  }

  return {
    effectiveStatus,
    displayStatusText,
    displayScoreText,
    displayRecommendation,
    evalMode,
    isUnattempted,
  };
};
