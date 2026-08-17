import React from 'react';
import { Award, TrendingUp, MessageSquare, FileText } from 'lucide-react';
import { AggregatedPerformance } from '../types/performanceTypes';

interface PerformanceOverviewProps {
  data: AggregatedPerformance;
}

export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({ data }) => {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-600';
    if (s >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const cards = [
    {
      label: 'Average Score',
      value: `${data.averageScore}%`,
      icon: <Award size={18} className="text-indigo-600" />,
      bg: 'bg-indigo-50 border-indigo-100',
    },
    {
      label: 'Technical Performance',
      value: `${data.technicalScore}%`,
      icon: <TrendingUp size={18} className="text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-100',
    },
    {
      label: 'Communication',
      value: `${data.communicationScore}%`,
      icon: <MessageSquare size={18} className="text-sky-600" />,
      bg: 'bg-sky-50 border-sky-100',
    },
    {
      label: 'Total Interviews',
      value: `${data.totalInterviews}`,
      icon: <FileText size={18} className="text-amber-600" />,
      bg: 'bg-amber-50 border-amber-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${c.bg}`}>
              {c.icon}
            </div>
          </div>
          <p className={`text-2xl font-bold ${c.label.includes('Total') ? 'text-slate-900' : getScoreColor(parseInt(c.value))}`}>
            {c.value}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
};