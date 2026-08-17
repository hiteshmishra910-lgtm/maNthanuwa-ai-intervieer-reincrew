import { DemoDataProvider } from './demoDataProvider';
import { ProductionDataProvider } from './productionDataProvider';
import { DashboardSummary } from '../demo/demoTypes';
import { isDemoModeActive } from '../demo/demoMode';

/**
 * Canonical Date Resolution & Real-First Sorting Helper for Sessions
 */
export function sortSessionsRealFirst<T extends { isDemo?: boolean; interview_date?: string; session_date?: string; created_at?: string; date?: string; id?: string }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => {
    const aIsDemo = a.isDemo === true ? 1 : 0;
    const bIsDemo = b.isDemo === true ? 1 : 0;
    if (aIsDemo !== bIsDemo) return aIsDemo - bIsDemo; // Real (0) before Demo (1)

    const dateA = new Date(a.interview_date ?? a.session_date ?? a.date ?? a.created_at ?? 0).getTime();
    const dateB = new Date(b.interview_date ?? b.session_date ?? b.date ?? b.created_at ?? 0).getTime();
    if (dateB !== dateA) return dateB - dateA; // Newest first

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/**
 * Canonical Date Resolution & Real-First Sorting Helper for Candidates
 */
export function sortCandidatesRealFirst<T extends { isDemo?: boolean; created_at?: string; date?: string; id?: string }>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => {
    const aIsDemo = a.isDemo === true ? 1 : 0;
    const bIsDemo = b.isDemo === true ? 1 : 0;
    if (aIsDemo !== bIsDemo) return aIsDemo - bIsDemo; // Real (0) before Demo (1)

    const dateA = new Date(a.created_at ?? a.date ?? 0).getTime();
    const dateB = new Date(b.created_at ?? b.date ?? 0).getTime();
    if (dateB !== dateA) return dateB - dateA; // Newest first

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/**
 * Canonical Merging Engine for Sessions
 */
export function mergeDashboardSessions(realSessions: any[], demoSessions: any[]): any[] {
  const realIds = new Set(realSessions.map((s) => s.id || s.session_id));
  const uniqueDemo = demoSessions.filter((s) => !realIds.has(s.id || s.session_id));
  return sortSessionsRealFirst([...realSessions, ...uniqueDemo]);
}

/**
 * Canonical Merging Engine for Candidates
 */
export function mergeDashboardCandidates(realCandidates: any[], demoCandidates: any[]): any[] {
  const realIds = new Set(realCandidates.map((c) => c.id || c.candidate_id || c.email));
  const uniqueDemo = demoCandidates.filter((c) => !realIds.has(c.id) && !realIds.has(c.email));
  return sortCandidatesRealFirst([...realCandidates, ...uniqueDemo]);
}

export class DataProvider {
  static isDemo(): boolean {
    return isDemoModeActive();
  }

  static async getDashboardSummary(): Promise<DashboardSummary> {
    // HARD BOUNDARY: If Demo Mode is OFF, execute ONLY ProductionDataProvider.
    // DemoDataProvider is NEVER invoked when Demo Mode is OFF.
    if (!isDemoModeActive()) {
      return ProductionDataProvider.getDashboardSummary();
    }

    const demoSummary = await DemoDataProvider.getDashboardSummary();
    let prodSummary: DashboardSummary | null = null;
    try {
      prodSummary = await ProductionDataProvider.getDashboardSummary();
    } catch (e) {
      console.warn('[DataProvider] Failed to fetch production summary:', e);
    }

    if (!prodSummary || prodSummary.totalCandidates === 0) {
      return demoSummary;
    }

    // Merge metrics when Demo Mode is ON
    const totalCandidates = demoSummary.totalCandidates + prodSummary.totalCandidates;
    const totalDrives = demoSummary.totalDrives + prodSummary.totalDrives;
    const completedSessions = demoSummary.completedSessions + prodSummary.completedSessions;

    const totalDemoScore = demoSummary.avgScore * demoSummary.completedSessions;
    const totalProdScore = prodSummary.avgScore * prodSummary.completedSessions;
    const avgScore = completedSessions > 0
      ? Math.round((totalDemoScore + totalProdScore) / completedSessions)
      : demoSummary.avgScore;

    const outcomeDistribution = {
      shortlisted: demoSummary.outcomeDistribution.shortlisted + prodSummary.outcomeDistribution.shortlisted,
      scheduled: demoSummary.outcomeDistribution.scheduled + prodSummary.outcomeDistribution.scheduled,
      pending: demoSummary.outcomeDistribution.pending + prodSummary.outcomeDistribution.pending,
      rejected: demoSummary.outcomeDistribution.rejected + prodSummary.outcomeDistribution.rejected,
    };

    const scoreBands = {
      excellent: demoSummary.scoreBands.excellent + prodSummary.scoreBands.excellent,
      strong: demoSummary.scoreBands.strong + prodSummary.scoreBands.strong,
      competent: demoSummary.scoreBands.competent + prodSummary.scoreBands.competent,
      needsImprovement: demoSummary.scoreBands.needsImprovement + prodSummary.scoreBands.needsImprovement,
    };

    const voiceCount = demoSummary.modeComparison.voiceAi.count + prodSummary.modeComparison.voiceAi.count;
    const voiceAvg = voiceCount > 0
      ? Math.round(
          (demoSummary.modeComparison.voiceAi.avgScore * demoSummary.modeComparison.voiceAi.count +
            prodSummary.modeComparison.voiceAi.avgScore * prodSummary.modeComparison.voiceAi.count) / voiceCount
        )
      : demoSummary.modeComparison.voiceAi.avgScore;

    const aptitudeCount = demoSummary.modeComparison.aptitude.count + prodSummary.modeComparison.aptitude.count;
    const aptitudeAvg = aptitudeCount > 0
      ? Math.round(
          (demoSummary.modeComparison.aptitude.avgScore * demoSummary.modeComparison.aptitude.count +
            prodSummary.modeComparison.aptitude.avgScore * prodSummary.modeComparison.aptitude.count) / aptitudeCount
        )
      : demoSummary.modeComparison.aptitude.avgScore;

    const codingCount = demoSummary.modeComparison.coding.count + prodSummary.modeComparison.coding.count;
    const codingAvg = codingCount > 0
      ? Math.round(
          (demoSummary.modeComparison.coding.avgScore * demoSummary.modeComparison.coding.count +
            prodSummary.modeComparison.coding.avgScore * prodSummary.modeComparison.coding.count) / codingCount
        )
      : demoSummary.modeComparison.coding.avgScore;

    const modeComparison = {
      voiceAi: { count: voiceCount, avgScore: voiceAvg },
      aptitude: { count: aptitudeCount, avgScore: aptitudeAvg },
      coding: { count: codingCount, avgScore: codingAvg },
    };

    const integrityBreakdown = {
      highIntegrity: demoSummary.integrityBreakdown.highIntegrity + prodSummary.integrityBreakdown.highIntegrity,
      moderateIntegrity: demoSummary.integrityBreakdown.moderateIntegrity + prodSummary.integrityBreakdown.moderateIntegrity,
      warningIntegrity: demoSummary.integrityBreakdown.warningIntegrity + prodSummary.integrityBreakdown.warningIntegrity,
    };

    return {
      totalDrives,
      totalCandidates,
      completedSessions,
      avgScore,
      outcomeDistribution,
      scoreBands,
      modeComparison,
      integrityBreakdown,
    };
  }

  static async getCandidates(): Promise<any[]> {
    const realCandidates = await ProductionDataProvider.getCandidates();
    if (!isDemoModeActive()) {
      return sortCandidatesRealFirst(realCandidates);
    }
    const demoCandidates = await DemoDataProvider.getCandidates();
    return mergeDashboardCandidates(realCandidates, demoCandidates);
  }

  static async getDrives(): Promise<any[]> {
    const realDrives = await ProductionDataProvider.getDrives();
    if (!isDemoModeActive()) {
      return realDrives;
    }
    const demoDrives = await DemoDataProvider.getDrives();
    const prodIds = new Set(realDrives.map((d) => d.id));
    const uniqueDemo = demoDrives.filter((d) => !prodIds.has(d.id));
    return [...realDrives, ...uniqueDemo];
  }

  static async getSessions(): Promise<any[]> {
    const realSessions = await ProductionDataProvider.getSessions();
    if (!isDemoModeActive()) {
      return sortSessionsRealFirst(realSessions);
    }
    const demoSessions = await DemoDataProvider.getSessions();
    return mergeDashboardSessions(realSessions, demoSessions);
  }
}
