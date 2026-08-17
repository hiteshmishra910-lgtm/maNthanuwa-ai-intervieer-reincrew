import { CandidateOutcome, MasterEvaluationReport, ProctoringReport } from '../../../types';

export interface DemoCandidate {
  id: string;
  name: string;
  email: string;
  role: string;
  mode: 'Voice AI' | 'Aptitude' | 'Coding';
  score: number;
  outcome: CandidateOutcome;
  integrityScore: number;
  sessionStatus: 'COMPLETED';
  date: string;
  driveId: string;
  driveTitle: string;
  isDemo: true;
}

export interface DemoSession {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  drive_title: string;
  drive_id: string;
  overall_score: number;
  session_status: 'COMPLETED';
  candidate_outcome: CandidateOutcome;
  date?: string;
  isDemo: true;
  evaluation_logic: MasterEvaluationReport;
  proctoringReport?: ProctoringReport;
  all_questions_and_answers?: any[];
  all_proctoring_events?: any[];
}

export interface DemoDrive {
  id: string;
  title: string;
  description: string;
  status: 'ACTIVE';
  total_candidates: number;
  completed_candidates: number;
  created_at: string;
  isDemo: true;
}

export interface DashboardSummary {
  totalDrives: number;
  totalCandidates: number;
  completedSessions: number;
  avgScore: number;
  
  // Outcome Distribution for Donut Chart
  outcomeDistribution: {
    shortlisted: number;
    scheduled: number;
    pending: number;
    rejected: number;
  };

  // Score Bands Histogram for Bar Chart
  scoreBands: {
    excellent: number; // 90-100%
    strong: number;    // 75-89%
    competent: number; // 60-74%
    needsImprovement: number; // <60%
  };

  // Assessment Modes Performance Comparison
  modeComparison: {
    voiceAi: { count: number; avgScore: number };
    aptitude: { count: number; avgScore: number };
    coding: { count: number; avgScore: number };
  };

  // Proctoring Integrity Breakdown
  integrityBreakdown: {
    highIntegrity: number;   // 90-100%
    moderateIntegrity: number; // 70-89%
    warningIntegrity: number;  // <70%
  };
}
