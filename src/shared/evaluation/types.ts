export interface MinimalAnswerRecord {
  questionText: string;
  transcript: string;
  evaluation?: {
    contentScore?: number;
    missingKeyPoints?: string[];
    mentionedConcepts?: string[];
    [key: string]: any;
  };
}

export interface BatchLLMResult {
  overallSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  communication?: string;
}
