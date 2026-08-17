import React, { useEffect, useState } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';
import { setSupabaseAuthToken } from '../../Core/database/supabaseClient';
import { GraduationCap, Briefcase, ShieldCheck, ChevronRight, Sparkles, Loader2, XCircle } from 'lucide-react';
import { Logo } from '../../Core/components/Logo';
import { supabase } from '../../Core/database/supabaseClient';
import { useTour } from "../../tours/useTour";

export const RoleLandingPage: React.FC = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [unauthorizedMsg, setUnauthorizedMsg] = useState<string | null>(null);

  // Check role from admin_users table (same logic as RoleProtectedRoute)
  useEffect(() => {
    const checkRole = async () => {
      if (!isSignedIn || !user) {
        setRoleChecked(true);
        return;
      }

      try {
        const token = await getToken({ template: 'supabase' });
        if (token) setSupabaseAuthToken(token);
      } catch {
        const token = await getToken();
        if (token) setSupabaseAuthToken(token);
      }

      const email = (user.primaryEmailAddress?.emailAddress || '').trim();
      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .ilike('email', email)
        .maybeSingle();
      setUserRole(data?.role ?? null);
      setRoleChecked(true);
    };
    if (isLoaded) checkRole();
  }, [isLoaded, isSignedIn, user]);

  useTour({
  role: "candidate",
  steps: [
    {
      id: "welcome-intro",
      title: "👋 Welcome to Reicrew.AI",
      text: "<p>This is your role selection screen. Choose how you'd like to continue — as a Candidate, Recruiter, or Admin.</p>",
    },
    {
      id: "candidate-card-step",
      title: "I'm a Candidate",
      text: "<p>Click here if you're appearing for an interview. You'll need an access key from your recruiter to start.</p>",
      attachTo: { element: '[data-tour="candidate-role-card"]', on: "bottom" },
    },
    {
      id: "hr-card-step",
      title: "I'm a Recruiter",
      text: "<p>Click here to manage interview drives, import candidates, and review AI evaluation reports. Requires HR access.</p>",
      attachTo: { element: '[data-tour="hr-role-card"]', on: "bottom" },
    },
    {
      id: "admin-card-step",
      title: "I'm an Admin",
      text: "<p>Full platform control — manage users, API keys, and system settings. Requires admin access.</p>",
      attachTo: { element: '[data-tour="admin-role-card"]', on: "bottom" },
    },
  ],
  autoStart: true,
});

  if (!isLoaded || (isSignedIn && !roleChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const handleStudentClick = () => {
    setUnauthorizedMsg(null);
    if (isSignedIn) {
      window.location.href = '/candidate/dashboard';
    }
    // if not signed in — SignInButton handles it (see JSX below)
  };

  const handleHRClick = () => {
    setUnauthorizedMsg(null);
    if (!isSignedIn) return; // SignInButton handles redirect
    if (userRole === 'hr' || userRole === 'admin') {
      window.location.href = '/hr/dashboard';
    } else {
      setUnauthorizedMsg('You are not authorized to access the HR portal. Please contact your administrator.');
    }
  };

  const handleAdminClick = () => {
    setUnauthorizedMsg(null);
    if (!isSignedIn) return; // SignInButton handles redirect
    if (userRole === 'admin') {
      window.location.href = '/admin/dashboard';
    } else {
      setUnauthorizedMsg('You are not authorized to access the Admin portal.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="w-7 h-7" />
          <span className="text-sm font-bold text-slate-800">Reicrew.ai</span>
        </div>
        {isSignedIn && (
          <span className="text-xs text-slate-400">
            {user?.primaryEmailAddress?.emailAddress}
          </span>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10 max-w-lg">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600
            text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Sparkles size={11} />
            AI-Powered Interview Platform
          </div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">Welcome to Reicrew</h1>
          <p className="text-slate-500 mt-2 text-sm">Select how you'd like to continue.</p>
        </div>

        {/* Unauthorized message */}
        {unauthorizedMsg && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm
            px-4 py-3 rounded-xl mb-6 max-w-lg w-full">
            <XCircle size={16} className="shrink-0" />
            {unauthorizedMsg}
          </div>
        )}

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">

          {/* Student card */}
          {isSignedIn ? (
            <button
              onClick={handleStudentClick}
              data-tour="candidate-role-card"
              className="bg-white border border-slate-200 rounded-2xl p-6 text-left flex flex-col gap-4
                transition-all duration-200 shadow-sm hover:shadow-lg hover:border-indigo-300 group"
            >
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <GraduationCap size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-900 mb-1">I'm a Candidate</h2>
                <p className="text-xs text-slate-500 leading-relaxed">Attend interviews, join campus drives, or practice with AI mock sessions.</p>
              </div>
              <div className="flex items-center justify-between w-full bg-indigo-600 hover:bg-indigo-700
                text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Go to Dashboard <ChevronRight size={16} />
              </div>
            </button>
          ) : (
            <SignInButton mode="redirect" forceRedirectUrl="/welcome">
              <button className="bg-white border border-slate-200 rounded-2xl p-6 text-left flex flex-col gap-4
                transition-all duration-200 shadow-sm hover:shadow-lg hover:border-indigo-300 group">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <GraduationCap size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-slate-900 mb-1">I'm a Candidate</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">Attend interviews, join campus drives, or practice with AI mock sessions.</p>
                </div>
                <div className="flex items-center justify-between w-full bg-indigo-600 hover:bg-indigo-700
                  text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  Sign In to Continue <ChevronRight size={16} />
                </div>
              </button>
            </SignInButton>
          )}

          {/* HR card */}
          {isSignedIn ? (
            <button
              onClick={handleHRClick}
              data-tour="hr-role-card"
              className="bg-white border border-slate-200 rounded-2xl p-6 text-left flex flex-col gap-4
                transition-all duration-200 shadow-sm hover:shadow-lg hover:border-emerald-300 group"
            >
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <Briefcase size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-900 mb-1">I'm a Recruiter</h2>
                <p className="text-xs text-slate-500 leading-relaxed">Set up your organisation, create interview drives, and review candidate reports.</p>
              </div>
              <div className="flex items-center justify-between w-full bg-emerald-600 hover:bg-emerald-700
                text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                HR Dashboard <ChevronRight size={16} />
              </div>
            </button>
          ) : (
            <SignInButton mode="redirect" forceRedirectUrl="/welcome">
              <button className="bg-white border border-slate-200 rounded-2xl p-6 text-left flex flex-col gap-4
                transition-all duration-200 shadow-sm hover:shadow-lg hover:border-emerald-300 group">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <Briefcase size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-slate-900 mb-1">I'm a Recruiter</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">Set up your organisation, create interview drives, and review candidate reports.</p>
                </div>
                <div className="flex items-center justify-between w-full bg-emerald-600 hover:bg-emerald-700
                  text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  Sign In to Continue <ChevronRight size={16} />
                </div>
              </button>
            </SignInButton>
          )}

          {/* Admin card */}
          {isSignedIn ? (
            <button
              onClick={handleAdminClick}
              data-tour="admin-role-card" 
              className="bg-white border border-slate-200 rounded-2xl p-6 text-left flex flex-col gap-4
                transition-all duration-200 shadow-sm hover:shadow-lg hover:border-slate-400 group"
            >
              <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-900 mb-1">I'm an Admin</h2>
                <p className="text-xs text-slate-500 leading-relaxed">Manage platform settings, users, and system health.</p>
              </div>
              <div className="flex items-center justify-between w-full bg-slate-700 hover:bg-slate-800
                text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Admin Portal <ChevronRight size={16} />
              </div>
            </button>
          ) : (
            <SignInButton mode="redirect" forceRedirectUrl="/welcome">
              <button className="bg-white border border-slate-200 rounded-2xl p-6 text-left flex flex-col gap-4
                transition-all duration-200 shadow-sm hover:shadow-lg hover:border-slate-400 group">
                <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600">
                  <ShieldCheck size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-slate-900 mb-1">I'm an Admin</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">Manage platform settings, users, and system health.</p>
                </div>
                <div className="flex items-center justify-between w-full bg-slate-700 hover:bg-slate-800
                  text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  Sign In to Continue <ChevronRight size={16} />
                </div>
              </button>
            </SignInButton>
          )}

        </div>

        <p className="mt-8 text-xs text-slate-400">Secured with Clerk · Reicrew.ai v2.0</p>
      </main>
    </div>
  );
};