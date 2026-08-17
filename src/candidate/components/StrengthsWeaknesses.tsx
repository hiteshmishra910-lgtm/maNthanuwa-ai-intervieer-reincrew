import React from 'react';
import { ThumbsUp, AlertTriangle } from 'lucide-react';
import { AggregatedPerformance } from '../types/performanceTypes';

interface StrengthsWeaknessesProps {
  data: AggregatedPerformance;
}

export const StrengthsWeaknesses: React.FC<StrengthsWeaknessesProps> = ({ data }) => {
  if (data.totalInterviews === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">
        Complete an interview to see your strengths and improvement areas.
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100">
            <ThumbsUp size={15} className="text-emerald-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Top Strengths</h3>
        </div>
        {data.topStrengths.length === 0 ? (
          <p className="text-xs text-slate-400">No recurring strengths identified yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.topStrengths.map((s, i) => (
              <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 font-medium">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100">
            <AlertTriangle size={15} className="text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Areas to Improve</h3>
        </div>
        {data.topWeaknesses.length === 0 ? (
          <p className="text-xs text-slate-400">No recurring weaknesses identified yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.topWeaknesses.map((w, i) => (
              <span key={i} className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100 font-medium">
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};