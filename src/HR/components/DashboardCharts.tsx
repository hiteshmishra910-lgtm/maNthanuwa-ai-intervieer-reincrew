import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { DashboardSummary } from '../../Core/demo/demoTypes';
import { OUTCOME_COLORS, SCORE_BAND_COLORS, INTEGRITY_COLORS, CHART_COLORS } from './dashboardChartConfig';
import { Award, PieChart as PieIcon, BarChart2, ShieldCheck, Layers } from 'lucide-react';

interface DashboardChartsProps {
  summary: DashboardSummary;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ summary }) => {
  const { outcomeDistribution, scoreBands, modeComparison, integrityBreakdown } = summary;

  // Outcome Data for Pie/Donut Chart
  const outcomeData = [
    { name: 'Shortlisted', value: outcomeDistribution.shortlisted },
    { name: 'Scheduled', value: outcomeDistribution.scheduled },
    { name: 'Pending Review', value: outcomeDistribution.pending },
    { name: 'Rejected', value: outcomeDistribution.rejected },
  ].filter((item) => item.value > 0);

  // Score Bands Data for Histogram
  const scoreBandData = [
    { band: '90-100% (Top)', count: scoreBands.excellent },
    { band: '75-89% (Strong)', count: scoreBands.strong },
    { band: '60-74% (Competent)', count: scoreBands.competent },
    { band: '<60% (Developing)', count: scoreBands.needsImprovement },
  ];

  // Mode Comparison Data
  const modeData = [
    { mode: 'Voice AI', Candidates: modeComparison.voiceAi.count, 'Avg Score': modeComparison.voiceAi.avgScore },
    { mode: 'Aptitude MCQ', Candidates: modeComparison.aptitude.count, 'Avg Score': modeComparison.aptitude.avgScore },
    { mode: 'Coding & Systems', Candidates: modeComparison.coding.count, 'Avg Score': modeComparison.coding.avgScore },
  ];

  // Integrity Breakdown Data
  const integrityData = [
    { name: 'High (95-100%)', value: integrityBreakdown.highIntegrity },
    { name: 'Moderate (85-94%)', value: integrityBreakdown.moderateIntegrity },
    { name: 'Warnings (<85%)', value: integrityBreakdown.warningIntegrity },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Candidate Hiring Outcome Distribution (Donut Chart) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                <PieIcon size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Hiring Outcome Breakdown</h3>
                <p className="text-[11px] text-slate-400">Distribution of candidate hiring decisions</p>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
              {summary.totalCandidates} Candidates
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {outcomeData.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">No candidate outcomes logged yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {outcomeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[index % OUTCOME_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '600' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: Performance Score Bands (Histogram Bar Chart) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                <BarChart2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Score Distribution Histogram</h3>
                <p className="text-[11px] text-slate-400">Candidate count grouped by score bands</p>
              </div>
            </div>
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
              Avg: {summary.avgScore}%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreBandData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                <XAxis dataKey="band" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {scoreBandData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={SCORE_BAND_COLORS[index % SCORE_BAND_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 3: Assessment Mode Performance Comparison */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
              <Layers size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Assessment Mode Performance</h3>
              <p className="text-[11px] text-slate-400">Comparing candidate volume & average scores across modes</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                <XAxis dataKey="mode" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '600' }} />
                <Bar dataKey="Candidates" fill={CHART_COLORS.indigo} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Avg Score" fill={CHART_COLORS.emerald} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 4: Proctoring & Integrity Health Donut Chart */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Proctoring & Integrity Health</h3>
              <p className="text-[11px] text-slate-400">Candidate compliance & proctoring risk categories</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {integrityData.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">No integrity metrics recorded.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={integrityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }: any) => `${name}: ${value}`}
                  >
                    {integrityData.map((_, index) => (
                      <Cell key={`cell-int-${index}`} fill={INTEGRITY_COLORS[index % INTEGRITY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '600' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
