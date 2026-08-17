import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth, useUser } from '@clerk/clerk-react';

// Logging / Init
import { auditLogger } from "./src/Evaluation/services/AuditLogger";
// Referenced so the bundler cannot tree-shake the module away; importing it runs its
// initialisation side effect. `void` makes the discard explicit — a bare `auditLogger;`
// statement reads as a mistake and is flagged as an unused expression.
void auditLogger;

import { HealthService, SystemHealth } from "./src/Core/monitoring/healthService";
import { SupabaseService } from "./src/Core/database/supabaseService";
import { getDeviceFingerprint } from "./src/Proctoring/services/deviceFingerprint";
import { supabase, setSupabaseAuthToken } from "./src/Core/database/supabaseClient";
import { ErrorBoundary } from "./src/Core/components/ErrorBoundary";
import { ErrorLogService } from "./src/Core/logging/errorLogService";

import { DemoModeToggleBanner } from "./src/Core/components/DemoModeToggleBanner";

// Icons
import { AlertTriangle, Server, Database, Lock, Loader2, CheckCircle2 } from "lucide-react";

// Route Wrappers
import { PublicRoute } from "./src/routes/PublicRoute";
import { ProtectedRoute } from "./src/routes/ProtectedRoute";
import { RoleProtectedRoute } from "./src/routes/RoleProtectedRoute";
import { useAppLogout } from "./src/hooks/useAppLogout";

// Layouts & Screens
import { CandidateLayout } from "./src/candidate/CandidateLayout";
import { HRLayout } from "./src/HR/HRLayout";
import { AdminLayout } from "./src/Admin/AdminLayout";
import { CandidateDashboard } from "./src/candidate/components/CandidateDashboard";
import { LandingScreen } from "./src/Interview/components/LandingScreen";
import DriveSelector from './src/HR/components/CsvImport/DriveSelector';

import { RoleLandingPage } from './src/HR/pages/RoleLandingPage';
import { RecruiterOnboarding } from './src/HR/pages/RecruiterOnboarding';
import { NewDrivePage } from './src/HR/pages/NewDrivePage';
import "./src/tours/tour.css";

