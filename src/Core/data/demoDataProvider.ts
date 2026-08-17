import { DemoDataService } from '../demo/demoDataService';
import { DashboardSummary, DemoCandidate, DemoDrive, DemoSession } from '../demo/demoTypes';

export class DemoDataProvider {
  static async getDashboardSummary(): Promise<DashboardSummary> {
    return DemoDataService.getDashboardSummary();
  }

  static async getCandidates(): Promise<any[]> {
    return DemoDataService.getDemoCandidates().map((c) => ({
      drive_id: c.driveId,
      drive_title: c.driveTitle,
      candidate_name: c.name,
      candidate_email: c.email,
      assignment_status: 'COMPLETED',
      session_id: `demo-session-${c.id.replace('demo-cand-', '')}`,
      overall_score: c.score,
      session_status: c.sessionStatus,
      session_completed_at: c.date,
      candidate_outcome: c.outcome,
      isDemo: true,
    }));
  }

  static async getDrives(): Promise<DemoDrive[]> {
    return DemoDataService.getDemoDrives();
  }

  static async getSessions(): Promise<DemoSession[]> {
    return DemoDataService.getDemoSessions();
  }

  static async getSessionReport(sessionId: string): Promise<any> {
    return DemoDataService.getDemoSessionReport(sessionId);
  }
}
