import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { QuestionPerformance } from '../types/performanceTypes';

interface QuestionWiseBreakdownProps {
  questions: QuestionPerformance[];
}

export const QuestionWiseBreakdown: React.FC<QuestionWiseBreakdownProps> = ({ questions }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (questions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">
        No question-level data available yet.
      </div>
    );
  }

  const getScoreColor = (s: number) => {
    if (s >= 7) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (s >= 4) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-sm">Question-Wise Performance</h3>
        <p className="text-xs text-slate-400 mt-0.5">Across all your completed interviews</p>
      </div>
      <div className="divide-y divide-slate-100">
        {questions.map((q, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="p-4">
              <div
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="flex items-start justify-between gap-3 cursor-pointer"
              >
                <p className="text-sm text-slate-800 font-medium flex-1">{q.questionText}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getScoreColor(q.contentScore)}`}>
                    {q.contentScore}/10
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 pl-1 space-y-2">
                  {q.feedback && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {q.feedback}
                    </p>
                  )}
                  <div className="flex items-start gap-2 bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg">
                    <Lightbulb size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-700 font-medium">{q.suggestion}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};