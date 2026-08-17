import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  Building2,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Globe,
  Users,
  Layers,
} from 'lucide-react';
import { Logo } from '../../Core/components/Logo';
import { useRecruiterOnboarding } from '../hooks/useRecruiterOnboarding';

// ─── Shared field components ──────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
    {children}
  </label>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400
      outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white ${props.className ?? ''}`}
  />
);

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400
      outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white resize-none ${props.className ?? ''}`}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...props }) => (
  <select
    {...props}
    className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900
      outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white ${props.className ?? ''}`}
  >
    {children}
  </select>
);

// ─── Step indicator ───────────────────────────────────────────────────────────

const StepDot: React.FC<{ active: boolean; done: boolean; label: string }> = ({ active, done, label }) => (
  <div className="flex flex-col items-center gap-1">
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
        ${done ? 'bg-indigo-600 border-indigo-600 text-white' : active ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-slate-200 text-slate-400 bg-white'}`}
    >
      {done ? <CheckCircle2 size={16} /> : active ? '●' : '○'}
    </div>
    <span className={`text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
      {label}
    </span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const RecruiterOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const {
    step,
    loading,
    error,
    orgForm,
    driveForm,
    updateOrgForm,
    updateDriveForm,
    submitOrgProfile,
    submitFirstDrive,
    INDUSTRY_OPTIONS,
    COMPANY_SIZE_OPTIONS,
  } = useRecruiterOnboarding();

  // Once onboarding is done, go to HR dashboard
  useEffect(() => {
    if (step === 'done') {
      navigate('/hr/dashboard');
    }
  }, [step, navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <Logo className="w-7 h-7" />
        <span className="text-sm font-bold text-slate-800">Reicrew.ai</span>
        <span className="ml-auto text-xs text-slate-400">
          {user?.primaryEmailAddress?.emailAddress}
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {/* ── STEP 1: Org Profile ─────────────────────────────────────────── */}
          {step === 'org' && (
            <div data-tour="org-profile-step" className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
                  <Building2 size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Set up your organisation</h2>
                  <p className="text-xs text-slate-500">This helps candidates know who they're interviewing with.</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Org name */}
                <div>
                  <Label>Organisation Name <span className="text-red-500">*</span></Label>
                  <Input
                    data-tour="org-name-input"
                    placeholder="e.g. Acme Corp"
                    value={orgForm.org_name}
                    onChange={(e) => updateOrgForm('org_name', e.target.value)}
                  />
                </div>

                {/* Industry */}
                <div>
                  <Label>Industry</Label>
                  <Select
                    value={orgForm.industry}
                    onChange={(e) => updateOrgForm('industry', e.target.value)}
                  >
                    <option value="">Select industry</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </div>

                {/* Company size */}
                <div>
                  <Label>Company Size</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMPANY_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => updateOrgForm('company_size', size)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all
                          ${orgForm.company_size === size
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                      >
                        <Users size={11} />
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Website */}
                <div>
                  <Label>Website <span className="text-slate-400 font-normal normal-case">(optional)</span></Label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="https://yourcompany.com"
                      value={orgForm.website}
                      onChange={(e) => updateOrgForm('website', e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                data-tour="create-drive-btn"
                onClick={submitOrgProfile}
                disabled={loading}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700
                  text-white font-semibold text-sm rounded-xl py-3 transition-all disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ChevronRight size={16} /></>}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};