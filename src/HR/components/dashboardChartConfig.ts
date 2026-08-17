export const CHART_COLORS = {
  emerald: '#10B981',
  indigo: '#6366F1',
  amber: '#F59E0B',
  rose: '#F43F5E',
  sky: '#0EA5E9',
  purple: '#8B5CF6',
  slate: '#94A3B8',
};

export const OUTCOME_COLORS = [
  CHART_COLORS.emerald, // Shortlisted
  CHART_COLORS.indigo,  // Scheduled
  CHART_COLORS.amber,   // Pending
  CHART_COLORS.rose,    // Rejected
];

export const SCORE_BAND_COLORS = [
  CHART_COLORS.emerald, // 90-100%
  CHART_COLORS.indigo,  // 75-89%
  CHART_COLORS.sky,     // 60-74%
  CHART_COLORS.rose,    // <60%
];

export const INTEGRITY_COLORS = [
  CHART_COLORS.emerald, // High Integrity (90-100%)
  CHART_COLORS.amber,   // Moderate Integrity (70-89%)
  CHART_COLORS.rose,    // Warning (<70%)
];
