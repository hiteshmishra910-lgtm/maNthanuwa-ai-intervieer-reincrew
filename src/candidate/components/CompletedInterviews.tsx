import React, { useEffect, useState } from 'react';
import { Clock, AlertCircle, Loader2, Inbox } from 'lucide-react';
import { InterviewCard } from './InterviewCard';
import { SupabaseService } from '../../Core/database/supabaseService';
import { SessionReportView } from '../../Analytics/components/SessionReportView';
import { EvaluationUnavailable, hasStoredEvaluation } from '../../Analytics/components/EvaluationUnavailable';
import { getEffectiveSessionReport } from '../../Core/utils/reportReconstructor';
import { DemoDataService } from '../../Core/demo/demoDataService';
import { isDemoModeActive, subscribeDemoMode } from '../../Core/demo/demoMode';
import { sessionEvents } from '../../Core/events/sessionEvents';
import { sortSessionsRealFirst } from '../../Core/data/dataProvider';

interface CompletedInterviewsProps {
  candidateId: string;
  userEmail: string;
}

interface SessionRecord {
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  role: string;
  interview_date: string;
  duration_minutes: number | null;
  questions_asked: number | null;
  questions_answered: number | null;
  overall_score: number | null;
  risk_score: number | null;
  risk_level: string | null;
  recommendation: string | null;
  candidate_outcome: string | null;
  session_status: string;
  strengths: string[] | null;
  weaknesses: string[] | null;
  all_questions_and_answers?: any[];
  all_proctoring_events?: any[];
  evaluation_logic?: any;
  execution_status?: string;
  final_verdict?: string;
  verdict_justification?: string;
}

