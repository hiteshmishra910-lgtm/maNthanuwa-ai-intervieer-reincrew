import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Logo } from '../../Core/components/Logo';
import { ArrowRight, ArrowLeft, Loader2, AlertCircle, Zap, BookOpen, Layers, GraduationCap, Briefcase, TrendingUp, Award } from 'lucide-react';
import { InterviewRoles, InterviewRole, CandidateTargetProfile, CandidateTargetProfileOptions } from '../../../types';
import {
  usePracticeSession,
  PracticeConfig,
  PracticeCandidate,
  PracticeDifficulty,
  PracticeInterviewType,
} from '../hooks/usePracticeSession';

interface PracticeSetupScreenProps {
  onStart: (candidate: PracticeCandidate) => void;
  onBack: () => void;
}

const DIFFICULTY_OPTIONS: { value: PracticeDifficulty; label: string; desc: string; color: string }[] = [
  { value: 'easy',   label: 'Beginner',     desc: 'Fundamentals & definitions',   color: 'emerald' },
  { value: 'medium', label: 'Intermediate', desc: 'Applied concepts & scenarios',  color: 'amber'   },
  { value: 'hard',   label: 'Advanced',     desc: 'Architecture & edge cases',     color: 'rose'    },
];

const TYPE_OPTIONS: { value: PracticeInterviewType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'technical',  label: 'Technical',  desc: 'Core concepts & problem solving', icon: <Zap size={18} />        },
  { value: 'behavioral', label: 'Behavioral', desc: 'Situational & soft skills',       icon: <BookOpen size={18} />   },
  { value: 'mixed',      label: 'Mixed',      desc: 'Both technical & behavioral',     icon: <Layers size={18} />     },
];

const COLOR_MAP: Record<string, string> = {
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-emerald-400',
  amber:   'border-amber-300   bg-amber-50   text-amber-700   ring-amber-400',
  rose:    'border-rose-300    bg-rose-50    text-rose-700    ring-rose-400',
};

export const PracticeSetupScreen: React.FC<PracticeSetupScreenProps> = ({ onStart, onBack }) => {
  const { user } = useUser();
  const { isLoading, error, createPracticeSession } = usePracticeSession();

  const [selectedRole, setSelectedRole]       = useState<InterviewRole | ''>('');
  const [selectedDiff, setSelectedDiff]       = useState<PracticeDifficulty>('medium');
  const [selectedType, setSelectedType]       = useState<PracticeInterviewType>('mixed');
  const [selectedProfile, setSelectedProfile] = useState<CandidateTargetProfile>('FRESHER');
  const [validationErr, setValidationErr]     = useState('');

  const handleStart = async () => {
    if (!selectedRole) {
      setValidationErr('Please select a domain to continue.');
      return;
    }
    setValidationErr('');

    const config: PracticeConfig = {
      role: selectedRole as InterviewRole,
      difficulty: selectedDiff,
      interviewType: selectedType,
      targetProfile: selectedProfile,
    };

    const candidate = await createPracticeSession(config);
    if (candidate) onStart(candidate);
  };

  const displayError = validationErr || error;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center py-6 px-4 sm:py-12 sm:px-6 relative overflow-y-auto">
      {/* Top Back button */}
      <button
        onClick={onBack}
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-20 flex items-center gap-2 text-slate-500 hover:text-slate-900 bg-white/90 hover:bg-white backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold transition-all cursor-pointer group"
      >
        <ArrowLeft size={15} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
        <span>Back to Dashboard</span>
      </button>

      {/* Dot grid background */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-size-[20px_20px] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      <div className="w-full max-w-2xl z-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100">
            <Logo className="w-10 h-10" />
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.2em] mb-1">Practice Mode</p>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Set Up Your Practice Interview
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
              Hi {user?.firstName || 'there'} — choose your focus area, difficulty, and interview style below.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 animate-in fade-in zoom-in duration-500">

          {/* Domain */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Domain / Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(InterviewRoles) as [InterviewRole, string][]).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => { setSelectedRole(code); setValidationErr(''); }}
                  className={`px-3 py-3 rounded-xl border-2 text-left transition-all text-sm font-semibold ${
                    selectedRole === code
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-black tracking-wide">{code}</span>
                  <span className="block text-[11px] text-current opacity-70 mt-0.5 leading-tight">
                    {name.split('(')[0].trim()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Difficulty
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {DIFFICULTY_OPTIONS.map(({ value, label, desc, color }) => (
                <button
                  key={value}
                  onClick={() => setSelectedDiff(value)}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${
                    selectedDiff === value
                      ? `${COLOR_MAP[color]} border-current ring-2`
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className="block font-bold text-sm">{label}</span>
                  <span className="block text-[11px] opacity-70 mt-0.5 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interview Type */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Interview Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {TYPE_OPTIONS.map(({ value, label, desc, icon }) => (
                <button
                  key={value}
                  onClick={() => setSelectedType(value)}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${
                    selectedType === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className={`mb-1 block ${selectedType === value ? 'text-indigo-500' : 'text-slate-400'}`}>
                    {icon}
                  </span>
                  <span className="block font-bold text-sm">{label}</span>
                  <span className="block text-[11px] opacity-70 mt-0.5 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Profile */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Your Experience Level
            </label>
            <p className="text-[11px] text-slate-400 -mt-1">
              This calibrates feedback context only — it never changes your raw score.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CandidateTargetProfileOptions.map(({ value, label, desc }) => {
                const icons: Record<string, React.ReactNode> = {
                  'COLLEGE_STUDENT': <GraduationCap size={18} />,
                  'FRESHER': <Briefcase size={18} />,
                  'MID_LEVEL': <TrendingUp size={18} />,
                  'SENIOR_LEAD': <Award size={18} />,
                };
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedProfile(value)}
                    className={`px-3 py-4 rounded-xl border-2 text-left transition-all ${
                      selectedProfile === value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className={`mb-1 block ${selectedProfile === value ? 'text-indigo-500' : 'text-slate-400'}`}>
                      {icons[value]}
                    </span>
                    <span className="block font-bold text-sm">{label}</span>
                    <span className="block text-[11px] opacity-70 mt-0.5 leading-tight">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {displayError && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium">
              <AlertCircle size={16} className="shrink-0" />
              {displayError}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onBack}
              disabled={isLoading}
              className="sm:w-auto px-6 py-4 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <button
              onClick={handleStart}
              disabled={isLoading || !selectedRole}
              className="flex-1 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-2xl font-bold text-base shadow-xl shadow-slate-200/50 transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Setting up session...
                </>
              ) : (
                <>
                  Start Practice Interview
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Note */}
        <p className="text-center text-xs text-slate-400 font-medium">
          Practice sessions use your camera to simulate a real interview, but they don't affect your assessment record.
        </p>
      </div>
    </div>
  );
};