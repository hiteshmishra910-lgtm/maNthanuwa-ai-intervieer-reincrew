import { SupabaseService } from '../database/supabaseService';
import { DriveRepository } from '../database/driveRepository';
import { supabase } from '../database/supabaseClient';
import { DashboardSummary } from '../demo/demoTypes';

export class ProductionDataProvider {
  static async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const candidates = await this.getCandidates();
      const drives = await this.getDrives();
      const rawSessions = await this.getSessions();

      const totalDrives = drives.length;

      // Filter real completed or attempted sessions from rawSessions and candidates
      const completedFromSessions = (rawSessions || []).filter(
        (s: any) =>
          s.session_status === 'COMPLETED' ||
          s.session_status === 'TERMINATED' ||
          s.status === 'COMPLETED' ||
          s.status === 'TERMINATED' ||
          (s.questions_answered && s.questions_answered > 0)
      );

      const completedFromCandidates = (candidates || []).filter(
        (c: any) => c.session_status === 'COMPLETED' || c.session_status === 'TERMINATED'
      );

      // Unique set of completed records
      const completedSessions = completedFromSessions.length > 0 ? completedFromSessions : completedFromCandidates;
      const completedCount = completedSessions.length;

      const totalCandidates = Math.max(candidates.length, rawSessions.length);

      // Score Calculation
      const extractScore = (s: any): number => {
        return Number(
          s.total_score ??
          s.overall_score ??
          s.overallScore ??
          s.evaluation_logic?.finalScore ??
          s.evaluationReport?.total_score ??
          0
        );
      };

      const avgScore = completedCount > 0
        ? Math.round(completedSessions.reduce((acc: number, s: any) => acc + extractScore(s), 0) / completedCount)
        : 0;

      // Outcome Distribution
      const isShortlisted = (o: string) => o === 'SHORTLIST' || o === 'Strong Hire' || o === 'Hire';
      const isScheduled = (o: string) => o === 'INTERVIEW_SCHEDULED' || o === 'Scheduled';
      const isRejected = (o: string) => o === 'REJECT' || o === 'Reject' || o === 'Needs Improvement';

      const shortlisted = (rawSessions || []).filter((s: any) => isShortlisted(s.candidate_outcome || s.recommendation || '')).length;
      const scheduled = (rawSessions || []).filter((s: any) => isScheduled(s.candidate_outcome || s.recommendation || '')).length;
      const rejected = (rawSessions || []).filter((s: any) => isRejected(s.candidate_outcome || s.recommendation || '')).length;
      const pending = Math.max(0, totalCandidates - (shortlisted + scheduled + rejected));

      const outcomeDistribution = {
        shortlisted,
        scheduled,
        pending,
        rejected,
      };

      // Score Bands
      const scoreBands = {
        excellent: completedSessions.filter((s: any) => extractScore(s) >= 90).length,
        strong: completedSessions.filter((s: any) => extractScore(s) >= 75 && extractScore(s) < 90).length,
        competent: completedSessions.filter((s: any) => extractScore(s) >= 60 && extractScore(s) < 75).length,
        needsImprovement: completedSessions.filter((s: any) => extractScore(s) < 60).length,
      };

      // Mode Comparison
      const getModeCategory = (s: any): 'voice' | 'aptitude' | 'coding' => {
        const modeStr = String(s.evaluation_mode || s.mode || s.job_title || s.role || '').toLowerCase();
        if (modeStr.includes('aptitude') || modeStr.includes('mcq')) return 'aptitude';
        if (modeStr.includes('coding') || modeStr.includes('cyber') || modeStr.includes('system')) return 'coding';
        return 'voice';
      };

      const voiceSessions = completedSessions.filter((s: any) => getModeCategory(s) === 'voice');
      const aptitudeSessions = completedSessions.filter((s: any) => getModeCategory(s) === 'aptitude');
      const codingSessions = completedSessions.filter((s: any) => getModeCategory(s) === 'coding');

      const calcAvg = (arr: any[]) =>
        arr.length > 0 ? Math.round(arr.reduce((acc: number, s: any) => acc + extractScore(s), 0) / arr.length) : 0;

      const modeComparison = {
        voiceAi: { count: voiceSessions.length, avgScore: calcAvg(voiceSessions) },
        aptitude: { count: aptitudeSessions.length, avgScore: calcAvg(aptitudeSessions) },
        coding: { count: codingSessions.length, avgScore: calcAvg(codingSessions) },
      };

      // Integrity Breakdown
      const extractIntegrity = (s: any): number => {
        if (s.proctoringReport?.integrityScore !== undefined) return s.proctoringReport.integrityScore;
        if (s.risk_score !== undefined && s.risk_score !== null) return 100 - s.risk_score;
        return 100;
      };

      const integrityBreakdown = {
        highIntegrity: completedSessions.filter((s: any) => extractIntegrity(s) >= 95).length,
        moderateIntegrity: completedSessions.filter((s: any) => extractIntegrity(s) >= 85 && extractIntegrity(s) < 95).length,
        warningIntegrity: completedSessions.filter((s: any) => extractIntegrity(s) < 85).length,
      };

      return {
        totalDrives,
        totalCandidates,
        completedSessions: completedCount,
        avgScore,
        outcomeDistribution,
        scoreBands,
        modeComparison,
        integrityBreakdown,
      };
    } catch (err) {
      console.warn('[ProductionDataProvider] Failed to compute production summary:', err);
      return {
        totalDrives: 0,
        totalCandidates: 0,
        completedSessions: 0,
        avgScore: 0,
        outcomeDistribution: { shortlisted: 0, scheduled: 0, pending: 0, rejected: 0 },
        scoreBands: { excellent: 0, strong: 0, competent: 0, needsImprovement: 0 },
        modeComparison: {
          voiceAi: { count: 0, avgScore: 0 },
          aptitude: { count: 0, avgScore: 0 },
          coding: { count: 0, avgScore: 0 },
        },
        integrityBreakdown: { highIntegrity: 0, moderateIntegrity: 0, warningIntegrity: 0 },
      };
    }
  }

  static async getCandidates(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('vw_drive_candidates')
        .select('*');
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[ProductionDataProvider] Failed to query vw_drive_candidates:', e);
      return [];
    }
  }

  static async getDrives(): Promise<any[]> {
    try {
      return await DriveRepository.listDrives();
    } catch (e) {
      console.warn('[ProductionDataProvider] Failed to list drives:', e);
      return [];
    }
  }

  static async getSessions(): Promise<any[]> {
    return SupabaseService.getAllSessions();
  }
}
