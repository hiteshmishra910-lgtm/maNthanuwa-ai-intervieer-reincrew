import { DEMO_CANDIDATES, DEMO_DRIVES, DEMO_SESSIONS } from './demoData';
import { DashboardSummary, DemoCandidate, DemoDrive, DemoSession } from './demoTypes';

export class DemoDataService {
  static getDemoCandidates(): DemoCandidate[] {
    return DEMO_CANDIDATES;
  }

  static getDemoDrives(): DemoDrive[] {
    return DEMO_DRIVES;
  }

  static getDemoSessions(): DemoSession[] {
    return Object.values(DEMO_SESSIONS);
  }

  static getDemoSessionReport(sessionId: string): any {
    const session = DEMO_SESSIONS[sessionId];
    if (session) {
      return session.evaluation_logic;
    }
    // Fallback to Aarav report if unknown demo session id requested
    return DEMO_SESSIONS['demo-session-aarav'].evaluation_logic;
  }

  /**
   * Calculates aggregated metrics DTO from live demo candidate data.
   * Guarantees mathematical reconciliation:
   * sum(outcomes) === candidateCount
   * sum(scoreBands) === candidateCount
   */
  static getDashboardSummary(): DashboardSummary {
    const candidates = DEMO_CANDIDATES;
    const drives = DEMO_DRIVES;

    const totalDrives = drives.length;
    const totalCandidates = candidates.length;
    const completedSessions = candidates.filter((c) => c.sessionStatus === 'COMPLETED').length;

    const avgScore = completedSessions > 0
      ? Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / completedSessions)
      : 0;

    // Outcome Distribution
    const outcomeDistribution = {
      shortlisted: candidates.filter((c) => c.outcome === 'SHORTLIST').length,
      scheduled: candidates.filter((c) => c.outcome === 'INTERVIEW_SCHEDULED').length,
      pending: candidates.filter((c) => c.outcome === 'PENDING').length,
      rejected: candidates.filter((c) => c.outcome === 'REJECT').length,
    };

    // Score Bands
    const scoreBands = {
      excellent: candidates.filter((c) => c.score >= 90).length,
      strong: candidates.filter((c) => c.score >= 75 && c.score < 90).length,
      competent: candidates.filter((c) => c.score >= 60 && c.score < 75).length,
      needsImprovement: candidates.filter((c) => c.score < 60).length,
    };

    // Mode Comparison
    const voiceCandidates = candidates.filter((c) => c.mode === 'Voice AI');
    const aptitudeCandidates = candidates.filter((c) => c.mode === 'Aptitude');
    const codingCandidates = candidates.filter((c) => c.mode === 'Coding');

    const calcAvg = (arr: DemoCandidate[]) =>
      arr.length > 0 ? Math.round(arr.reduce((acc, curr) => acc + curr.score, 0) / arr.length) : 0;

    const modeComparison = {
      voiceAi: { count: voiceCandidates.length, avgScore: calcAvg(voiceCandidates) },
      aptitude: { count: aptitudeCandidates.length, avgScore: calcAvg(aptitudeCandidates) },
      coding: { count: codingCandidates.length, avgScore: calcAvg(codingCandidates) },
    };

    // Integrity Breakdown
    const integrityBreakdown = {
      highIntegrity: candidates.filter((c) => c.integrityScore >= 95).length,
      moderateIntegrity: candidates.filter((c) => c.integrityScore >= 85 && c.integrityScore < 95).length,
      warningIntegrity: candidates.filter((c) => c.integrityScore < 85).length,
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
}
