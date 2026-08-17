import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../../Core/database/supabaseClient';
import { DriveRepository } from '../../Core/database/driveRepository';
import { SessionReportView } from '../../Analytics/components/SessionReportView';
import {
  Users, LogOut, FileText, LayoutDashboard, ChevronRight,
  Loader2, TrendingUp, Award, AlertCircle, Inbox, Briefcase,
  Plus, Trash2, Calendar, CheckCircle2, Upload, ChevronDown, ChevronUp,
  Link2, Copy, UserCheck, Search,
} from 'lucide-react';
import { Logo } from '../../Core/components/Logo';
import { ensureFeedbackStructure, CandidateOutcome } from '../../../types';
import { EvaluationUnavailable, hasStoredEvaluation } from '../../Analytics/components/EvaluationUnavailable';
import { NotificationCenter } from '../../Core/components/NotificationCenter';
import { getEffectiveSessionReport } from '../../Core/utils/reportReconstructor';
import { ReportGenerator } from '../../Evaluation/pipeline/ReportGenerator';
import { resolveSessionViewModel, SCORE_PLACEHOLDER } from '../../Core/utils/sessionStatusResolver';
import { SupabaseService } from '@/src/Core/database/supabaseService';
import { DataProvider } from '../../Core/data/dataProvider';
import { DashboardCharts } from './DashboardCharts';
import { DemoBadge } from '../../Core/components/DemoBadge';
import { isDemoSessionId } from '../../Core/demo/demoGuards';
import { DemoDataService } from '../../Core/demo/demoDataService';
import { DEMO_SESSIONS } from '../../Core/demo/demoData';
import { DashboardSummary } from '../../Core/demo/demoTypes';
import { subscribeDemoMode } from '../../Core/demo/demoMode';
import { DemoToggleSwitch } from '../../Core/components/DemoToggleSwitch';
import { sessionEvents } from '../../Core/events/sessionEvents';
import '../styles/print.css';

interface HRDashboardProps {
  onLogout: () => void;
}

interface DriveCandidate {
  drive_id: string;
  drive_title: string;
  candidate_name: string;
  candidate_email: string;
  assignment_status: string;
  session_id: string | null;
  overall_score: number | null;
  session_status: string | null;
  session_completed_at: string | null;
  candidate_outcome?: 'PENDING' | 'SHORTLIST' | 'REJECT' | 'INTERVIEW_SCHEDULED';
}

interface DriveRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scheduled_at: string | null;
  total_candidates: number;
  completed_candidates: number;
  created_at: string;
  invited_count?: number;
  in_progress_count?: number;
  completed_count?: number;
}

interface SessionDetail {
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  drive_title: string;
  overall_score: number | null;
  session_status: string | null;
  evaluation_logic?: any;
  recommendation?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  risk_score?: number | null;
  final_verdict?: string;
  all_questions_and_answers?: any[];
  all_proctoring_events?: any[];
  candidate_outcome?: 'PENDING' | 'SHORTLIST' | 'REJECT' | 'INTERVIEW_SCHEDULED';
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT:      'bg-slate-100 text-slate-600',
  SCHEDULED:  'bg-blue-50 text-blue-700',
  ACTIVE:     'bg-emerald-50 text-emerald-700',
  COMPLETED:  'bg-indigo-50 text-indigo-700',
  ARCHIVED:   'bg-red-50 text-red-600',
};

