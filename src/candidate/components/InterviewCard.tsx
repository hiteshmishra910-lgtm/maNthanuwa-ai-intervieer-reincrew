import React from 'react';
import {
  Calendar,
  Clock,
  Award,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface InterviewCardProps {
  role: string;
  date: string;
  score?: number | null;
  status: string;
  recommendation?: string | null;
  riskLevel?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  durationMinutes?: number | null;
  questionsAnswered?: number | null;
  onClick?: () => void;
}

export const InterviewCard: React.FC<InterviewCardProps> = ({
  role,
  date,
  score,
  status,
  recommendation,
  riskLevel,
  strengths,
  weaknesses,
  durationMinutes,
  questionsAnswered,
  onClick,
}) => {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-600';
    if (s >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (s: number) => {
    if (s >= 80) return 'bg-emerald-50 border-emerald-200';
    if (s >= 60) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        );
      case 'TERMINATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Terminated
          </span>
        );
      case 'QUEUED':
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Processing AI Report
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getRecommendationBadge = () => {
    if (!recommendation) return null;
    const colorMap: Record<string, string> = {
      'Strong Hire': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Hire': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Consider': 'bg-amber-50 text-amber-700 border-amber-200',
      'Reject': 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${colorMap[recommendation] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
        <Award size={12} />
        {recommendation}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isProcessing = status === 'QUEUED' || status === 'IN_PROGRESS';

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
            <FileText size={18} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{role}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <Calendar size={12} />
              {formatDate(date)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        {isProcessing ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs font-bold text-indigo-700 animate-pulse">
            AI Report is being compiled... (1-3 minutes)
          </div>
        ) : (
          <>
            {score !== null && score !== undefined && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold ${getScoreBg(score)}`}>
                <TrendingUp size={14} className={getScoreColor(score)} />
                <span className={getScoreColor(score)}>{Math.round(score)}%</span>
              </div>
            )}
            {getRecommendationBadge()}
            {riskLevel && riskLevel !== 'Low' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                riskLevel === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <AlertTriangle size={12} />
                {riskLevel} Risk
              </span>
            )}
          </>
        )}
      </div>

      {durationMinutes && (
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
          <div className="flex items-center gap-1.5">
            <Clock size={13} />
            {durationMinutes} min
          </div>
          {questionsAnswered !== null && questionsAnswered !== undefined && (
            <div className="flex items-center gap-1.5">
              <FileText size={13} />
              {questionsAnswered} questions
            </div>
          )}
        </div>
      )}

      {strengths && strengths.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {strengths.slice(0, 3).map((s, i) => (
            <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
              {s}
            </span>
          ))}
          {strengths.length > 3 && (
            <span className="text-xs text-slate-400">+{strengths.length - 3} more</span>
          )}
        </div>
      )}

      {onClick && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
          <span className="text-xs font-medium text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
            View Details <ChevronRight size={14} />
          </span>
        </div>
      )}
    </div>
  );
};
