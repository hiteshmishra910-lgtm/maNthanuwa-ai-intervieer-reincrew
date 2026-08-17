// AUTO-GENERATED FILE — DO NOT EDIT.
// Source: shared/evaluationTypes.ts

// Shared types between React Frontend and Deno Backend Edge Function
export interface CandidateAnswer {
  question: string;
  answer: string;
  ideal_answer?: string;
  questionData?: {
    type?: string;
    category?: string;
    difficulty?: string;
    keyConcepts?: string[];
    keyPoints?: string[];
    evaluationGuide?: string[];
    role?: string;
    id?: number | string;
  };
  timeSpentSeconds?: number;
  evaluation?: any;
}

export interface HybridEvaluationRequest {
  sessionId: string;
  proctoringData?: any;
}

export interface OpenRouterConfig {
  model: string;
  temperature: number;
}
