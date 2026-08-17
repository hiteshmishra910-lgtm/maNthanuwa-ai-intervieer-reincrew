/**
 * Central Evaluation & Audit Provenance Constants
 * 
 * Note for Release Management:
 * Any modification to prompt templates, scoring rules, or evaluation rubrics MUST
 * increment EVALUATION_PROMPT_VERSION to preserve legal auditability and provenance.
 */
export const EVALUATION_PROMPT_VERSION = 'v2.1';
export const DEFAULT_QUESTION_COUNT = 10;

export interface EvaluationProvenance {
  provider: string;
  model: string;
  promptVersion: string;
  evaluatorMode: string;
  timestamp: string;
  cacheHit?: boolean;
  retryCount?: number;
}
