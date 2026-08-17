// Reusing the SAME shape Aditya already fetches.
export interface SessionRecord {
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  role: string;
  interview_date: string;
  duration_minutes: number | null;
  questions_asked: number | null;
  questions_answered: number | null;
  overall_score: number | null;
  risk_score: number | null;
  risk_level: string | null;
  recommendation: string | null;
  candidate_outcome: string | null;
  session_status: string;
  strengths: string[] | null;
  weaknesses: string[] | null;
  all_questions_and_answers?: any[];
  all_proctoring_events?: any[];
  evaluation_logic?: any;
  final_verdict?: string;
  verdict_justification?: string;
}

export interface AggregatedPerformance {
  averageScore: number;
  technicalScore: number;
  communicationScore: number;
  totalInterviews: number;
  topStrengths: string[];      
  topWeaknesses: string[];
  scoreTrend: { date: string; score: number }[];
}

export interface QuestionPerformance {
  questionText: string;
  contentScore: number;
  grammarScore?: number;
  fluencyScore?: number;
  confidenceScore?: number;
  feedback?: string;
  suggestion: string;   
}