export const CompletedInterviews: React.FC<CompletedInterviewsProps> = ({ candidateId, userEmail }) => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);

  const getShowcaseSessions = () => {
    const demoSessions = DemoDataService.getDemoSessions();
    const pranitaSessions = demoSessions.filter(ds => ds.candidate_name.toLowerCase().includes('pranita'));
    const otherSessions = demoSessions.filter(ds => !ds.candidate_name.toLowerCase().includes('pranita'));
    const combined = [...pranitaSessions, ...otherSessions];

    return combined.map((ds) => ({
      session_id: ds.id,
      candidate_name: ds.candidate_name,
      candidate_email: userEmail || ds.candidate_email,
      role: (ds.evaluation_logic as any)?.role || ds.drive_title,
      interview_date: ds.date || '2026-08-12T14:00:00Z',
      duration_minutes: 25,
      questions_asked: ds.all_questions_and_answers?.length || 5,
      questions_answered: ds.all_questions_and_answers?.length || 5,
      overall_score: ds.overall_score,
      risk_score: ds.proctoringReport ? 100 - (ds.proctoringReport.integrityScore || 80) : 0,
      risk_level: ds.proctoringReport && ds.proctoringReport.integrityScore < 85 ? 'MEDIUM' : 'LOW',
      recommendation: ds.candidate_outcome,
      candidate_outcome: ds.candidate_outcome,
      session_status: ds.session_status,
      strengths: (ds.evaluation_logic?.executiveSummary as any)?.keyStrengths || [],
      weaknesses: (ds.evaluation_logic?.executiveSummary as any)?.areasForImprovement || [],
      all_questions_and_answers: ds.all_questions_and_answers || [],
      all_proctoring_events: ds.all_proctoring_events || [],
      evaluation_logic: ds.evaluation_logic,
      final_verdict: (ds.evaluation_logic?.executiveSummary as any)?.recommendation || 'Strong Hire',
    }));
  };

  useEffect(() => {
    const fetchSessions = async () => {
      const showcase = getShowcaseSessions() as SessionRecord[];

      if (!candidateId) {
        if (userEmail) {
          try {
            const candidate = await SupabaseService.getCandidateByEmail(userEmail);
            if (candidate?.id) {
              const data = await SupabaseService.getStudentSessions(candidate.id);
              const completed = sortSessionsRealFirst(
                data.filter(
                  (s: any) => s.session_status === 'COMPLETED' || s.session_status === 'TERMINATED' || s.session_status === 'QUEUED'
                )
              ) as SessionRecord[];

              if (!isDemoModeActive()) {
                setSessions(completed);
              } else {
                setSessions([...completed, ...showcase]);
              }
              setLoading(false);
              return;
            }
          } catch (fallbackErr: any) {
            if (fallbackErr?.code === '42501' || fallbackErr?.message?.includes('permission denied')) {
              setIsPermissionError(true);
            }
          }
        }
        setSessions(isDemoModeActive() ? showcase : []);
        setLoading(false);
        return;
      }

      try {
        const data = await SupabaseService.getStudentSessions(candidateId);
        const completed = sortSessionsRealFirst(
          data.filter(
            (s: any) => s.session_status === 'COMPLETED' || s.session_status === 'TERMINATED' || s.session_status === 'QUEUED'
          )
        ) as SessionRecord[];

        if (!isDemoModeActive()) {
          setSessions(completed);
        } else {
          setSessions([...completed, ...showcase]);
        }
      } catch (err: any) {
        setSessions(isDemoModeActive() ? showcase : []);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    const unsubDemo = subscribeDemoMode(() => fetchSessions());
    const unsubSession = sessionEvents.on(() => fetchSessions());
    return () => {
      unsubDemo();
      unsubSession();
    };
  }, [candidateId, userEmail]);

  // Auto-poll every 10s if any session is in QUEUED / IN_PROGRESS status
  useEffect(() => {
    const hasQueued = sessions.some(
      (s: any) => s.session_status === 'QUEUED' || (s.execution_status !== 'REPORT_SAVED' && s.evaluation_logic?.evaluationStatus === 'QUEUED')
    );
    if (!hasQueued) return;

    const interval = setInterval(async () => {
      try {
        if (candidateId) {
          const data = await SupabaseService.getStudentSessions(candidateId);
          if (data) {
            const completed = data.filter(
              (s: any) => s.session_status === 'COMPLETED' || s.session_status === 'TERMINATED' || s.session_status === 'QUEUED'
            );
            setSessions(completed as SessionRecord[]);
          }
        }
      } catch (pollErr) {
        console.warn('[CompletedInterviews] Polling update failed:', pollErr);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [sessions, candidateId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading your interviews...</p>
      </div>
    );
  }

  if (isPermissionError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <AlertCircle className="w-10 h-10 mb-4 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-500 mb-2">Database Permission Needed</h3>
        <p className="text-sm text-slate-400 text-center max-w-md mb-6">
          The database needs a small configuration fix to show your interview data.
          Ask your admin to run this SQL in the Supabase SQL Editor:
        </p>
        <div className="bg-slate-900 rounded-xl p-4 max-w-lg w-full overflow-x-auto">
          <code className="text-xs text-emerald-400 font-mono leading-relaxed block whitespace-pre">
{`CREATE POLICY "candidates_public_policy"
ON candidates FOR ALL
USING (true) WITH CHECK (true);`}
          </code>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          This is a one-time setup. Refresh the page after applying it.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <AlertCircle className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (selectedSession) {
    const isQueuedOrProcessing = selectedSession.session_status === 'QUEUED' ||
                                 selectedSession.session_status === 'IN_PROGRESS' ||
                                 (selectedSession.execution_status !== 'REPORT_SAVED' && selectedSession.evaluation_logic?.evaluationStatus === 'QUEUED');

    if (isQueuedOrProcessing) {
      return (
        <div className="space-y-6 animate-in fade-in duration-300">
          <button
            onClick={() => setSelectedSession(null)}
            className="mb-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to Interviews List
          </button>

          <div className="bg-white p-8 border border-slate-200 rounded-3xl shadow-sm max-w-xl mx-auto my-6 space-y-6 text-center">
            <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>

            <div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-black uppercase tracking-wider inline-block mb-3">
                Status: {selectedSession.session_status.toUpperCase()} (AI Batch Worker Processing)
              </span>
              <h3 className="text-2xl font-extrabold text-slate-900">Your AI Report is Being Generated</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed font-medium">
                Your assessment responses have been submitted! Our AI evaluation system is currently evaluating your answers and compiling your complete performance report.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-left text-xs space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Role:</span>
                <span className="font-bold text-slate-800">{selectedSession.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Submission Date:</span>
                <span className="font-bold text-slate-800">{new Date(selectedSession.interview_date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Duration:</span>
                <span className="font-bold text-indigo-600">1 - 3 minutes</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 italic">
              💡 Your status will update to <strong className="text-emerald-600 font-bold uppercase">COMPLETED</strong> automatically as soon as your report is ready.
            </p>

            <button
              onClick={() => setSelectedSession(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md"
            >
              Return to Interview List
            </button>
          </div>
        </div>
      );
    }

    const reportData = getEffectiveSessionReport(selectedSession);

    if (!reportData || (reportData as any)?._isMissingData) {
      return (
        <div>
          <button
            onClick={() => setSelectedSession(null)}
            className="mb-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Back
          </button>
          <EvaluationUnavailable
            reason={selectedSession.session_status === 'COMPLETED' ? 'evaluation-failed' : 'not-evaluated'}
            candidateName={selectedSession.candidate_name}
            detail={(reportData as any)?.reason}
          />
        </div>
      );
    }

    return (
      <div>
        <button
          onClick={() => setSelectedSession(null)}
          className="mb-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Completed Interviews
        </button>
        <SessionReportView
          candidate={{
            name: selectedSession.candidate_name,
            email: selectedSession.candidate_email,
            role: selectedSession.role,
            session: selectedSession,
          }}
          evalReport={reportData}
          mode="candidate"
        />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Inbox className="w-12 h-12 mb-4 text-slate-300" />
        <h3 className="text-lg font-semibold text-slate-500 mb-1">No Completed Interviews</h3>
        <p className="text-sm text-slate-400">Your completed interviews will appear here once you finish one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{sessions.length}</span> completed interview{sessions.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock size={12} />
          Most recent first
        </div>
      </div>
      {sessions.map((session) => {
        const isQueued = session.session_status === 'QUEUED' ||
                         session.session_status === 'IN_PROGRESS' ||
                         (session.execution_status !== 'REPORT_SAVED' && session.evaluation_logic?.evaluationStatus === 'QUEUED') ||
                         session.evaluation_logic?.evaluationStatus === 'PROCESSING';

        return (
          <InterviewCard
            key={session.session_id}
            role={session.role}
            date={session.interview_date}
            score={isQueued ? null : session.overall_score}
            status={isQueued ? 'QUEUED' : session.session_status}
            recommendation={isQueued ? null : session.recommendation}
            riskLevel={isQueued ? null : session.risk_level}
            strengths={isQueued ? null : session.strengths}
            weaknesses={isQueued ? null : session.weaknesses}
            durationMinutes={session.duration_minutes}
            questionsAnswered={session.questions_answered}
            onClick={() => setSelectedSession(session)}
          />
        );
      })}
    </div>
  );
};
