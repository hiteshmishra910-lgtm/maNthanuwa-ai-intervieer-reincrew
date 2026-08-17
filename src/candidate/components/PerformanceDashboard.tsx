import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { SupabaseService } from '../../Core/database/supabaseService';
import { supabase } from '../../Core/database/supabaseClient';
import { SessionRecord, AggregatedPerformance, QuestionPerformance } from '../types/performanceTypes';
import { aggregatePerformance, fetchQuestionWisePerformance } from '../services/performanceService';
import { PerformanceOverview } from './PerformanceOverview';
import { StrengthsWeaknesses } from './StrengthsWeaknesses';
import { QuestionWiseBreakdown } from './QuestionWiseBreakdown';
import { ProgressHistoryChart } from './ProgressHistoryChart';

interface PerformanceDashboardProps {
  candidateId: string;
  candidateName: string; // needed since vw_candidate_qa_details joins by name, not candidateId
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ candidateId, candidateName }) => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedPerformance | null>(null);
  const [questionPerformance, setQuestionPerformance] = useState<QuestionPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!candidateId) {
        setLoading(false);
        return;
      }
      try {
        const [sessionData, questionData] = await Promise.all([
            SupabaseService.getStudentSessions(candidateId),
            fetchQuestionWisePerformance(supabase, candidateName),
        ]);

        const sessionList = sessionData || [];
        setSessions(sessionList);
        setAggregated(aggregatePerformance(sessionList, questionData));
        setQuestionPerformance(questionData);
      } catch (err: any) {
        setError(err?.message || 'Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [candidateId, candidateName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading your performance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <AlertCircle className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (!aggregated) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Performance Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your detailed results, strengths, and progress across all interviews.
        </p>
      </div>

      <PerformanceOverview data={aggregated} />
      <ProgressHistoryChart data={aggregated} />
      <StrengthsWeaknesses data={aggregated} />
      <QuestionWiseBreakdown questions={questionPerformance} />
    </div>
  );
};