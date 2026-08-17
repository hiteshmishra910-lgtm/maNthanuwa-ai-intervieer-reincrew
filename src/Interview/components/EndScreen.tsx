import React, { useEffect, useState } from 'react';
import { CompletionViewModel, ProctoringReport } from '../../../types';
import { Logo } from '../../Core/components/Logo';
import { SessionReportView } from '../../Analytics/components/SessionReportView';

interface EndScreenProps {
  candidate: { name: string; email: string; role: string };
  history: { question: string; answer: string; ideal_answer: string; difficulty?: string; category?: string }[];
  completionViewModel?: CompletionViewModel | null;
  proctoringReport?: ProctoringReport | null;
  onHome: () => void;
}

export const EndScreen: React.FC<EndScreenProps> = ({ candidate, completionViewModel, proctoringReport, onHome }) => {
  const [showFallback, setShowFallback] = useState(false);
  const [liveReport, setLiveReport] = useState<any>(completionViewModel?.report || null);
  const [processedQuestions, setProcessedQuestions] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const currentSessionId = sessionStorage.getItem('current_session_id') || "N/A";

  useEffect(() => {
    if (!completionViewModel) {
      const timer = window.setTimeout(() => setShowFallback(true), 12000);
      return () => window.clearTimeout(timer);
    }
    setShowFallback(false);
  }, [completionViewModel]);

  // Realtime-First Subscription with 3s Polling Fallback
  useEffect(() => {
    if (liveReport || currentSessionId === "N/A") return;

    let isSubscribed = true;

    // Helper to fetch report and state from database
    const checkSessionState = async () => {
      try {
        const { supabase } = await import('../../Core/database/supabaseClient');
        const { SupabaseService } = await import('../../Core/database/supabaseService');

        // Check evaluation_jobs for turn progress
        const { data: jobData } = await supabase
          .from('evaluation_jobs')
          .select('status, processed_questions, total_questions')
          .eq('session_id', currentSessionId)
          .maybeSingle();

        if (jobData && isSubscribed) {
          setJobStatus(jobData.status || 'QUEUED');
          if (typeof jobData.processed_questions === 'number') setProcessedQuestions(jobData.processed_questions);
          if (typeof jobData.total_questions === 'number' && jobData.total_questions > 0) setTotalQuestions(jobData.total_questions);
        }

        // Check if report is already saved
        const fetchedReport = await SupabaseService.getEvaluationReport(currentSessionId);
        if (fetchedReport && isSubscribed) {
          setLiveReport(fetchedReport);
        }
      } catch (err) {
        console.warn('[EndScreen] Error checking session state:', err);
      }
    };

    checkSessionState();

    // 1. Primary: Supabase Realtime Subscription
    let channel: any = null;
    import('../../Core/database/supabaseClient').then(({ supabase }) => {
      channel = supabase
        .channel(`session_eval_${currentSessionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'evaluation_jobs',
          filter: `session_id=eq.${currentSessionId}`
        }, (payload) => {
          if (!isSubscribed) return;
          const newJob = payload.new as any;
          if (newJob) {
            setJobStatus(newJob.status || 'PROCESSING');
            if (typeof newJob.processed_questions === 'number') setProcessedQuestions(newJob.processed_questions);
            if (typeof newJob.total_questions === 'number' && newJob.total_questions > 0) setTotalQuestions(newJob.total_questions);
          }
          checkSessionState();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'interview_sessions',
          filter: `id=eq.${currentSessionId}`
        }, (payload) => {
          if (!isSubscribed) return;
          const session = payload.new as any;
          if (session?.execution_status === 'REPORT_SAVED') {
            checkSessionState();
          }
        })
        .subscribe();
    });

    // 2. Secondary: 3-second Polling Fallback
    const interval = setInterval(checkSessionState, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (channel) {
        import('../../Core/database/supabaseClient').then(({ supabase }) => {
          supabase.removeChannel(channel);
        });
      }
    };
  }, [currentSessionId, liveReport]);

  const activeReport = liveReport || completionViewModel?.report;

  // Explicit failure precedence
  if (activeReport) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-24 px-6 py-10">
        <SessionReportView
          candidate={candidate}
          evalReport={activeReport}
          proctoringReport={proctoringReport}
          sessionId={currentSessionId}
          onHome={onHome}
          mode="candidate"
        />
      </div>
    );
  }

  if (completionViewModel?.mode === 'failed') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center border border-red-200">
          <span className="text-2xl font-black text-red-600">!</span>
        </div>
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Evaluation Unsuccessful</h2>
          <p className="text-slate-600 font-medium text-sm bg-red-50 p-4 rounded-xl border border-red-200 text-left font-mono">
            {completionViewModel.errorReason || "We encountered an error while processing your interview evaluation. Please check your system configuration or contact support."}
          </p>
        </div>
        <button
          onClick={onHome}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 shadow-md"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (completionViewModel?.mode === 'queued' || jobStatus === 'QUEUED' || jobStatus === 'PROCESSING') {
    const progressPercent = Math.min(100, Math.max(5, Math.round((processedQuestions / Math.max(1, totalQuestions)) * 100)));

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-8">
        <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl animate-pulse">
            ✓
          </div>
        </div>
        <div className="text-center space-y-3 max-w-md w-full">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-indigo-100 text-indigo-700">
            Hybrid AI Evaluation
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Generating AI Evaluation…</h2>
          
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner mt-4">
            <div 
              className="bg-indigo-600 h-full transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-slate-600 font-bold text-sm mt-2">
            Question {processedQuestions} of {totalQuestions} evaluated ({progressPercent}%)
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Server worker is evaluating your responses. You may close this tab — your report will be saved on your dashboard.
          </p>
        </div>
        <button
          onClick={onHome}
          className="rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 shadow-md hover:shadow-lg"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (completionViewModel?.mode === 'processing') {
    const isTakingLong = (completionViewModel.processingElapsedMs || 0) > 120000;
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-8">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Logo className="w-10 h-10" />
          </div>
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Interview Submitted</h2>
          <p className="text-slate-500 font-medium text-lg mt-2">
            Your evaluation is being processed. You'll be notified when it's ready.
          </p>
          {isTakingLong && (
            <p className="text-amber-600 font-medium mt-4 text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
              Still processing... taking longer than expected. You can close this window.
            </p>
          )}
        </div>
        <button
          onClick={onHome}
          className="rounded-xl bg-indigo-50 px-6 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 mt-8"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (showFallback) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <span className="text-2xl font-black text-amber-600">!</span>
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Waiting for response...</h2>
          <p className="text-slate-500 font-medium">
            The interview has ended, but we haven't received a final status yet. You can return home or try again later.
          </p>
        </div>
        <button
          onClick={onHome}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-8">
      <div className="relative">
        <div className="w-24 h-24 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Logo className="w-10 h-10" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Wrapping up...</h2>
        <p className="text-slate-500 font-medium">Finalizing your interview session.</p>
      </div>
    </div>
  );

};
