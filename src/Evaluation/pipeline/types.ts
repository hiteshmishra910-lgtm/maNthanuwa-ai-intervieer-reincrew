import { Candidate, JobPost, Question, EvaluationResult, ReadonlyEvaluationResult, EvaluationMode } from '../../../types';

export interface AnswerRecord {
  questionId: string | number;
  questionText: string;
  transcript: string;
  evaluation: ReadonlyEvaluationResult;
  isFollowUp: boolean;
  topic?: string;
}

export interface ProctoringSnapshot {
  warnings: number;
  status: string;
}

export interface TimerSnapshot {
  elapsedSeconds: number;
  totalAllowedSeconds?: number;
}

export interface SessionMetrics {
  followUpsAsked: number;
}

export interface InterviewContext {
  candidate: Candidate;
  job: JobPost;
  mode: EvaluationMode;
  configuration: any; // Mapped from JobPost settings
  questionQueue: Question[];
  pendingFollowUpQuestion?: Question;
  currentQuestion: Question | null;
  answerHistory: AnswerRecord[];
  proctoringSummary: ProctoringSnapshot;
  timers: TimerSnapshot;
  sessionMetrics: SessionMetrics;
  metadata: Record<string, any>;
}

export interface FollowUpDecision {
  requiresFollowUp: boolean;
  reason: string;
  missingConcepts: string[];
  confidence: number;
  branchId?: string;
}


export type InterviewEvent = 
  | { type: 'QUESTION_CHANGED', payload: { question: Question, isFollowUp: boolean } }
  | { type: 'ANSWER_EVALUATED', payload: { result: ReadonlyEvaluationResult } }
  | { type: 'FOLLOWUP_CREATED', payload: { question: Question } }
  | { type: 'INTERVIEW_COMPLETED', payload: { result: import('../../../types').InterviewCompletionResult } }
  | { type: 'ERROR_OCCURRED', payload: { message: string, recoverable: boolean } }
  | { type: 'STATE_CHANGED', payload: { from: string, to: string } };