const SCORE_COLOR = (score: number | null) => {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

const REC_STYLE = (rec: string | null | undefined) => {
  if (rec === 'Strong Hire' || rec === 'Hire') return 'bg-emerald-50 text-emerald-700';
  if (rec === 'Reject') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
};

export const HRDashboard: React.FC<HRDashboardProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();

  const initialTab = (['overview', 'candidates', 'reports', 'drives', 'assignments'].includes(searchParams.get('tab') ?? '')
    ? searchParams.get('tab')
    : 'overview') as 'overview' | 'candidates' | 'reports' | 'drives' | 'assignments';

  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'reports' | 'drives' | 'assignments'>(initialTab);
  const [driveCandidates, setDriveCandidates] = useState<DriveCandidate[]>([]);
  const [drives, setDrives] = useState<DriveRecord[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drivesLoading, setDrivesLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignFormDriveId, setAssignFormDriveId] = useState('');
  const [assignFormEmail, setAssignFormEmail] = useState('');
  const [assignFormCollegeId, setAssignFormCollegeId] = useState('');
  const [assignFormCompany, setAssignFormCompany] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedDrives, setExpandedDrives] = useState<Set<string>>(new Set());
  const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});
  const [copySuccess, setCopySuccess] = useState<string | null>(null);


  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

  const hrEmail = user?.primaryEmailAddress?.emailAddress ?? '';

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const summaryData = await DataProvider.getDashboardSummary();
        setDashboardSummary(summaryData);

        const candidates = await DataProvider.getCandidates();
        setDriveCandidates(candidates as DriveCandidate[]);
      } catch (err: any) {
        setError(err?.message || 'Failed to load candidates');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const unsubDemo = subscribeDemoMode(() => fetchAll());
    const unsubSession = sessionEvents.on(() => fetchAll());
    return () => {
      unsubDemo();
      unsubSession();
    };
  }, [hrEmail]);

  // ── Fetch drives ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'drives' || !hrEmail) return;
    const fetch = async () => {
      setDrivesLoading(true);
      try {
        const { data, error: dbError } = await supabase
          .from('interview_drives')
          .select('id, title, description, status, scheduled_at, total_candidates, completed_candidates, created_at')
          .eq('created_by', hrEmail)
          .neq('status', 'ARCHIVED')
          .order('created_at', { ascending: false });
        if (dbError) throw dbError;
        setDrives((data || []) as DriveRecord[]);
      } catch (err: any) {
        console.error('[HRDashboard] Failed to load drives:', err);
      } finally {
        setDrivesLoading(false);
      }
    };
    fetch();
  }, [activeTab, hrEmail]);

  // ── Fetch assignments ──────────────────────────────────────────────────────
  const fetchAssignments = async () => {
    if (!hrEmail) return;
    setAssignmentsLoading(true);
    try {
      const { data: hrDrives } = await supabase
        .from('interview_drives')
        .select('id')
        .eq('created_by', hrEmail);

      if (!hrDrives || hrDrives.length === 0) {
        setAssignments([]);
        return;
      }

      const driveIds = hrDrives.map(d => d.id);
      const { data, error: assignErr } = await supabase
        .from('candidate_assignments')
        .select('id, drive_id, candidate_id, college_email, college_id, status, deadline, max_attempts, attempts_used, company_name, assigned_at, session_id, interview_drives(title)')
        .in('drive_id', driveIds)
        .order('assigned_at', { ascending: false });

      if (assignErr) throw assignErr;
      const formatted = (data || []).map((a: any) => ({
        ...a,
        job_title: a.interview_drives?.title || 'Unknown Drive',
        candidate_email: a.college_email,
        candidate_name: a.college_id || a.college_email.split('@')[0],
      }));
      setAssignments(formatted);
    } catch (err: any) {
      console.error('[HRDashboard] Failed to load assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'assignments') {
      fetchAssignments();
    }
  }, [activeTab, hrEmail]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFormDriveId || !assignFormEmail) return;
    setAssignSubmitting(true);
    setAssignError(null);
    try {
      await SupabaseService.createAssignment({
        driveId: assignFormDriveId,
        candidateEmail: assignFormEmail.trim(),
        collegeId: assignFormCollegeId.trim() || undefined,
        assignedBy: hrEmail,
        companyName: assignFormCompany.trim() || undefined,
      });
      setShowAssignModal(false);
      setAssignFormEmail('');
      setAssignFormCollegeId('');
      setAssignFormCompany('');
      await fetchAssignments();
    } catch (err: any) {
      setAssignError(err.message || 'Failed to create assignment');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to cancel and remove this candidate assignment?')) return;
    try {
      await SupabaseService.deleteAssignment(assignmentId);
      await fetchAssignments();
    } catch (err: any) {
      alert('Failed to delete assignment: ' + (err.message || err));
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const completedSessions = driveCandidates.filter(
    (c) => c.session_status === 'COMPLETED' || c.session_status === 'TERMINATED'
  );
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((s, c) => s + (c.overall_score || 0), 0) / completedSessions.length)
    : 0;

  // Group candidates by drive for display
  const byDrive = driveCandidates.reduce<Record<string, DriveCandidate[]>>((acc, c) => {
    if (!acc[c.drive_id]) acc[c.drive_id] = [];
    acc[c.drive_id].push(c);
    return acc;
  }, {});

  const uniqueDrives = Object.keys(byDrive);

  // ── Toggle drive expand ────────────────────────────────────────────────────
  const toggleDrive = (driveId: string) => {
    setExpandedDrives((prev) => {
      const next = new Set(prev);
      if (next.has(driveId)) next.delete(driveId);
      else next.add(driveId);
      return next;
    });
  };

  const handleGetLink = async (driveId: string) => {
    try {
      await DriveRepository.publishDrive(driveId);
      const key = await SupabaseService.getAccessKeyForDrive(driveId);
      if (key) {
        const link = `${window.location.origin}/join?key=${key}`;
        setDriveLinks(prev => ({ ...prev, [driveId]: link }));
      } else {
        alert('No active access key found for this drive. Please regenerate one.');
      }
    } catch (err: any) {
      console.error('[HRDashboard] Failed to publish drive for link generation:', err);
      alert(err?.message || 'Failed to publish drive and generate link.');
    }
  };

const handleCopyLink = (driveId: string) => {
  const link = driveLinks[driveId];
  if (!link) return;
  navigator.clipboard.writeText(link);
  setCopySuccess(driveId);
  setTimeout(() => setCopySuccess(null), 2000);
};

  const handleViewSession = async (candidate: DriveCandidate) => {
    if (!candidate.session_id) return;
    if (isDemoSessionId(candidate.session_id)) {
      const demoReport = DemoDataService.getDemoSessionReport(candidate.session_id);
      const demoSession = DEMO_SESSIONS[candidate.session_id];
      setSelectedSession({
        session_id: candidate.session_id,
        candidate_name: candidate.candidate_name,
        candidate_email: candidate.candidate_email,
        drive_title: candidate.drive_title,
        overall_score: candidate.overall_score,
        session_status: candidate.session_status,
        evaluation_logic: demoReport,
        recommendation: demoReport?.executiveSummary?.recommendation || 'Strong Hire',
        strengths: demoReport?.executiveSummary?.keyStrengths || [],
        weaknesses: demoReport?.executiveSummary?.areasForImprovement || [],
        risk_score: demoSession?.proctoringReport?.overallRiskScore || 0,
        final_verdict: demoReport?.executiveSummary?.recommendation || 'Strong Hire',
        candidate_outcome: candidate.candidate_outcome ?? 'SHORTLIST',
        all_questions_and_answers: demoReport?.questionBreakdown || [],
        all_proctoring_events: demoSession?.all_proctoring_events || [],
      });
      return;
    }
    try {
      const [evalResult, responsesResult, proctoringResult] = await Promise.all([
        supabase
          .from('evaluation_reports')
          .select('*')
          .eq('session_id', candidate.session_id)
          .maybeSingle(),
        supabase
          .from('session_responses')
          .select('session_id, question_text, candidate_answer, content_score, grammar_score, fluency_score, verdict, feedback')
          .eq('session_id', candidate.session_id),
        supabase
          .from('proctoring_events')
          .select('*')
          .eq('session_id', candidate.session_id),
      ]);

      const data = evalResult.data;
      const responses = responsesResult.data || [];
      const proctoringEvents = proctoringResult.data || [];

      let rawLogic = data?.evaluation_logic ?? null;
      if (typeof rawLogic === 'string') {
        try { rawLogic = JSON.parse(rawLogic); } catch (_) {}
      }

      setSelectedSession({
        session_id: candidate.session_id,
        candidate_name: candidate.candidate_name,
        candidate_email: candidate.candidate_email,
        drive_title: candidate.drive_title,
        overall_score: data?.total_score ?? data?.overall_score ?? candidate.overall_score,
        session_status: candidate.session_status,
        evaluation_logic: rawLogic,
        recommendation: data?.hiring_recommendation ?? data?.recommendation ?? null,
        strengths: data?.strengths ?? null,
        weaknesses: data?.failures ?? data?.weaknesses ?? null,
        risk_score: data?.risk_score ?? null,
        final_verdict: data?.final_verdict ?? null,
        candidate_outcome: candidate.candidate_outcome ?? 'PENDING',
        all_questions_and_answers: responses.map((r: any) => ({
          question_text: r.question_text,
          candidate_answer: r.candidate_answer,
          content_score: r.content_score,
          grammar_score: r.grammar_score,
          fluency_score: r.fluency_score,
          verdict: r.verdict,
          feedback: ensureFeedbackStructure(r.feedback),
        })),
        all_proctoring_events: proctoringEvents.map((v: any) => ({
          type: v.event_type || v.type,
          severity: v.severity,
          message: v.detail || v.message,
          time: v.occurred_at || v.timestamp,
          snapshot_url: v.snapshot_url,
          clip_url: v.clip_url,
        })),
      });
    } catch (err: any) {
      console.error('Failed to load session details:', err);
      setError('Failed to load session details: ' + err.message);
    }
  };

  const handleRetryEvaluation = async (sessionId: string) => {
    if (!window.confirm('This will re-queue the evaluation for this session. Continue?')) return;
    
    try {
      const now = new Date().toISOString();

      const { data: existingJob } = await supabase
        .from('evaluation_jobs')
        .select('id, attempts')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingJob) {
        const { error: updateError } = await supabase
          .from('evaluation_jobs')
          .update({ 
            status: 'QUEUED', 
            last_attempt_at: now,
            attempts: (existingJob.attempts || 0) + 1,
            error: null,
            last_error: null 
          })
          .eq('session_id', sessionId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('evaluation_jobs')
          .insert({ 
            session_id: sessionId, 
            status: 'QUEUED', 
            created_at: now,
            last_attempt_at: now,
            attempts: 1
          });

        if (insertError) throw insertError;
      }

      alert('Evaluation re-queued successfully. It will process shortly.');
      setSelectedSession(null);
    } catch (err: any) {
      console.error('Failed to retry evaluation:', err);
      alert('Failed to retry evaluation: ' + err.message);
    }
  };

  // ── Drive actions ──────────────────────────────────────────────────────────
  const handleStatusChange = async (driveId: string, newStatus: 'ACTIVE' | 'COMPLETED') => {
    try {
      await DriveRepository.updateDriveStatus(driveId, newStatus);
      setDrives((prev) => prev.map((d) => d.id === driveId ? { ...d, status: newStatus } : d));
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleDeleteDrive = async (driveId: string) => {
    if (!window.confirm('Archive this drive? Data is preserved.')) return;
    setDeletingId(driveId);
    try {
      await DriveRepository.updateDriveStatus(driveId, 'ARCHIVED');
      setDrives((prev) => prev.filter((d) => d.id !== driveId));
    } catch (err: any) {
      alert('Failed to archive: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Session report view ────────────────────────────────────────────────────
  if (selectedSession) {
    // Routed through the shared reconstructor instead of building a report from constants.
    //
    // This branch previously fabricated a complete report whenever `evaluation_logic` was
    // missing: `overall_score || 50` invented a passing technical score (and turned a genuine 0
    // into 50), `100 - risk_score` asserted flawless integrity, `reportConfidence: 'Medium'` was
    // hardcoded, and proctoringSummary was all zeros — a clean record, fabricated. It rendered
    // identically to a real report with no indication anything was missing.
    //
    // The fix for this shipped in 358c3cd and was lost when the recruiter-onboarding branch
    // (ed4bd66) was merged: the conflict resolution kept this file's old body while taking the
    // new imports, leaving `getEffectiveSessionReport`, `hasStoredEvaluation` and
    // `EvaluationUnavailable` imported but unused. This restores the intended behaviour and
    // matches CompletedInterviews.tsx and AdminDashboard.tsx, which both already use it.
    const reportData = hasStoredEvaluation(selectedSession)
      ? selectedSession.evaluation_logic
      : getEffectiveSessionReport(selectedSession);

    const backButton = (
  <div className="print-hide flex items-center justify-between mb-4">
    <button
      onClick={() => setSelectedSession(null)}
      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
      Back to Dashboard
    </button>
    <div className="flex gap-2">
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
      >
        <FileText size={13} /> Download PDF
      </button>
    </div>
  </div>
);

    // No stored report and nothing to reconstruct from — say so, rather than inventing one.
    if (!reportData || (reportData as any)._isMissingData) {
      return (
        <div className="p-6 max-w-6xl mx-auto">
          {backButton}
          <p className="text-xs text-slate-400 mb-4">{selectedSession.drive_title}</p>
          <EvaluationUnavailable
            reason={selectedSession.session_status === 'COMPLETED' ? 'evaluation-failed' : 'not-evaluated'}
            candidateName={selectedSession.candidate_name}
            detail={(selectedSession.evaluation_logic as any)?.errorMessage || 'No specific error details recorded.'}
            onRetry={() => handleRetryEvaluation(selectedSession.session_id)} // <-- THIS ENABLES THE RETRY BUTTON
          />
        </div>
      );
    }

    return (
      <div className="print-report p-6 max-w-6xl mx-auto">
        {backButton}
        <p className="text-xs text-slate-400 mb-4">{selectedSession.drive_title}</p>
        <SessionReportView
          candidate={{ name: selectedSession.candidate_name, email: selectedSession.candidate_email, role: selectedSession.drive_title, session: selectedSession }}
          evalReport={reportData}
          sessionId={selectedSession.session_id}
          mode="admin"
          initialOutcome={selectedSession.candidate_outcome ?? 'PENDING'}
          onDecisionMade={(newOutcome) => {
            setDriveCandidates(prev =>
              prev.map(c =>
                c.session_id === selectedSession.session_id
                ? { ...c, candidate_outcome: newOutcome }
                : c
              )
            );
            writeOutcomeNotification(selectedSession, newOutcome);
          }}
        />
      </div>
    );
  }

  const writeOutcomeNotification = async (session: SessionDetail, outcome: CandidateOutcome) => {
  const messages: Record<string, { title: string; message: string; type: string }> = {
    SHORTLIST: {
      title: '🎉 You have been Shortlisted!',
      message: `Congratulations! After reviewing your ${session.drive_title} interview, the recruiter has shortlisted you for the next step. Please check your email for further instructions.`,
      type: 'success',
    },
    REJECT: {
      title: 'Application Status Update',
      message: `Thank you for appearing for the ${session.drive_title} interview. After careful consideration, we will not be moving forward with your application at this time. We encourage you to apply again in the future.`,
      type: 'info',
    },
    INTERVIEW_SCHEDULED: {
      title: '📅 Next Round Scheduled!',
      message: `Great news! You have been selected for the next round of interviews for ${session.drive_title}. The recruiter will reach out with details shortly.`,
      type: 'success',
    },
  };

  const notif = messages[outcome as string];
  if (!notif || !session.candidate_email) return;

  try {
    await supabase.from('candidate_notifications').insert({
      candidate_email: session.candidate_email.toLowerCase(),
      session_id: session.session_id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
    });
  } catch (err) {
    console.warn('[HRDashboard] Failed to write outcome notification:', err);
  }
};

  const tabs = [
    { key: 'overview' as const,   label: 'Overview',    icon: <LayoutDashboard size={16} /> },
    { key: 'candidates' as const, label: 'Candidates',  icon: <Users size={16} /> },
    { key: 'reports' as const,    label: 'Reports',     icon: <FileText size={16} /> },
    { key: 'drives' as const,     label: 'My Drives',   icon: <Briefcase size={16} /> },
    { key: 'assignments' as const, label: 'Assignments', icon: <UserCheck size={16} /> },
  ];

  return (
    <div data-tour="hr-dashboard" className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8" />
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">HR Dashboard</h1>
                <p className="text-[11px] text-slate-400 leading-tight">Reicrew AI</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  data-tour={`hr-${tab.key}-tab`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                    ${activeTab === tab.key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <DemoToggleSwitch />
              <NotificationCenter sessions={driveCandidates} showPipelineAlerts />
              <button onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 transition-colors py-2 px-3.5 rounded-xl border border-transparent hover:border-red-200 hover:bg-red-50">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
              <p className="text-slate-500 mt-1 text-sm">Candidates from your interview drives.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : error ? (
              <div className="flex flex-col items-center py-12 text-red-500"><AlertCircle className="w-10 h-10 mb-3" /><p className="text-sm">{error}</p></div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center mb-3"><Briefcase size={18} className="text-indigo-600" /></div>
                    <p className="text-2xl font-bold text-slate-900">{uniqueDrives.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Active Drives</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center mb-3"><Users size={18} className="text-emerald-600" /></div>
                    <p className="text-2xl font-bold text-slate-900">{driveCandidates.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Candidates</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center mb-3"><TrendingUp size={18} className="text-amber-600" /></div>
                    <p className="text-2xl font-bold text-slate-900">{completedSessions.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Interviews Done</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="w-10 h-10 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center mb-3"><Award size={18} className="text-sky-600" /></div>
                    <p className="text-2xl font-bold text-slate-900">{avgScore}%</p>
                    <p className="text-xs text-slate-500 mt-0.5">Avg. Score</p>
                  </div>
                </div>

                {/* Dashboard Graphical Visualization Suite */}
                {dashboardSummary && <DashboardCharts summary={dashboardSummary} />}

                {/* Drive-grouped candidate list */}
                {driveCandidates.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                    <Inbox size={32} className="text-slate-300 mb-3" />
                    <p className="text-sm font-medium">No candidates yet</p>
                    <p className="text-xs text-slate-400 mt-1">Create a drive and import candidates to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {uniqueDrives.map((driveId) => {
                      const candidates = byDrive[driveId];
                      const driveTitle = candidates[0].drive_title;
                      const isExpanded = expandedDrives.has(driveId);
                      const completedCount = candidates.filter(c => c.session_status === 'COMPLETED' || c.session_status === 'TERMINATED').length;

                      return (
                        <div key={driveId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                          {/* Drive header */}
                          <button
                            onClick={() => toggleDrive(driveId)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
                                <Briefcase size={16} className="text-indigo-600" />
                              </div>
                              <div className="text-left">
                                <p className="font-semibold text-slate-900">{driveTitle}</p>
                                <p className="text-xs text-slate-400">{candidates.length} candidates · {completedCount} interviewed</p>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </button>

                          {/* Candidates list */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 divide-y divide-slate-100">
                              {candidates.map((c, i) => (
                                <div key={i}
                                  onClick={() => c.session_id ? handleViewSession(c) : undefined}
                                  className={`flex items-center justify-between px-5 py-3.5 ${c.session_id ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                      <Users size={13} className="text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">{c.candidate_name || 'Unknown'}</p>
                                      <p className="text-xs text-slate-400 truncate">{c.candidate_email}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {c.overall_score !== null && (
                                      <span className={`text-sm font-bold ${SCORE_COLOR(c.overall_score)}`}>
                                        {Math.round(c.overall_score)}%
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                      c.session_status === 'COMPLETED' || c.session_status === 'TERMINATED'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : c.session_status === 'IN_PROGRESS'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {c.candidate_outcome && c.candidate_outcome !== 'PENDING'
                                        ? c.candidate_outcome.replace('_', ' ')
                                        : c.session_status ?? c.assignment_status
                                      }
                                    </span>
                                    {c.session_id && <ChevronRight size={14} className="text-slate-300" />}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CANDIDATES TAB ── */}
        {activeTab === 'candidates' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">All Candidates</h2>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                {uniqueDrives.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                    <Inbox size={32} className="text-slate-300 mb-3" />
                    <p className="text-sm">No candidates yet</p>
                  </div>
                ) : uniqueDrives.map((driveId) => {
                  const candidates = byDrive[driveId];
                  const driveTitle = candidates[0].drive_title;
                  return (
                    <div key={driveId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <p className="text-sm font-semibold text-slate-700">{driveTitle}</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left px-3 md:px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Candidate</th>
                              <th className="text-left px-3 md:px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                              <th className="text-left px-3 md:px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Score</th>
                              <th className="text-left px-3 md:px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Completed</th>
                              <th className="px-3 md:px-5 py-3"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {candidates.map((c, i) => (
                              <tr key={i}
                                onClick={() => c.session_id ? handleViewSession(c) : undefined}
                                className={`${c.session_id ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                              >
                                <td className="px-3 md:px-5 py-3.5">
                                  <p className="font-medium text-slate-900 truncate max-w-35 sm:max-w-none">{c.candidate_name || 'Unknown'}</p>
                                  <p className="text-xs text-slate-400 truncate max-w-35 sm:max-w-none">{c.candidate_email}</p>
                                </td>
                                <td className="px-3 md:px-5 py-3.5">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                    c.session_status === 'COMPLETED' || c.session_status === 'TERMINATED' ? 'bg-emerald-50 text-emerald-700' :
                                    c.session_status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    {c.session_status ?? c.assignment_status}
                                  </span>
                                </td>
                                <td className="px-3 md:px-5 py-3.5">
                                  {c.overall_score !== null
                                    ? <span className={`font-bold ${SCORE_COLOR(c.overall_score)}`}>{Math.round(c.overall_score)}%</span>
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-3 md:px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                                  {c.session_completed_at ? new Date(c.session_completed_at).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-3 md:px-5 py-3.5 text-right">
                                  {c.session_id && <ChevronRight size={14} className="text-slate-300 inline" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Interview Reports</h2>
            <p className="text-sm text-slate-500">Click a completed interview to view the full evaluation report.</p>
            {completedSessions.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                <FileText size={32} className="text-slate-300 mb-3" />
                <p className="text-sm">No completed interviews yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedSessions.map((c, i) => (
                  <div key={i} onClick={() => handleViewSession(c)}
                    className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                          <FileText size={18} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{c.candidate_name}</p>
                          <p className="text-xs text-slate-500">{c.drive_title} · {c.candidate_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.candidate_outcome && c.candidate_outcome !== 'PENDING' && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase ${
                            c.candidate_outcome === 'SHORTLIST' ? 'bg-emerald-100 text-emerald-700' :
                            c.candidate_outcome === 'REJECT' ? 'bg-rose-100 text-rose-700' :
                            'bg-indigo-100 text-indigo-700'
                            }`}>
                            {c.candidate_outcome.replace('_', ' ')}
                          </span>
                        )}
                        {c.overall_score !== null && (
                          <span className={`text-lg font-bold ${SCORE_COLOR(c.overall_score)}`}>
                            {Math.round(c.overall_score)}%
                          </span>
                        )}
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </div>
                    {c.session_completed_at && (
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <Calendar size={11} /> {new Date(c.session_completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MY DRIVES TAB ── */}
        {activeTab === 'drives' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">My Drives</h2>
                <p className="text-sm text-slate-500 mt-0.5">Interview drives you have created.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/hr/import')}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <Upload size={16} /> Import Candidates
                </button>
                <button onClick={() => navigate('/hr/drives/new')}
                  data-tour="new-drive-btn"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <Plus size={16} /> New Drive
                </button>
              </div>
            </div>

            {drivesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : drives.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                <Briefcase size={36} className="text-slate-300 mb-3" />
                <p className="text-sm font-medium">No drives yet</p>
                <button onClick={() => navigate('/hr/drives/new')}
                  className="mt-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <Plus size={16} /> Create Drive
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {drives.map((drive) => {
                  const driveCands = byDrive[drive.id] || [];
                  const invitedCount = driveCands.filter(c => c.assignment_status === 'INVITED').length;
                  const inProgressCount = driveCands.filter(c => c.assignment_status === 'IN_PROGRESS').length;
                  const completedCount = driveCands.filter(c => c.assignment_status === 'COMPLETED').length;
                  return (
                  <div key={drive.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 transition-all">
                  <div key={drive.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                          <Briefcase size={18} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{drive.title}</h3>
                          {drive.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{drive.description}</p>}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${STATUS_STYLES[drive.status] || 'bg-slate-100 text-slate-600'}`}>
                              {drive.status}
                            </span>
                            {drive.scheduled_at && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Calendar size={11} />{new Date(drive.scheduled_at).toLocaleDateString()}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Users size={11} />{drive.total_candidates} candidates
                            </span>
                            {drive.completed_candidates > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                                  <Users size={10} /> {invitedCount} Invited
                                </span>
                                <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-semibold">
                                  <Loader2 size={10} /> {inProgressCount} In Progress
                                </span>
                                <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-semibold">
                                  <CheckCircle2 size={10} /> {completedCount} Completed
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!driveLinks[drive.id] ? (
                          <button
                          onClick={() => handleGetLink(drive.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Link2 size={13} /> Get Link
                          </button>
                        ) : (
                              <div data-tour="access-key-panel" className="flex items-center gap-1.5">
                                <input
                                readOnly
                                value={driveLinks[drive.id]}
                                className="text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 w-48 font-mono text-slate-600 bg-slate-50 truncate"
                                />
                                <button
                                onClick={() => handleCopyLink(drive.id)}
                                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                                  copySuccess === drive.id
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                                >
                                  {copySuccess === drive.id ? <><CheckCircle2 size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                                </button>
                              </div>
                            )}
                        {drive.status === 'DRAFT' && (
                          <button onClick={() => handleStatusChange(drive.id, 'ACTIVE')}
                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                            <CheckCircle2 size={13} /> Activate
                          </button>
                        )}
                        {drive.status === 'ACTIVE' && (
                          <button onClick={() => handleStatusChange(drive.id, 'COMPLETED')}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                            <CheckCircle2 size={13} /> Complete
                          </button>
                        )}
                        <button onClick={() => handleDeleteDrive(drive.id)} disabled={deletingId === drive.id}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {deletingId === drive.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Archive
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
              </div>
            )}
          </div>
        )}

        {/* ── ASSIGNMENTS TAB ── */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="text-indigo-600" size={22} /> Candidate Interview Assignments
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Assign candidates to specific drives and track their assignment status.</p>
              </div>
              <button
                onClick={() => {
                  setAssignError(null);
                  if (drives.length > 0) setAssignFormDriveId(drives[0].id);
                  setShowAssignModal(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
              >
                <Plus size={16} /> Assign Candidate
              </button>
            </div>

            {/* Stat Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Assignments</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">{assignments.length}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">Pending / In Progress</span>
                <span className="text-2xl font-bold text-amber-600 mt-1 block">
                  {assignments.filter(a => a.status === 'INVITED' || a.status === 'VERIFIED' || a.status === 'IN_PROGRESS').length}
                </span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">Completed</span>
                <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                  {assignments.filter(a => a.status === 'COMPLETED').length}
                </span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block">Absent / Missed</span>
                <span className="text-2xl font-bold text-rose-600 mt-1 block">
                  {assignments.filter(a => a.status === 'ABSENT').length}
                </span>
              </div>
            </div>

            {/* Filters Row */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl w-full sm:max-w-xs focus-within:bg-white focus-within:border-indigo-500 transition-all">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  placeholder="Search by candidate name or email..."
                  className="bg-transparent outline-none text-xs w-full text-slate-800 placeholder:text-slate-400 font-medium"
                  value={assignmentSearchTerm}
                  onChange={e => setAssignmentSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={assignmentFilter}
                onChange={e => setAssignmentFilter(e.target.value)}
                className="border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs outline-none bg-white text-slate-700 font-semibold"
              >
                <option value="all">All Assignment Statuses</option>
                <option value="INVITED">Invited</option>
                <option value="VERIFIED">Verified</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>

            {/* Assignments Table */}
            {assignmentsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3">Candidate</th>
                        <th className="px-5 py-3">Assigned Drive</th>
                        <th className="px-5 py-3">Company</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(() => {
                        const filtered = assignments.filter(a => {
                          const matchSearch =
                            a.candidate_email.toLowerCase().includes(assignmentSearchTerm.toLowerCase()) ||
                            (a.candidate_name && a.candidate_name.toLowerCase().includes(assignmentSearchTerm.toLowerCase()));
                          const matchStatus = assignmentFilter === 'all' || a.status === assignmentFilter;
                          return matchSearch && matchStatus;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="px-5 py-12 text-center text-slate-400 font-semibold">
                                No assignments found matching your filter.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-900">{a.candidate_name}</p>
                              <p className="text-xs text-slate-400 font-mono">{a.candidate_email}</p>
                            </td>
                            <td className="px-5 py-3.5 text-slate-800 font-medium">{a.job_title}</td>
                            <td className="px-5 py-3.5 text-slate-500 text-xs">{a.company_name || '—'}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                a.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                                a.status === 'IN_PROGRESS' || a.status === 'VERIFIED' ? 'bg-blue-50 text-blue-700' :
                                a.status === 'ABSENT' ? 'bg-rose-50 text-rose-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteAssignment(a.id)}
                                className="text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ASSIGN CANDIDATE MODAL ── */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Assign Candidate to Interview Drive</h3>
              {assignError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {assignError}
                </div>
              )}
              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Drive</label>
                  <select
                    value={assignFormDriveId}
                    onChange={e => setAssignFormDriveId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {drives.map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Candidate Email Address</label>
                  <input
                    type="email"
                    value={assignFormEmail}
                    onChange={e => setAssignFormEmail(e.target.value)}
                    placeholder="student@college.edu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">College Roll Number / ID (Optional)</label>
                  <input
                    type="text"
                    value={assignFormCollegeId}
                    onChange={e => setAssignFormCollegeId(e.target.value)}
                    placeholder="e.g. 21CS101"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Department Name (Optional)</label>
                  <input
                    type="text"
                    value={assignFormCompany}
                    onChange={e => setAssignFormCompany(e.target.value)}
                    placeholder="e.g. Reincrew hiring"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignSubmitting}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {assignSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Assign Candidate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};