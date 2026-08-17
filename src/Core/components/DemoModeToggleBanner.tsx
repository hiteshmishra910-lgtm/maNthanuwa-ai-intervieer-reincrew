import React, { useState, useEffect } from 'react';
import { isDemoModeActive, isDemoModeEnabled, setDemoMode, resetDemoMode, subscribeDemoMode } from '../demo/demoMode';
import { Sparkles, EyeOff, RotateCcw, CheckCircle2 } from 'lucide-react';

export const DemoModeToggleBanner: React.FC = () => {
  const [active, setActive] = useState(isDemoModeActive());

  useEffect(() => {
    return subscribeDemoMode(() => {
      setActive(isDemoModeActive());
    });
  }, []);

  if (!isDemoModeEnabled()) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${active ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
        <div className="flex items-center gap-1.5 font-bold text-xs">
          <Sparkles size={14} className={active ? 'text-amber-400' : 'text-slate-400'} />
          <span>Demo Data Mode:</span>
          <span className={`font-black uppercase ${active ? 'text-amber-400' : 'text-slate-400'}`}>
            {active ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
        {active ? (
          <button
            onClick={() => setDemoMode(false)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
            title="Disable demo fallback data and show real production data only"
          >
            <EyeOff size={13} /> Disable Demo Mode
          </button>
        ) : (
          <button
            onClick={() => setDemoMode(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
            title="Enable demo fallback data for customer presentations"
          >
            <Sparkles size={13} /> Enable Demo Mode
          </button>
        )}

        <button
          onClick={() => resetDemoMode()}
          className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          title="Reset demo override to environment default"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
};
