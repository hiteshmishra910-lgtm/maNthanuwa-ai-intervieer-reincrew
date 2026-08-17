import React, { useEffect, useState, useMemo } from 'react';
import { useUser, useAuth, UserButton } from '@clerk/clerk-react';
import { useUserRole } from '../../hooks/useUserRole';
import {
  LayoutDashboard,
  Briefcase,
  User,
  Play,
  ArrowRight,
  ChevronDown,
  Loader2,
  Award,
  TrendingUp,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  ShieldCheck,
  Mail,
  Inbox,
  BookOpen, 
} from 'lucide-react';
import { Logo } from '../../Core/components/Logo';
import { InterviewRoles } from '../../../types';
import { SupabaseService } from '../../Core/database/supabaseService';
import { setSupabaseAuthToken } from '../../Core/database/supabaseClient';
import { CompletedInterviews } from './CompletedInterviews';
import { AssignedInterviews } from './AssignedInterviews';
import { UpcomingInterviews } from './UpcomingInterviews';
import { CandidateProfile } from './CandidateProfile';
import { PerformanceDashboard } from './PerformanceDashboard';
import { NotificationCenter } from '../../Core/components/NotificationCenter';
import { getJobTemplateByAccessKey } from '../../Core/database/jobSeedRepository';
import { TourButton } from "../../tours/TourButton";
import { isDemoModeActive, subscribeDemoMode } from '../../Core/demo/demoMode';
import { sessionEvents } from '../../Core/events/sessionEvents';
import { sortSessionsRealFirst } from '../../Core/data/dataProvider';
import { DemoDataService } from '../../Core/demo/demoDataService';

type DashboardTab = 'overview' | 'interviews' | 'profile' | 'performance';
type InterviewsSubTab = 'completed' | 'upcoming' | 'assigned';

interface CandidateDashboardProps {
  userRole: string | null;
  onStartInterview: (data: {
    name: string;
    email: string;
    role: string;
    clerkUserId: string;
    clerkToken: string;
  }) => void;
  onAdminAccess: () => void;
}

