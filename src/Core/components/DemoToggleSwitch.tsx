import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { isDemoModeActive, setDemoMode, subscribeDemoMode } from '../demo/demoMode';

interface DemoToggleSwitchProps {
  className?: string;
}

export const DemoToggleSwitch: React.FC<DemoToggleSwitchProps> = ({ className = '' }) => {
  const [active, setActive] = useState<boolean>(isDemoModeActive());

  useEffect(() => {
    return subscribeDemoMode(() => {
      setActive(isDemoModeActive());
    });
  }, []);

  const handleToggle = () => {
    setDemoMode(!active);
  };

  return (
    <div
      onClick={handleToggle}
      title={active ? 'Showcase Demo Mode is ON (Showcase dataset overlaid for recruiter presentations)' : 'Showcase Demo Mode is OFF (Showing real Supabase production database records only)'}
      className={`flex items-center gap-2 cursor-pointer select-none py-1.5 px-3 rounded-full border transition-all text-xs font-semibold ${
        active
          ? 'bg-amber-500/10 text-amber-600 border-amber-300 hover:bg-amber-500/20'
          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200/80 hover:text-slate-700'
      } ${className}`}
    >
      <Sparkles size={14} className={active ? 'text-amber-500 animate-pulse' : 'text-slate-400'} />
      <span>{active ? 'Showcase Demo: ON' : 'Showcase Demo: OFF'}</span>
      <div
        className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
          active ? 'bg-amber-500' : 'bg-slate-300'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
            active ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
};
