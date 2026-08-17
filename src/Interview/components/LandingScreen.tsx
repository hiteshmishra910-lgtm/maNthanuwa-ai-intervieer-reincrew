import React, { useState, useEffect } from 'react';
import { useAuth, useUser, SignIn } from "@clerk/clerk-react";
import { Logo } from '../../Core/components/Logo';
import { User, Mail, Briefcase, ArrowRight, ChevronDown, ShieldCheck, AlertCircle, Loader2, Calendar, Clock } from 'lucide-react';
import { mediaPipeService } from '../../Proctoring/services/mediaPipeService';
import { supabase , setSupabaseAuthToken, setClerkToken} from "../../Core/database/supabaseClient";
import { PasswordReset } from './PasswordReset';
import { ErrorLogService } from '../../Core/logging/errorLogService';
import { getJobTemplateByAccessKey } from '../../Core/database/jobSeedRepository';
import { InterviewRoles, InterviewRole } from '../../../types';
import { SupabaseService } from '../../Core/database/supabaseService';
import { isExpired, getTimeRemaining, canStartAssignment, deriveAssignmentStatus } from '../../Core/utils/deadlineService';
import { useAppLogout } from '../../hooks/useAppLogout';

interface LandingScreenProps {
  onStart: (data: { name: string; email: string; role: string; clerkUserId: string; clerkToken: string; assignmentId?: string; }) => void;
  onAdminAccess: () => void;
  onHRAccess?: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onStart, onAdminAccess, onHRAccess }) => {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const handleLogout = useAppLogout();
  const [showReset, setShowReset] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.firstName || "",
    email: user?.primaryEmailAddress?.emailAddress || "",
    role: "",
    accessKey: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [candidateAssignments, setCandidateAssignments] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

const [isSupabaseReady, setIsSupabaseReady] = useState(false);

useEffect(() => {
  const initSupabaseAuth = async () => {
    try {
      let token = null;
      let rawClerkToken = null;
      try {
        rawClerkToken = await getToken();          // raw Clerk JWT for edge functions
        token = await getToken({ template: 'supabase' });
      } catch (e: any) {
        console.warn("[Clerk] Supabase template token failed, falling back to standard session token:", e.message || e);
        token = rawClerkToken;
      }
      setClerkToken(rawClerkToken);               // store for edge function auth
      if (token) {
        setSupabaseAuthToken(token);
      }
    } catch (err) {
      console.warn("[Clerk] Failed to retrieve any auth token:", err);
    } finally {
      setIsSupabaseReady(true);
    }
  };
  
  if (isSignedIn) {
    initSupabaseAuth();
  }
}, [isSignedIn]);

  useEffect(() => {
    const fetchCandidateAssignments = async () => {
      if (!user?.primaryEmailAddress?.emailAddress || !isSupabaseReady) return;
      setIsLoadingAssignments(true);
      try {
        const email = user.primaryEmailAddress.emailAddress;
        const data = await SupabaseService.getAssignmentsByEmail(email);
        setCandidateAssignments(data || []);
      } catch (err) {
        console.warn("Failed to fetch candidate assignments:", err);
      } finally {
        setIsLoadingAssignments(false);
      }
    };

    fetchCandidateAssignments();
  }, [user, isSupabaseReady]);

useEffect(() => {
  if (user) {
    setFormData(prev => ({
      ...prev,
      name: user.fullName || 
            `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
            user.username || 
            user.primaryEmailAddress?.emailAddress.split('@')[0] || '',
      email: user.primaryEmailAddress?.emailAddress || '',
    }));
  }
}, [user]);

  useEffect(() => {
    const preload = () => {
      mediaPipeService
        .preload()
        .catch((err) => console.error("MediaPipe preload failed:", err));
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(preload);
    } else {
      setTimeout(preload, 2000);
    }
  }, []);

  if (!isSignedIn && !isSupabaseReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center py-6 px-4 sm:py-12 sm:px-6 relative overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-size-[20px_20px] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>

        <div className="w-full max-w-md md:max-w-lg mx-auto z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200/50 border border-slate-100 mb-6">
              <Logo className="w-12 h-12" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-center">
              Sign In to <span className="text-indigo-600">Get Started</span>
            </h1>
            <p className="text-slate-500 mt-3 text-center text-base sm:text-lg max-w-md">
              Create an account or sign in to begin your assessment.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-4 sm:p-6 md:p-8 rounded-3xl md:rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col items-center">
            {showReset ? (
              <PasswordReset onBack={() => setShowReset(false)} />
            ) : (
              <div className="w-full flex flex-col items-center">
                <SignIn 
                  appearance={{
                    elements: {
                      rootBox: "w-full flex flex-col items-center justify-center mx-auto",
                      cardBox: "w-full max-w-md mx-auto shadow-none border-0 p-0 m-0 bg-transparent flex flex-col items-center justify-center",
                      card: "w-full max-w-md mx-auto shadow-none border-0 p-0 m-0 bg-transparent flex flex-col items-center justify-center text-center",
                      main: "w-full max-w-md mx-auto flex flex-col items-center",
                      header: "w-full text-center flex flex-col items-center mb-4",
                      headerTitle: "text-slate-900 font-extrabold text-xl text-center w-full",
                      headerSubtitle: "text-slate-500 text-sm text-center w-full",
                      socialButtonsBlockButton: "w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl py-2.5 transition-all duration-200 flex justify-center items-center gap-2",
                      socialButtonsBlockButtonText: "font-semibold text-slate-700 text-sm",
                      form: "w-full space-y-4",
                      formField: "w-full text-left",
                      formFieldLabel: "text-slate-700 font-semibold text-xs uppercase tracking-wider block mb-1.5",
                      formFieldInput: "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all duration-200 text-sm",
                      formButtonPrimary: "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md shadow-indigo-200 transition-all duration-200 text-sm mt-2",
                      footerAction: "w-full text-center flex justify-center items-center mt-4",
                      footerActionLink: "text-indigo-600 hover:text-indigo-700 font-semibold text-sm",
                      footer: "w-full text-center flex justify-center items-center mt-4 border-t border-slate-100 pt-4",
                      identityPreviewText: "text-slate-700 font-medium text-sm",
                      identityPreviewEditButton: "text-indigo-600 hover:text-indigo-700 font-semibold text-xs ml-2",
                    }
                  }}
                />
                <button
                  onClick={() => setShowReset(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 mt-4 w-full text-center block font-medium"
                >
                  Having trouble resetting your password?
                </button>
              </div>
            )}
          </div>

          <p className="text-slate-400 text-xs text-center mt-10 font-medium tracking-wide">
            OFFICIAL TECHNICAL ASSESSMENT PORTAL v2.0 — SECURED WITH CLERK
          </p>
        </div>
      </div>
    );
  }

  const handleStartAssignment = async (assignment: any) => {
    setIsLoading(true);
    setError("");
    try {
      let clerkToken = null;
      try {
        clerkToken = await getToken({ template: 'supabase' });
      } catch (e: any) {
        clerkToken = await getToken();
      }

      let role = "CSE";
      try {
        // With the consolidated schema, assignments link to drives rather than job posts.
        // Determine the role from the drive title.
        if (assignment.drive_id) {
          const { data: drive } = await supabase
            .from('interview_drives')
            .select('title')
            .eq('id', assignment.drive_id)
            .single();
          const title = drive?.title || '';
          if (title.toLowerCase().includes("aptitude")) {
            role = "APTITUDE";
          } else if (title.toLowerCase().includes("ece") || title.toLowerCase().includes("etc") || title.toLowerCase().includes("electron")) {
            role = "ETC";
          }
        }
      } catch (jobErr) {
        console.warn("Failed to fetch job details for role mapping, using CSE:", jobErr);
      }

      onStart({
        name: formData.name || user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Candidate',
        email: assignment.candidate_email,
        role: role,
        clerkUserId: user?.id || '',
        clerkToken: clerkToken || '',
        assignmentId: assignment.id
      });
    } catch (err: any) {
      console.error("Failed to start assignment:", err);
      setError(err.message || "Failed to start interview.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
   
    if (!formData.name || !formData.email || !formData.role || !formData.accessKey) {
      setError('Please fill in all fields to proceed.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid professional email.');
      return;
    }
    setIsLoading(true);
    try {
      // SECURITY FIX: Validate access key against DB, not hardcoded values
      const roleTitleMap: Record<string, string> = {
        ...InterviewRoles,
        APTITUDE: 'Aptitude',
      };

      const roleTitle = roleTitleMap[formData.role];
      if (!roleTitle) {
        setError('Role not found. Please select a valid role.');
        setIsLoading(false);
        return;
      }

      try {
        let freshToken = null;
        let rawClerkToken = null;
        try {
          rawClerkToken = await getToken();          // raw Clerk JWT for edge functions
          freshToken = await getToken({ template: 'supabase' });
        } catch (e: any) {
          console.warn("[Clerk] Supabase template token failed, falling back to standard session token:", e.message || e);
          freshToken = rawClerkToken;
        }
        setClerkToken(rawClerkToken);               // store for edge function auth
        if (freshToken) setSupabaseAuthToken(freshToken);

      } catch (err) {
        console.warn("[Clerk] Failed to set auth token:", err);
      }
      console.log('accessKey entered:', JSON.stringify(formData.accessKey));
      // First check if it matches a built-in seeded JOB_TEMPLATE (used for testing / default modes)
      const localTemplate = getJobTemplateByAccessKey(formData.accessKey);

      if (!localTemplate) {
        // Query drive_access_keys (replaces old job_posts.access_key — that column is being removed)
        const validatedDrive = await SupabaseService.verifyAccessKey(formData.accessKey);
        console.log('validatedDrive result:', validatedDrive);
        if (!validatedDrive) {
          setError('Invalid access key. Please check with your recruiter and try again.');
          setIsLoading(false);
          return;
        }
      }

      let finalToken = null;
      try {
        finalToken = await getToken({ template: 'supabase' });
      } catch {
        finalToken = await getToken();
      }  
      setError('');
      onStart({
        ...formData,
        clerkUserId: user?.id || '',
        clerkToken: finalToken || '',
      });
    } catch (err) {
      setError('Failed to validate access key. Please try again.');
      ErrorLogService.logWarning('system', 'Access key validation failed', err, undefined, formData.name);
    } finally {
      setIsLoading(false);
    }

  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center py-6 px-4 sm:py-12 sm:px-6 relative overflow-y-auto">
      {/* Top-right Admin Access button */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-5 z-20 flex items-center gap-1 sm:gap-2">
        {isSignedIn && (
          <button
            onClick={() => { void handleLogout('/'); }}
            title="Sign Out"
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 text-xs font-medium transition-all p-2 sm:py-2 sm:px-3.5 rounded-xl border border-transparent hover:border-red-200 hover:bg-red-50 hover:shadow-sm group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-red-500 transition-colors shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        )}
        <button
          id="hr-access-btn"
          onClick={onHRAccess || (() => { window.location.href = '/hr' })}
          title="HR Portal"
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium transition-all p-2 sm:py-2 sm:px-3.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-sm group"
        >
          <Briefcase size={14} className="group-hover:text-indigo-500 transition-colors shrink-0" />
          <span className="hidden sm:inline">HR Portal</span>
        </button>
        <button
          id="admin-access-btn"
          onClick={onAdminAccess}
          title="Admin"
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium transition-all p-2 sm:py-2 sm:px-3.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-sm group"
        >
          <ShieldCheck size={14} className="group-hover:text-indigo-500 transition-colors shrink-0" />
          <span className="hidden sm:inline">Admin</span>
        </button>
      </div>
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-size-[20px_20px] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>
      
      <div className="w-full max-w-xl z-10">
        <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200/50 border border-slate-100 mb-6">
            <Logo className="w-12 h-12" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-center">
            Elevate Your <span className="text-indigo-600">Career Potential</span>
          </h1>
          <p className="text-slate-500 mt-4 text-center text-lg max-w-md">
            Enter your details to begin your AI-powered technical assessment today.
          </p>
        </div>

        {candidateAssignments.length > 0 ? (
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl md:rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] animate-in fade-in zoom-in duration-500 space-y-6 text-left">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xl font-extrabold text-slate-800">Your Assigned Assessments</h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Below are the assessments assigned to your email address: <span className="font-mono text-indigo-600">{user?.primaryEmailAddress?.emailAddress}</span></p>
            </div>

            <div className="space-y-4">
              {candidateAssignments.map((a: any) => {
                const status = deriveAssignmentStatus(a);
                const isCompleted = status === 'COMPLETED';
                const isAbsent = status === 'ABSENT';
                const isStarted = status === 'IN_PROGRESS';
                const active = canStartAssignment(a);

                const timeRemaining = a.deadline ? getTimeRemaining(a.deadline) : null;

                return (
                  <div key={a.id} className="p-5 rounded-2xl border border-slate-200/85 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 font-semibold text-xs">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-sm text-slate-800">{a.job_title || 'AI Technical Assessment'}</h4>
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                          status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          status === 'INVITED' || status === 'VERIFIED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                          'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      {a.notes && <p className="text-slate-400 text-[11px] italic font-medium">Notes: {a.notes}</p>}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          Attempts: {a.attempts_used} / {a.max_attempts}
                        </span>
                        {a.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            {isAbsent ? (
                              <span className="text-rose-600 font-bold">Deadline Passed</span>
                            ) : timeRemaining ? (
                              <span>Ends: {timeRemaining.display}</span>
                            ) : null}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {active ? (
                        <button
                          onClick={() => handleStartAssignment(a)}
                          disabled={isLoading}
                          className="w-full md:w-auto flex items-center justify-center gap-1.5 px-5 py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:bg-slate-400 text-xs"
                        >
                          {isStarted ? 'Resume' : 'Start'} Interview
                          <ArrowRight size={14} />
                        </button>
                      ) : (
                        <span className="text-[11px] font-black uppercase text-slate-400 border border-slate-200 bg-slate-100 px-3.5 py-2.5 rounded-xl block text-center select-none">
                          {isCompleted ? '✓ Completed' : isAbsent ? '✕ Expired' : '✕ Exhausted'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-500 px-5 py-4 rounded-2xl text-xs font-semibold animate-shake flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 p-4 sm:p-6 md:p-8 rounded-3xl md:rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] animate-in fade-in zoom-in duration-500">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3 font-semibold text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <User size={20} />
                  </div>
                  <input
                    aria-label="Full Name"
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-14 pr-6 py-4.5 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300 font-sans"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3 font-semibold text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    aria-label="Email Address"
                    type="email"
                    placeholder="alex@company.com"
                    className="w-full bg-slate-150 border border-slate-200 text-slate-900 pl-14 pr-6 py-4.5 rounded-2xl outline-none cursor-not-allowed opacity-75 transition-all font-sans"
                    value={formData.email}
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-3 font-semibold text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Academic Path</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10">
                    <Briefcase size={20} />
                  </div>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-14 pr-12 py-4.5 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer font-bold"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="" disabled>Select your role</option>
                    {Object.entries(InterviewRoles).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                    <option value="APTITUDE">Aptitude Test</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              <div className="space-y-3 font-semibold text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Access Key</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10">
                    <ShieldCheck size={20} />
                  </div>
                  <input
                    aria-label="Access Key"
                    type="password"
                    placeholder="Enter your access key"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-14 pr-6 py-4.5 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300 font-sans"
                    value={formData.accessKey}
                    onChange={e => setFormData({ ...formData, accessKey: e.target.value })}
                  />
                </div>
                <p className="text-[11px] text-slate-400 ml-1 font-medium leading-tight">Ask your recruiter for your access key</p>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-500 px-5 py-4 rounded-2xl text-xs font-semibold animate-shake flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-5 rounded-2xl font-bold text-base shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3 group active:scale-[0.99]"
              >
                Start Your Interview
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        )}
        
        <p className="text-slate-400 text-xs text-center mt-10 font-medium tracking-wide">
          OFFICIAL TECHNICAL ASSESSMENT PORTAL v2.0
        </p>
      </div>
    </div>
  );
};
