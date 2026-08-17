import React from 'react';
import { RotateCcw, Home, TrendingUp, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '../../Core/components/Logo';
import { PracticeCandidate, PracticeDifficulty } from '../hooks/usePracticeSession';
import { CompletionViewModel, InterviewRoles } from '../../../types';

interface PracticeEndScreenProps {
  candidate: PracticeCandidate;
  completionViewModel: CompletionViewModel | null;
  history: { question: string; answer: string; ideal_answer: string; evaluation?: any }[];
  onPracticeAgain: () => void;
  onHome: () => void;
}

const DIFFICULTY_LABEL: Record<PracticeDifficulty, string> = {
  easy:   'Beginner',
  medium: 'Intermediate',
  hard:   'Advanced',
};

const scoreColor = (score: number) => {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

const scoreBg = (score: number) => {
  if (score >= 75) return 'bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-rose-50 border-rose-200';
};

const scoreLabel = (score: number) => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Needs Work';
  return 'Keep Practicing';
};

export const PracticeEndScreen: React.FC<PracticeEndScreenProps> = ({
  candidate,
  completionViewModel,
  history,
  onPracticeAgain,
  onHome,
}) => {
  const { practiceConfig } = candidate;
  const [liveReport, setLiveReport] = React.useState<any>(completionViewModel?.report || null);
  const [processedQuestions, setProcessedQuestions] = React.useState<number>(0);
  const [totalQuestions, setTotalQuestions] = React.useState<number>(history.length || 10);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);

  const currentSessionId = sessionStorage.getItem('current_session_id') || candidate?.session?.id || "N/A";

  React.useEffect(() => {
    if (liveReport || currentSessionId === "N/A") return;

    let isSubscribed = true;

    const checkState = async () => {
      try {
        const { supabase } = await import('../../Core/database/supabaseClient');
        const { SupabaseService } = await import('../../Core/database/supabaseService');

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

        const fetchedReport = await SupabaseService.getEvaluationReport(currentSessionId);
        if (fetchedReport && isSubscribed) {
          setLiveReport(fetchedReport);
        }
      } catch (e) {
        console.warn('[PracticeEndScreen] Error checking session state:', e);
      }
    };

    checkState();

    let channel: any = null;
    import('../../Core/database/supabaseClient').then(({ supabase }) => {
      channel = supabase
        .channel(`practice_eval_${currentSessionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluation_jobs', filter: `session_id=eq.${currentSessionId}` }, (payload) => {
          if (!isSubscribed) return;
          const newJob = payload.new as any;
          if (newJob) {
            setJobStatus(newJob.status || 'PROCESSING');
            if (typeof newJob.processed_questions === 'number') setProcessedQuestions(newJob.processed_questions);
            if (typeof newJob.total_questions === 'number' && newJob.total_questions > 0) setTotalQuestions(newJob.total_questions);
          }
          checkState();
        })
        .subscribe();
    });

    const interval = setInterval(checkState, 3000);

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

  const report = liveReport || ((completionViewModel?.mode === 'report' || completionViewModel?.mode === 'queued') ? completionViewModel.report : null);

  const technicalScore = report?.executiveSummary?.technicalScore ?? null;
  const commScore      = report?.overallScores?.communicationScore ?? null;
  const topicCoverage  = report?.executiveSummary?.topicCoverage ?? null;
  const strengths      = report?.strengths?.slice(0, 3) ?? [];
  const weaknesses     = report?.weaknesses?.slice(0, 3) ?? [];
  const improvements   = report?.topImprovements?.slice(0, 3) ?? [];
  const trend          = report?.performanceTrend?.trend ?? null;
  const roleName       = InterviewRoles[practiceConfig.role] ?? practiceConfig.role;

  // ── Queued / Processing state without completed report ─────────────────────
  if (!report && (completionViewModel?.mode === 'queued' || jobStatus === 'QUEUED' || jobStatus === 'PROCESSING')) {
    const progressPercent = Math.min(100, Math.max(5, Math.round((processedQuestions / Math.max(1, totalQuestions)) * 100)));

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-8 gap-6 text-center">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center shadow-md">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        <div className="w-full max-w-xs">
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-black uppercase tracking-wider inline-block mb-3">
            Practice AI Evaluation
          </span>
          <h2 className="text-2xl font-bold text-slate-800">Evaluating Practice Session…</h2>
          
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner mt-4">
            <div 
              className="bg-indigo-600 h-full transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-slate-600 font-bold text-xs mt-2">
            Question {processedQuestions} of {totalQuestions} evaluated ({progressPercent}%)
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onPracticeAgain} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-500 transition-all flex items-center gap-2">
            <RotateCcw size={16} /> Practice Again
          </button>
          <button onClick={onHome} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">
            Home
          </button>
        </div>
      </div>
    );
  }

  // ── Processing state ──────────────────────────────────────────────────────
  if (!completionViewModel || completionViewModel.mode === 'processing') {
    const elapsed = completionViewModel?.processingElapsedMs ?? 0;
    const seconds = Math.floor(elapsed / 1000);
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-8 gap-6">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100">
          <Logo className="w-10 h-10" />
        </div>
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">Evaluating your responses…</h2>
          <p className="text-slate-500 text-sm mt-1">
            {seconds < 10 ? 'Analysing answers…' : seconds < 30 ? 'Running evaluation pipeline…' : 'Almost there…'}
          </p>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onPracticeAgain} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-500 transition-all flex items-center gap-2">
            <RotateCcw size={16} /> Practice Again
          </button>
          <button onClick={onHome} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">
            Home
          </button>
        </div>
      </div>
    );
  }

  // ── Failed state ──────────────────────────────────────────────────────────
  if (completionViewModel.mode === 'failed') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-8 gap-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <div>
          <h2 className="text-xl font-bold text-slate-800">Evaluation unavailable</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-xs">
            We couldn't generate a full report this time. Your responses were saved — try practicing again.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onPracticeAgain} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-500 transition-all flex items-center gap-2">
            <RotateCcw size={16} /> Practice Again
          </button>
          <button onClick={onHome} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">
            Home
          </button>
        </div>
      </div>
    );
  }

  // ── Report state ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md border border-slate-100 mx-auto mb-4">
            <Logo className="w-9 h-9" />
          </div>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.2em]">Practice Complete</p>
          <h1 className="text-3xl font-extrabold text-slate-900">Your Results</h1>
          <p className="text-slate-500 text-sm">
            {roleName} · {DIFFICULTY_LABEL[practiceConfig.difficulty]} · {practiceConfig.interviewType.charAt(0).toUpperCase() + practiceConfig.interviewType.slice(1)}
          </p>
        </div>

        {/* Score cards */}
        {technicalScore !== null && (
          <div className="grid grid-cols-3 gap-3 animate-in fade-in duration-700">
            {[
              { label: 'Technical',     value: technicalScore },
              { label: 'Communication', value: commScore },
              { label: 'Topic Coverage',value: topicCoverage },
            ].map(({ label, value }) => (
              value !== null ? (
                <div key={label} className={`rounded-2xl border p-4 text-center ${scoreBg(value)}`}>
                  <p className={`text-3xl font-black ${scoreColor(value)}`}>{Math.round(value)}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{label}</p>
                </div>
              ) : null
            ))}
          </div>
        )}

        {/* Overall verdict */}
        {technicalScore !== null && (
          <div className={`rounded-2xl border p-5 flex items-center justify-between ${scoreBg(technicalScore)}`}>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Overall</p>
              <p className={`text-xl font-black mt-0.5 ${scoreColor(technicalScore)}`}>
                {scoreLabel(technicalScore)}
              </p>
            </div>
            {trend && (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                <TrendingUp size={16} />
                {trend.charAt(0).toUpperCase() + trend.slice(1)}
              </div>
            )}
          </div>
        )}

        {/* Strengths & Weaknesses */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {strengths.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Strengths
                </p>
                <ul className="space-y-2">
                  {strengths.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700 leading-snug flex gap-2">
                      <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold text-rose-500 uppercase tracking-wide flex items-center gap-1.5">
                  <XCircle size={14} /> Areas to Improve
                </p>
                <ul className="space-y-2">
                  {weaknesses.map((w: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700 leading-snug flex gap-2">
                      <span className="text-rose-400 mt-0.5 shrink-0">•</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Improvement suggestions */}
        {improvements.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Top Suggestions</p>
            <ul className="space-y-2">
              {improvements.map((imp: string, i: number) => (
                <li key={i} className="text-sm text-slate-700 leading-snug flex gap-2">
                  <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Question breakdown (collapsed summary) */}
        {history.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Question Breakdown</p>
            <div className="space-y-3">
              {history.map((entry, i) => {
                const score = entry.evaluation?.contentScore ?? entry.evaluation?.analysis?.technicalAccuracy ?? null;
                return (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                    <span className="text-xs font-black text-slate-300 mt-0.5 w-5 shrink-0">Q{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 font-medium leading-snug truncate">{entry.question}</p>
                      {entry.evaluation?.verdict && (
                        <p className="text-xs text-slate-400 mt-0.5">{entry.evaluation.verdict}</p>
                      )}
                    </div>
                    {score !== null && (
                      <span className={`text-xs font-black shrink-0 ${scoreColor(score * 10)}`}>
                        {Math.round(score * 10)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
          <button
            onClick={onPracticeAgain}
            className="flex-1 bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base shadow-xl shadow-slate-200/50 transition-all flex items-center justify-center gap-3 active:scale-[0.99]"
          >
            <RotateCcw size={18} />
            Practice Again
          </button>
          <button
            onClick={onHome}
            className="sm:w-auto px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Home size={18} />
            Home
          </button>
        </div>

      </div>
    </div>
  );
};