export const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ userRole: initialUserRole, onStartInterview, onAdminAccess }) => {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { userRole: fetchedUserRole } = useUserRole();
  const userRole = initialUserRole || fetchedUserRole;

  // Tab state
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [interviewsSubTab, setInterviewsSubTab] = useState<InterviewsSubTab>('completed');

  // Data
  const [candidateData, setCandidateData] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Start Interview Modal
  const [showStartModal, setShowStartModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    accessKey: '',
  });
  const [formError, setFormError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const dashboardTourSteps = useMemo(() => [
  {
    id: "dashboard-welcome",
    title: "Your Candidate Dashboard",
    text: "<p>This is your home base — see all your interviews, scores, and performance from here.</p>",
  },
  {
    id: "practice-step",
    title: "Practice Interviews",
    text: "<p>New to the platform? Hit <strong>Practice</strong> to try a mock interview with no access key needed.</p>",
    attachTo: { element: '[data-tour="practice-btn"]', on: "bottom" },
  },
  {
    id: "start-interview-step",
    title: "Start a Real Interview",
    text: "<p>When your recruiter sends you an access key, click <strong>Start Interview</strong> and paste it in the form.</p>",
    attachTo: { element: '[data-tour="start-interview-btn"]', on: "bottom" },
  },
  {
    id: "interviews-tab",
    title: "My Interviews Tab",
    text: "<p>Click <strong>My Interviews</strong> to see all your completed, upcoming, and assigned interviews.</p>",
    attachTo: { element: '[data-tour="interviews-tab"]', on: "bottom" },
  },
  {
    id: "completed-tab",
    title: "Completed Interviews",
    text: "<p>The <strong>Completed</strong> sub-tab shows all finished interviews with your AI-generated score and evaluation report.</p>",
    attachTo: { element: '[data-tour="completed-subtab"]', on: "bottom" },
  },
  {
    id: "upcoming-tab",
    title: "Upcoming / In Progress",
    text: "<p>The <strong>Upcoming</strong> sub-tab shows interviews you have started but not finished yet.</p>",
    attachTo: { element: '[data-tour="upcoming-subtab"]', on: "bottom" },
  },
  {
    id: "assigned-tab",
    title: "Assigned Interviews",
    text: "<p>The <strong>Assigned</strong> sub-tab shows interviews a recruiter has directly assigned to you. Click any card to join — no access key needed.</p>",
    attachTo: { element: '[data-tour="assigned-subtab"]', on: "bottom" },
  },
], []);

  // Pre-fill form from Clerk
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '',
        email: user.primaryEmailAddress?.emailAddress || '',
        role: '',
        accessKey: '',
      });
    }
  }, [user]);

  // Fetch candidate + sessions
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        try {
          let token = null;
          console.log('[DEBUG] CandidateDashboard: fetching token...');
          try { token = await getToken({ template: 'supabase' }); } catch { token = await getToken(); }
          console.log('[DEBUG] CandidateDashboard: token result:', token ? '✅' : '❌'); 
          if (token) setSupabaseAuthToken(token);
        } catch (e) {
          console.warn('[CandidateDashboard] Failed to fetch token', e);
        }
        let candidate = await SupabaseService.getCandidateByClerkId(user.id);

        // If not found by clerk ID, try by email
        // (candidate may have been created during assignment without clerk_user_id)
        if (!candidate && user?.primaryEmailAddress?.emailAddress) {
          candidate = await SupabaseService.upsertCandidate({
            name: user.fullName || user.primaryEmailAddress.emailAddress.split('@')[0],
            email: user.primaryEmailAddress.emailAddress,
            clerk_user_id: user.id,
          });
        }

        setCandidateData(candidate);

        if (candidate) {
          const allSessions = await SupabaseService.getStudentSessions(candidate.id);
          setSessions(allSessions || []);
        }
      } catch (err: any) {
        console.warn('[CandidateDashboard] Could not load candidate data (this is normal for new users):', err?.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const unsubDemo = subscribeDemoMode(() => fetchData());
    const unsubSession = sessionEvents.on(() => fetchData());
    return () => {
      unsubDemo();
      unsubSession();
    };
  }, [user?.id]);

  const pranitaDemoSessions = DemoDataService.getDemoSessions()
    .filter(ds => ds.candidate_name === 'Pranita Khobe')
    .map(ds => ({
      id: ds.id,
      session_id: ds.id,
      candidate_name: user?.fullName || 'Pranita Khobe',
      candidate_email: user?.primaryEmailAddress?.emailAddress || 'pranitakhobe22@gmail.com',
      role: (ds.evaluation_logic as any)?.role || ds.drive_title,
      session_status: ds.session_status,
      overall_score: ds.overall_score,
      recommendation: ds.candidate_outcome,
      interview_date: ds.date || '2026-08-12T14:00:00Z',
      date: ds.date,
      evaluation_logic: ds.evaluation_logic,
      isDemo: true,
    }));

  const sortedRealSessions = sortSessionsRealFirst(sessions);
  const effectiveSessions = !isDemoModeActive()
    ? sortedRealSessions
    : (sortedRealSessions.length > 0 ? [...sortedRealSessions, ...pranitaDemoSessions] : pranitaDemoSessions);

  const completedSessions = effectiveSessions.filter(
    (s: any) => s.session_status === 'COMPLETED' || s.session_status === 'TERMINATED' || s.session_status === 'QUEUED'
  );
  const avgScore = completedSessions.length > 0
    ? Math.round(
        completedSessions.reduce((sum: number, s: any) => sum + (s.overall_score || 0), 0) /
          completedSessions.length
      )
    : 0;
  const strongHires = completedSessions.filter(
    (s: any) => s.recommendation === 'Strong Hire' || s.recommendation === 'Hire' || s.recommendation === 'SHORTLIST'
  ).length;
  const totalCompleted = completedSessions.length;

  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role || !formData.accessKey) {
      setFormError('Please fill in all fields.');
      return;
    }

    const { getJobTemplateByAccessKey } = await import('../../Core/database/jobSeedRepository');
    const validTemplate = getJobTemplateByAccessKey(formData.accessKey);
    if (!validTemplate) {
      setFormError('Invalid access key. Please check with your recruiter and try again.');
      return;
    }

    setIsStarting(true);
    try {
      let token = null;
      try {
        token = await getToken({ template: 'supabase' });
      } catch {
        token = await getToken();
      }

      onStartInterview({
        ...formData,
        clerkUserId: user?.id || '',
        clerkToken: token || '',
      });
    } catch (err) {
      setFormError('Failed to start interview. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const tabs: { key: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { key: 'interviews', label: 'My Interviews', icon: <Briefcase size={16} /> },
    { key: 'performance', label: 'Performance', icon: <TrendingUp size={16} /> },
    { key: 'profile', label: 'Profile', icon: <User size={16} /> },
  ];

  const canAccessAdmin = userRole === 'admin' || userRole === 'hr';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* ── Header ── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-2xs safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left: Brand / Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <Logo className="w-8 h-8" />
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900">Reicrew</span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Student
                </span>
              </div>
            </div>

            {/* Center: Desktop Segmented Navigation Tabs */}
            <nav className="hidden md:flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 shadow-inner">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  {...(tab.key === 'interviews' ? { 'data-tour': 'interviews-tab' } : {})}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === tab.key
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Admin/HR + Start Interview Buttons */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Privileged Staff Links (Admin / HR) */}
              {canAccessAdmin && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 p-1 rounded-xl">
                  {(userRole === 'admin' || userRole === 'hr') && (
                    <button
                      onClick={() => window.location.href = '/hr'}
                      title="HR Panel"
                      className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white hover:shadow-2xs transition-all"
                    >
                      <Briefcase size={14} className="text-slate-500" />
                      <span className="hidden xl:inline">HR Panel</span>
                    </button>
                  )}
                  {userRole === 'admin' && (
                    <button
                      onClick={onAdminAccess}
                      title="Admin Portal"
                      className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-white hover:shadow-2xs transition-all"
                    >
                      <ShieldCheck size={14} className="text-indigo-600" />
                      <span className="hidden xl:inline">Admin</span>
                    </button>
                  )}
                </div>
              )}

              {/* Notification Center */}
              <NotificationCenter sessions={sessions} userEmail={user?.primaryEmailAddress?.emailAddress} />

              <div className="hidden sm:block h-5 w-px bg-slate-200 mx-0.5" />

              {/* Practice Button (Desktop) */}
              <button
                onClick={() => window.location.href = '/candidate/practice'}
                data-tour="practice-btn"
                className="hidden sm:flex items-center gap-1.5 border border-indigo-200/80 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-600 text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95"
              >
                <BookOpen size={14} />
                <span>Practice</span>
              </button>

              {/* Start Interview Button (Desktop) */}
              <button
                onClick={() => setShowStartModal(true)}
                className="hidden sm:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs shadow-indigo-200 active:scale-95"
              >
                <Play size={14} />
                <span>Start Interview</span>
              </button>

              {/* User Avatar */}
              <div className="flex items-center pl-1">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile Horizontal Pill Tab Navigation (Replaces <select> dropdown) ── */}
        <div className="md:hidden bg-slate-50/90 border-t border-slate-100 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              {...(tab.key === 'interviews' ? { 'data-tour': 'interviews-tab' } : {})}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── Mobile Action Dock (Clean Responsive Bottom Bar) ── */}
      <div className="sm:hidden fixed bottom-safe inset-x-4 max-w-md mx-auto z-30 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200/90 shadow-[0_10px_35px_rgba(0,0,0,0.12)] flex items-center gap-2">
        <button
          onClick={() => window.location.href = '/candidate/practice'}
          data-tour="practice-btn"
          className="flex-1 flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-indigo-600 text-xs font-bold py-3 px-3 rounded-xl transition-all active:scale-[0.98] hover:bg-indigo-50/60"
        >
          <BookOpen size={16} />
          <span>Practice</span>
        </button>
        <button
          onClick={() => setShowStartModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 px-3 rounded-xl transition-all shadow-md shadow-indigo-200/70 active:scale-[0.98]"
        >
          <Play size={16} />
          <span>Start Interview</span>
        </button>
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 sm:pb-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Welcome */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Welcome back{user?.firstName ? `, ${user.firstName}` : ''} 👋
              </h2>
              <p className="text-slate-500 mt-1 text-sm">
                {totalCompleted > 0
                  ? `You've completed ${totalCompleted} interview${totalCompleted !== 1 ? 's' : ''} so far.`
                  : 'Ready for your next interview? Set one up below.'}
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                    <Award size={18} className="text-indigo-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{totalCompleted}</p>
                <p className="text-xs text-slate-500 mt-0.5">Completed</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                    <TrendingUp size={18} className="text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{avgScore}%</p>
                <p className="text-xs text-slate-500 mt-0.5">Avg. Score</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                    <FileText size={18} className="text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{strongHires}</p>
                <p className="text-xs text-slate-500 mt-0.5">Strong Hires</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center border border-sky-100">
                    <Clock size={18} className="text-sky-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{effectiveSessions.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total Sessions</p>
              </div>
            </div>

            {/* Recent interviews + Quick actions */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Completed */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Recent Interviews</h3>
                  <button
                    onClick={() => { setActiveTab('interviews'); setInterviewsSubTab('completed'); }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    View all
                  </button>
                </div>
                {completedSessions.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-400">
                    <Inbox size={32} className="text-slate-300 mb-3" />
                    <p className="text-sm">No interviews completed yet</p>
                    <button
                      onClick={() => setShowStartModal(true)}
                      className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
                    >
                      <Play size={14} />
                      Start your first interview
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedSessions.slice(0, 5).map((session: any) => {
                      const isQueued = session.session_status === 'QUEUED' ||
                                       session.session_status === 'IN_PROGRESS' ||
                                       (session.execution_status !== 'REPORT_SAVED' && session.evaluation_logic?.evaluationStatus === 'QUEUED') ||
                                       session.evaluation_logic?.evaluationStatus === 'PROCESSING';

                      return (
                        <div
                          key={session.session_id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer"
                          onClick={() => { setActiveTab('interviews'); setInterviewsSubTab('completed'); }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                              <FileText size={14} className="text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{session.role}</p>
                              <p className="text-xs text-slate-400">
                                {new Date(session.interview_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isQueued ? (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 animate-pulse">
                                <Loader2 size={12} className="animate-spin text-indigo-600" /> Processing AI Report
                              </span>
                            ) : session.overall_score !== null ? (
                              <span className={`text-sm font-bold ${
                                session.overall_score >= 80 ? 'text-emerald-600' :
                                session.overall_score >= 60 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {Math.round(session.overall_score)}%
                              </span>
                            ) : null}
                            <ChevronDown size={14} className="text-slate-300 -rotate-90" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowStartModal(true)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center border border-indigo-200">
                      <Play size={18} className="text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Start New Interview</p>
                      <p className="text-xs text-slate-500 mt-0.5">Take an AI-powered technical assessment</p>
                    </div>
                    <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => { setActiveTab('interviews'); setInterviewsSubTab('completed'); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200">
                      <FileText size={18} className="text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">View Results</p>
                      <p className="text-xs text-slate-500 mt-0.5">Check your completed interview reports</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => setActiveTab('profile')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200">
                      <User size={18} className="text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Edit Profile</p>
                      <p className="text-xs text-slate-500 mt-0.5">Update your personal information</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INTERVIEWS TAB */}
        {activeTab === 'interviews' && (
          <div className="space-y-6 animate-fade-in">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
              {(['completed', 'upcoming', 'assigned'] as const).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setInterviewsSubTab(sub)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                    interviewsSubTab === sub
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {sub === 'completed' && <CheckCircle2 size={14} className="inline mr-1.5 -mt-0.5" />}
                  {sub === 'upcoming' && <Clock size={14} className="inline mr-1.5 -mt-0.5" />}
                  {sub === 'assigned' && <Briefcase size={14} className="inline mr-1.5 -mt-0.5" />}
                  {sub}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            {interviewsSubTab === 'completed' && (
              <CompletedInterviews candidateId={candidateData?.id || ''} userEmail={user?.primaryEmailAddress?.emailAddress || ''} />
            )}
            {interviewsSubTab === 'upcoming' && (
              <UpcomingInterviews candidateId={candidateData?.id || ''} />
            )}
            {interviewsSubTab === 'assigned' && (
              <AssignedInterviews candidateId={candidateData?.id || ''} />
            )}
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <div className="animate-fade-in">
            <PerformanceDashboard
              candidateId={candidateData?.id || ''}
              candidateName={candidateData?.name || user?.fullName || ''}
            />
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="animate-fade-in">
            <CandidateProfile
              candidateData={candidateData}
              totalCompletedInterviews={totalCompleted}
              onUpdate={(updated) =>
                setCandidateData((prev: any) => prev ? { ...prev, ...updated } : prev)
              }
            />
          </div>
        )}
      </main>

      {/* ── Start Interview Modal ── */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Start New Interview</h2>
                <p className="text-sm text-slate-500 mt-0.5">Fill in your details to begin your assessment</p>
              </div>
              <button
                onClick={() => setShowStartModal(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleStartSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Full Name</label>
                <div className="relative">
                  <input
                    aria-label="Full Name"
                    type="text"
                    placeholder="Your full name"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-11 pr-4 py-3.5 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300 text-sm"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Email</label>
                <div className="relative">
                  <input
                    aria-label="Email"
                    type="email"
                    className="w-full bg-slate-100 border border-slate-200 text-slate-900 pl-11 pr-4 py-3.5 rounded-xl outline-none cursor-not-allowed text-sm opacity-75"
                    value={formData.email}
                    readOnly
                  />
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Academic Path</label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-11 pr-10 py-3.5 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer text-sm"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="" disabled>Select your role</option>
                    {Object.entries(InterviewRoles).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                    <option value="APTITUDE">Aptitude Test</option>
                  </select>
                  <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Access Key</label>
                <div className="relative">
                  <input
                    aria-label="Access Key"
                    type="password"
                    placeholder="Enter your access key"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-11 pr-4 py-3.5 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300 text-sm"
                    value={formData.accessKey}
                    onChange={e => setFormData({ ...formData, accessKey: e.target.value })}
                  />
                  <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-400 ml-1">Ask your recruiter for your access key</p>
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-500 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStarting}
                  className="flex-1 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isStarting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  {isStarting ? 'Starting...' : 'Start Interview'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <TourButton role="candidate_dashboard" steps={dashboardTourSteps} />
    </div>
  );
};
