import React, { useEffect, useState } from 'react';
import { Briefcase, Clock, Loader2, AlertCircle } from 'lucide-react';
import { SupabaseService } from '../../Core/database/supabaseService';
import { useNavigate } from 'react-router-dom';

/**
 * PHASE 15 — assignments a recruiter has given this candidate.
 *
 * This component previously ignored its `candidateId` prop entirely (declared `() =>`), queried
 * nothing, and always rendered "Interviews assigned to you by HR or recruiters will appear here",
 * with a comment saying it was waiting for the assignment schema to be finalised.
 *
 * The schema had in fact existed since migration 20260722: `candidate_assignments`, complete with
 * status, deadline, attempt tracking and a drive relation. So a recruiter could assign an
 * interview, it would persist, and the candidate would be shown an empty state — the
 * recruiter-to-candidate handoff was silently broken at its final step.
 *
 * Reads `candidate_assignments` only. The competing `interview_assignments` table referenced by
 * some other read paths does not exist in production; consolidating those is tracked separately.
 */

interface AssignedInterviewsProps {
  candidateId: string;
}

interface AssignmentRow {
  id: string;
  drive_id: string;
  status: string;
  deadline: string | null;
  max_attempts: number;
  attempts_used: number;
  company_name: string | null;
  assigned_at: string;
  session_id: string | null;
  interview_drives?: { title?: string | null; status?: string | null; access_key?: string | null } | null;
}

/** Statuses that still require action from the candidate. */
const ACTIONABLE = new Set(['INVITED', 'VERIFIED', 'IN_PROGRESS']);

const STATUS_STYLE: Record<string, string> = {
  INVITED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  VERIFIED: 'bg-blue-50 text-blue-700 border-blue-100',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-100',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  ABSENT: 'bg-slate-100 text-slate-500 border-slate-200',
};

function formatDeadline(deadline: string | null): { text: string; overdue: boolean } {
  if (!deadline) return { text: 'No deadline', overdue: false };
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return { text: 'No deadline', overdue: false };
  const overdue = due.getTime() < Date.now();
  return {
    text: `${overdue ? 'Closed' : 'Due'} ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    overdue,
  };
}

export const AssignedInterviews: React.FC<AssignedInterviewsProps> = ({ candidateId }) => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!candidateId) {
        // No candidate record yet — not an error, simply nothing to show.
        if (!cancelled) { setAssignments([]); setLoading(false); }
        return;
      }
      try {
        const rows = await SupabaseService.getAssignmentsForCandidate(candidateId);
        if (!cancelled) setAssignments(rows as AssignmentRow[]);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load your assigned interviews.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading your assigned interviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <AlertCircle className="w-10 h-10 mb-3 text-amber-400" />
        <h3 className="text-base font-semibold text-slate-600 mb-1">Could not load assignments</h3>
        <p className="text-sm text-slate-400 max-w-md text-center">{error}</p>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5 border border-indigo-100">
          <Briefcase size={28} className="text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-500 mb-2">No assigned interviews</h3>
        <p className="text-sm text-slate-400 text-center max-w-md">
          When a recruiter assigns you an interview it will appear here. You can also join a drive
          directly using an access key.
        </p>
      </div>
    );
  }

  const actionable = assignments.filter((a) => ACTIONABLE.has(a.status)).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{assignments.length}</span> assigned
        interview{assignments.length !== 1 ? 's' : ''}
        {actionable > 0 && <> &middot; <span className="font-semibold text-indigo-600">{actionable}</span> awaiting you</>}
      </p>

      {assignments.map((a) => {
        const { text: deadlineText, overdue } = formatDeadline(a.deadline);
        const attemptsLeft = Math.max(0, (a.max_attempts ?? 1) - (a.attempts_used ?? 0));
        const title = a.interview_drives?.title || 'Interview';
        const isActionable = ACTIONABLE.has(a.status);

        return (
          <div key={a.id}
            onClick={isActionable ? async () => {
              const key = await SupabaseService.getAccessKeyForDrive(a.drive_id);
              if (key) {
                navigate('/join', { state: { prefillAccessKey: key } });
              }
            } : undefined}
            className={`bg-white border border-slate-200 rounded-2xl p-5 transition-colors ${
              isActionable ? 'hover:border-indigo-200 cursor-pointer' : 'opacity-60 cursor-default'
            }`}
            >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h4 className="font-semibold text-slate-800 truncate">{title}</h4>
                {a.company_name && <p className="text-sm text-slate-500 mt-0.5">{a.company_name}</p>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                  <span className={`flex items-center gap-1.5 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                    <Clock size={13} />
                    {deadlineText}
                  </span>
                  <span>
                    {attemptsLeft} of {a.max_attempts ?? 1} attempt{(a.max_attempts ?? 1) !== 1 ? 's' : ''} remaining
                  </span>
                </div>
              </div>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                  STATUS_STYLE[a.status] || STATUS_STYLE.ABSENT
                }`}
              >
                {a.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
