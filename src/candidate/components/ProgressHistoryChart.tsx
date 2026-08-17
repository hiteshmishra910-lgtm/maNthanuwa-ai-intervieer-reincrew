import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { AggregatedPerformance } from '../types/performanceTypes';

interface ProgressHistoryChartProps {
  data: AggregatedPerformance;
}

export const ProgressHistoryChart: React.FC<ProgressHistoryChartProps> = ({ data }) => {
  if (data.scoreTrend.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">
        Complete more interviews to see your progress trend over time.
      </div>
    );
  }

  const chartData = data.scoreTrend.map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: t.score,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
          <TrendingUp size={15} className="text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Progress Over Time</h3>
          <p className="text-xs text-slate-400">Score trend across {data.totalInterviews} interview{data.totalInterviews !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#4F46E5"
              strokeWidth={2.5}
              dot={{ fill: '#4F46E5', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};