// Lazy-loaded Route Components for Role-Isolated Code Splitting
const MainInterviewController = React.lazy(() => import("./src/candidate/interview/MainInterviewController").then(m => ({ default: m.MainInterviewController })));
const PracticeController = React.lazy(() => import("./src/candidate/practice/PracticeController").then(m => ({ default: m.PracticeController })));
const JoinDriveScreen = React.lazy(() => import("./src/candidate/join/JoinDriveScreen").then(m => ({ default: m.JoinDriveScreen })));
const AdminDashboard = React.lazy(() => import("./src/Admin/components/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const HRDashboard = React.lazy(() => import("./src/HR/components/HRDashboard").then(m => ({ default: m.HRDashboard })));
const MobileProctorScreen = React.lazy(() => import("./src/Proctoring/components/MobileProctorScreen").then(m => ({ default: m.MobileProctorScreen })));

// --- Helper Component to Handle the Start Logic ---
// We wrap the components that can start an interview to inject the handleStart logic,
// which creates the session in Supabase and then navigates to the interview route.
const StartInterviewWrapper = ({ children, isGuest = false }: { children: (onStart: any) => React.ReactNode, isGuest?: boolean }) => {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const handleStart = async (data: any) => {
    sessionStorage.removeItem("current_session_id");

    let freshToken = data.clerkToken;
    try {
      let token = null;
      try { token = await getToken({ template: 'supabase' }); } catch { token = await getToken(); }
      if (token) freshToken = token; 
    } catch (e) {
      console.warn("[App] Failed to fetch fresh token", e);
    }
    setSupabaseAuthToken(freshToken);   

    try {
      const candidateRecord = await SupabaseService.upsertCandidate({
        name: data.name,
        email:  data.email,
        role: data.role,
        clerk_user_id: data.clerkUserId,
      });
      const fp = await getDeviceFingerprint();

      let jobPostId = undefined;
      let assignmentDriveId = undefined;
      if (data.assignmentId) {
        try {
          const assignment = await SupabaseService.getAssignmentById(data.assignmentId);
          if (assignment) {
            assignmentDriveId = assignment.drive_id;
          }
        } catch (assignErr) {
          console.warn("Failed to fetch assignment details:", assignErr);
        }
      }

      if (!jobPostId && !assignmentDriveId) {
        try {
          const jobs = await SupabaseService.getAllJobs();
          const matchedJob = jobs.find(
            (j: any) =>
              j.settings?.role === data.role ||
              j.title.toLowerCase().includes(data.role.toLowerCase()) ||
              (data.role === "CSE" && j.title.toLowerCase().includes("computer")) ||
              (data.role === "ETC" && j.title.toLowerCase().includes("electron"))
          );
          if (matchedJob) jobPostId = String(matchedJob.id);
        } catch (jobErr) {
          console.warn("Failed to find job post in Supabase for role:", data.role, jobErr);
        }
      }

      const session = await SupabaseService.createSession(
        candidateRecord.id,
        jobPostId as any,
        fp,
        {},
        candidateRecord.name,
        assignmentDriveId,
      );
      sessionStorage.setItem("current_session_id", session.id);

      if (data.assignmentId) {
        try {
          await SupabaseService.incrementAttempt(data.assignmentId);
          await SupabaseService.updateAssignmentStatus(data.assignmentId, 'IN_PROGRESS');
          await SupabaseService.linkSessionToAssignment(data.assignmentId, session.id);
        } catch (assignErr) {
          console.warn("Failed to record assignment link update:", assignErr);
        }
      }
      
      navigate(isGuest ? "/interview-guest" : "/candidate/interview", {
        state: { candidateParams: { ...data, jobPostId, session } }
      });
    } catch (e: any) {
      ErrorLogService.logError("database", "Failed to start session in Supabase", e, undefined, data.name);
      alert(`Failed to start session. Database Error: ${e.message || JSON.stringify(e)}`);
    }
  };

  return <>{children(handleStart)}</>;
};

function AppRouter() {
  const { isSignedIn, isLoaded: isAuthLoaded, getToken } = useAuth();
  // PHASE 1: real sign-out (Clerk session + in-memory tokens + interview id).
  const handleLogout = useAppLogout();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  const [hasPassedInitialCheck, setHasPassedInitialCheck] = useState(false);
  const [isConnectionDegraded, setIsConnectionDegraded] = useState(false);
  const hasStartedHealthCheck = useRef(false);
  const consecutiveFailures = useRef(0);

  // Health monitor
  useEffect(() => {
    if (!isAuthLoaded || hasStartedHealthCheck.current) return;
    
    hasStartedHealthCheck.current = true;
    let didSeed = false;

    const checkSystem = async () => {
      setIsCheckingHealth(true);
      const h = await HealthService.checkSystemHealth();
      const isHealthy = Boolean(h.database && h.storage && h.auth);

      if (isHealthy) {
        consecutiveFailures.current = 0;
        setHealth(h);
        setIsConnectionDegraded(false);
        setHasPassedInitialCheck(true);

        if (!didSeed) {
          didSeed = true;
          try {
            await SupabaseService.seedDefaultJobsIfMissing();
            await SupabaseService.initializeSystemSettings();
          } catch (seedErr) {
            ErrorLogService.logError("system", "Auto-seeding database assets failed", seedErr);
          }

          // PHASE 4: recover candidate answers stranded in the offline buffer by a previous
          // session (tab closed while offline, browser killed, or the single retry failed).
          // Runs here because the database is confirmed reachable and the auth token has been
          // applied, so RLS will accept the writes. Failures leave the buffer intact.
          try {
            await SupabaseService.flushOfflineResponses();
          } catch (flushErr) {
            ErrorLogService.logError("system", "Offline answer recovery failed", flushErr);
          }
        }
      } else {
        consecutiveFailures.current += 1;
        // Require 3 consecutive failures before marking as degraded
        if (consecutiveFailures.current >= 3 || !hasPassedInitialCheck) {
          setHealth(h);
          if (hasPassedInitialCheck) {
            setIsConnectionDegraded(true);
          }
        }
      }
      setIsCheckingHealth(false);
    };

    checkSystem();
    const interval = setInterval(checkSystem, 60000);
    return () => clearInterval(interval);
  }, [isAuthLoaded, hasPassedInitialCheck]);

  // Token refresh
  useEffect(() => {
    if (!isSignedIn) return;

    const refreshToken = async () => {
      try {
        let token = null;
        try { token = await getToken({ template: 'supabase' }); } catch { token = await getToken(); }
        if (token) setSupabaseAuthToken(token);
      } catch (err) {
        console.warn('[App] Token refresh failed', err);
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 45000);
    return () => clearInterval(interval);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const isSystemHealthy = health?.database && health?.storage && health?.auth;

  if (!isAuthLoaded || (isCheckingHealth && health === null && !hasPassedInitialCheck)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Only block screen on INITIAL load failure. Never unmount an in-progress router / live interview.
  if (!isSystemHealthy && !hasPassedInitialCheck && !window.location.pathname.startsWith("/proctor/phone-camera")) {
    return (
      <div className="min-h-screen w-screen bg-[#F8FAFC] flex items-center justify-center p-4 text-slate-900">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            {isCheckingHealth ? (
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            ) : (
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4 border border-red-200">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-800">
              {isCheckingHealth ? "Verifying System" : "System Configuration Error"}
            </h1>
            <p className="text-slate-500 text-center mt-2 text-sm">
              {isCheckingHealth ? "Connecting to Supabase services..." : "Unable to start platform. Critical services are unreachable."}
            </p>
          </div>

          {!isCheckingHealth && health && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${health.database ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center gap-3">
                  <Database className={health.database ? "text-emerald-500" : "text-red-500"} size={20} />
                  <span className="font-medium text-sm">Database Tables</span>
                </div>
                {health.database ? <CheckCircle2 className="text-emerald-500" size={20} /> : <span className="text-xs font-bold text-red-600 px-2 py-1 bg-red-100 rounded-md">OFFLINE</span>}
              </div>
              <div className={`p-4 rounded-xl border flex items-center justify-between ${health.storage ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center gap-3">
                  <Server className={health.storage ? "text-emerald-500" : "text-red-500"} size={20} />
                  <span className="font-medium text-sm">Storage Buckets</span>
                </div>
                {health.storage ? <CheckCircle2 className="text-emerald-500" size={20} /> : <span className="text-xs font-bold text-red-600 px-2 py-1 bg-red-100 rounded-md">MISSING</span>}
              </div>
              <div className={`p-4 rounded-xl border flex items-center justify-between ${health.auth ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center gap-3">
                  <Lock className={health.auth ? "text-emerald-500" : "text-red-500"} size={20} />
                  <span className="font-medium text-sm">Authentication</span>
                </div>
                {health.auth ? <CheckCircle2 className="text-emerald-500" size={20} /> : <span className="text-xs font-bold text-red-600 px-2 py-1 bg-red-100 rounded-md">UNREACHABLE</span>}
              </div>
              <button onClick={() => window.location.reload()} className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {isConnectionDegraded && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 shadow-md animate-pulse">
          <AlertTriangle size={16} />
          <span>Network connection unstable. Retrying in background — your progress is saved locally.</span>
        </div>
      )}
      <BrowserRouter>
        <React.Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        }>
          <Routes>
          {/* Mobile Proctoring Route (No Auth Required) */}
          <Route path="/proctor/phone-camera" element={<MobileProctorScreen />} />

          {/* Public Landing Screen 
          <Route path="/" element={
            <PublicRoute restricted={true}>
              <StartInterviewWrapper isGuest={true}>
                {(handleStart) => (
                  <LandingScreen
                    onStart={handleStart}
                    onAdminAccess={() => { window.location.href = '/admin' }}
                    onHRAccess={() => { window.location.href = '/hr' }}
                  />
                )}
              </StartInterviewWrapper>
            </PublicRoute>
          } />
          */}

          {/* Role selection — only for signed in users */}
          <Route path="/welcome" element={
            isSignedIn ? <RoleLandingPage /> : <Navigate to="/" replace />
          } />

          {/* / redirects to /welcome 
          <Route path="/" element={
            <PublicRoute restricted={true}>
              <Navigate to="/welcome" replace />
            </PublicRoute>
          } />
           */}

          <Route path="/" element={
            <PublicRoute restricted={true}>
              <StartInterviewWrapper isGuest={true}>
                {(handleStart) => (
                  <LandingScreen
                    onStart={handleStart}
                    onAdminAccess={() => { window.location.href = '/admin' }}
                    onHRAccess={() => { window.location.href = '/hr' }}
                  />
                )}
              </StartInterviewWrapper>
            </PublicRoute>
          } />

          {/* Student entry point */}
          <Route path="/student" element={
            <PublicRoute restricted={true}>
              <StartInterviewWrapper isGuest={true}>
                {(handleStart) => (
                  <LandingScreen
                    onStart={handleStart}
                    onAdminAccess={() => { window.location.href = '/admin' }}
                    onHRAccess={() => { window.location.href = '/hr' }}
                  />
                )}
              </StartInterviewWrapper>
            </PublicRoute>
          } />
          
          {/* Guest Interview Flow (Legacy) */}
          <Route path="/interview-guest" element={
            <MainInterviewController />
          } />

          {/* Join Drive Flow (New entry point for Mass Drives) */}
          <Route path="/join" element={<JoinDriveScreen />} />

          {/* Candidate Zones */}
          <Route path="/candidate" element={<ProtectedRoute><CandidateLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={
              <StartInterviewWrapper>
                {(handleStart) => (
                  <CandidateDashboard
                    userRole={null} // Extracted internally if needed, but not required here
                    onStartInterview={handleStart}
                    onAdminAccess={() => { window.location.href = '/admin' }}
                  />
                )}
              </StartInterviewWrapper>
            } />
            <Route path="practice/*" element={<PracticeController />} />
            <Route path="interview" element={<MainInterviewController />} />
          </Route>

          {/* HR Zones */}
          <Route path="/hr" element={<RoleProtectedRoute allowedRoles={['hr', 'admin']}><HRLayout /></RoleProtectedRoute>}>
             <Route index element={<Navigate to="dashboard" replace />} />
             <Route path="dashboard" element={<HRDashboard onLogout={() => { void handleLogout('/'); }} />} />
             <Route path="import" element={<DriveSelector />} />
             <Route path="onboarding" element={<RecruiterOnboarding />} />
             <Route path="drives/new" element={<NewDrivePage />} />
          </Route>

          {/* Admin Zones */}
          <Route path="/admin" element={<RoleProtectedRoute allowedRoles={['admin']}><AdminLayout /></RoleProtectedRoute>}>
             <Route index element={<Navigate to="dashboard" replace />} />
             <Route path="dashboard" element={<AdminDashboard health={health} onLogout={() => { void handleLogout('/'); }} />} />
             <Route path="import" element={<DriveSelector />} /> 
          </Route>

          {/* Fallback */}
          {/*<Route path="*" element={<Navigate to={isSignedIn ? "/candidate/dashboard" : "/"} replace />} />*/}
          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
    </>
  );
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}