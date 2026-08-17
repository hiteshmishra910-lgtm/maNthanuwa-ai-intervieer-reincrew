import React from 'react';
import { FileQuestion } from 'lucide-react';

/**
 * PHASE 9 — shown when a session has no stored evaluation.
 *
 * Both the candidate view (CompletedInterviews) and the recruiter view (HRDashboard) previously
 * responded to a missing `evaluation_logic` by constructing a complete report out of constants:
 *
 *     technicalScore:   selectedSession.overall_score || 50      // invented 50/100
 *     trustScore:       100 - (selectedSession.risk_score || 0)  // 100 = flawless integrity
 *     reportConfidence: 'Medium'                                 // hardcoded
 *     proctoringSummary: { faceAwayEvents: 0, tabSwitches: 0, ... } // clean record, fabricated
 *     performanceTrend:  { trend: 'stable' }                     // hardcoded
 *
 * It was rendered identically to a real report, with no indication anything was missing. A
 * recruiter saw a candidate scored 50/100 with perfect integrity and no proctoring violations —
 * none of it derived from that candidate. `||` also meant a genuine score of 0 displayed as 50.
 *
 * In production 85 of 122 sessions have overall_score = NULL, so this fired for most data.
 *
 * Showing nothing is strictly better than showing a plausible fabrication, because a reader
 * cannot tell the difference and may act on it.
 */

export type EvaluationUnavailableReason = 'not-evaluated' | 'evaluation-failed' | 'in-progress';

interface EvaluationUnavailableProps {
  reason?: EvaluationUnavailableReason;
  /** Shown verbatim when the backend recorded why evaluation failed. */
  detail?: string | null;
  candidateName?: string | null;
  onRetry?: () => void;
}

const COPY: Record<EvaluationUnavailableReason, { title: string; body: string }> = {
  'not-evaluated': {
    title: 'No evaluation available',
    body: 'This interview has not been evaluated, so there are no scores or feedback to show yet.',
  },
  'evaluation-failed': {
    title: 'Evaluation did not complete',
    body: 'The evaluation for this interview failed to finish. The answers are stored and can be re-evaluated.',
  },
  'in-progress': {
    title: 'Evaluation in progress',
    body: 'This interview is still being evaluated. Scores will appear here once it completes.',
  },
};

export const EvaluationUnavailable: React.FC<EvaluationUnavailableProps> = ({
  reason = 'not-evaluated',
  detail,
  candidateName,
  onRetry,
}) => {
  const { title, body } = COPY[reason];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-5 border border-slate-200">
        <FileQuestion size={26} className="text-slate-400" />
      </div>

      <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mb-5">
        {candidateName ? `${candidateName}: ` : ''}{body}
      </p>

      {detail && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 max-w-md w-full mb-5">
          <p className="text-xs text-slate-500 font-mono wrap-break-word">{detail}</p>
        </div>
      )}

      {/*
        Deliberately no scores, no charts, no "0" placeholders and no proctoring summary.
        Rendering a zero here would be read as "the candidate scored zero", which is a different
        and equally wrong claim to the fabricated 50 this replaced.
      */}
      <p className="text-xs text-slate-400 max-w-md">
        No scores are shown because none were recorded for this session.
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
};

/**
 * True when a session row carries a usable stored evaluation.
 *
 * Guards against the empty-object case as well as null/undefined: an upsert that wrote `{}`
 * would otherwise pass a truthiness check and render a report with every field undefined.
 */
export function hasStoredEvaluation(session: { evaluation_logic?: unknown } | null | undefined): boolean {
  let logic = session?.evaluation_logic;
  if (!logic) return false;
  if (typeof logic === 'string') {
    try {
      logic = JSON.parse(logic);
    } catch (_) {
      return false;
    }
  }
  if (!logic || typeof logic !== 'object') return false;
  return Object.keys(logic as Record<string, unknown>).length > 0;
}
