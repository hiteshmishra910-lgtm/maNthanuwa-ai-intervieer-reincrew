import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Loader2, AlertCircle } from 'lucide-react';
import { SupabaseService } from '../../Core/database/supabaseService';

/**
 * PHASE 15 — interviews the candidate has started but not completed.
 *
 * This component previously ignored its `candidateId` prop (declared `() =>`), queried nothing,
 * and rendered a fixed empty state telling students the feature "will be connected once the
 * scheduling system is defined".
 *
 * Its own comment already identified the available data: sessions in `CREATED` status. In
 * production 74 of 122 sessions sit in exactly that state, so students had unfinished interviews
 * they were never shown. That is now surfaced.
 *
 * Scheduled-date/reminder functionality genuinely does not exist — there is no scheduled_at on a
 * session — so this shows what is real (unfinished interviews) rather than promising a calendar
 * that was never built.
 */

interface UpcomingInterviewsProps {
  candidateId: string;
}

interface SessionRow {
  session_id: string;
  role: string | null;
  interview_date: string | null;
  session_status: string;
  questions_answered: number | null;
  questions_asked: number | null;
}

/** Sessions the candidate can still act on. */
const UNFINISHED = new Set(['CREATED', 'IN_PROGRESS']);

export const UpcomingInterviews: React.FC<UpcomingInterviewsProps> = ({ candidateId }) => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!candidateId) {
        if (!cancelled) { setSessions([]); setLoading(false); }
        return;
      }
      try {
        const data = await SupabaseService.getStudentSessions(candidateId);
        const pending = (data || []).filter((s: any) => UNFINISHED.has(s.session_status));
        if (!cancelled) setSessions(pending as SessionRow[]);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load your upcoming interviews.');
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
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <AlertCircle className="w-10 h-10 mb-3 text-amber-400" />
        <h3 className="text-base font-semibold text-slate-600 mb-1">Could not load</h3>
        <p className="text-sm text-slate-400 max-w-md text-center">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-5 border border-amber-100">
          <Calendar size={28} className="text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-500 mb-2">Nothing pending</h3>
        <p className="text-sm text-slate-400 text-center max-w-md">
          Interviews you have started but not finished will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{sessions.length}</span> unfinished
        interview{sessions.length !== 1 ? 's' : ''}
      </p>

      {sessions.map((s) => {
        const answered = s.questions_answered ?? 0;
        const asked = s.questions_asked ?? 0;
        const started = s.interview_date ? new Date(s.interview_date) : null;

        return (
          <div key={s.session_id} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h4 className="font-semibold text-slate-800 truncate">{s.role || 'Interview'}</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                  {started && !Number.isNaN(started.getTime()) && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} />
                      Started {started.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {asked > 0 && <span>{answered} of {asked} questions answered</span>}
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-100 whitespace-nowrap">
                {s.session_status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'NOT STARTED'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
