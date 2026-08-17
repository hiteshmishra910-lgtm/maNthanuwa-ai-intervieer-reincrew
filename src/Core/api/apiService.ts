import { Candidate, EvaluationResult, Question, RoleSettings, VisualMetrics, FeedbackStructure } from "../../../types";
import { StorageService } from "../storage/storageService";
import { ErrorLogService } from "../logging/errorLogService";
import { SupabaseService } from "../database/supabaseService";
import { getEdgeFunctionAuthHeaders, supabase } from "../database/supabaseClient";
import { generateWithFailover } from '../ai/aiProviderManager';
import {
  sanitizeUntrusted,
  wrapUntrusted,
  UNTRUSTED_INPUT_POLICY,
  EVIDENCE_DISCIPLINE_POLICY,
  RUBRIC_DIMENSIONS_POLICY,
  MAX_ANSWER_CHARS,
  MAX_FIELD_CHARS,
} from '../../../shared/promptSafety';
import { Tokenizer } from '../../Evaluation/pipeline/Tokenizer';
import { Normalizer } from '../../Evaluation/pipeline/Normalizer';
import { Stemmer } from '../../Evaluation/pipeline/Stemmer';

export const DEFAULT_SETTINGS: RoleSettings = {
  difficulty: 'Medium',
  preset: 'Normal',
  weights: { concept: 70, grammar: 10, fluency: 10, camera: 10 },
  proctoring: {
    maxWarnings: 3,
    sensitivity: 'Medium',
    includeInScore: true
  }
};

// ============================================================================
// API KEY MANAGEMENT - Supabase Edge Function Proxy
// ============================================================================

import { OpenRouterClient } from '../ai/openRouterClient';
import { RequestCoordinator } from './RequestCoordinator';

export interface OpenRouterGenerationResult {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  tier?: 'free' | 'paid';
}

export function validateEvaluationSchema(json: any): boolean {
  if (!json || typeof json !== 'object') return false;
  const validAnswerTypes = ['honest_unknown', 'keyword_list_only', 'incorrect_attempt', 'mixed_understanding', 'partial_explanation', 'full_explanation'];
  if (!json.answerType || !validAnswerTypes.includes(json.answerType)) return false;
  if (typeof json.accuracy !== 'number' || isNaN(json.accuracy)) return false;
  if (typeof json.conceptUnderstanding !== 'number' || isNaN(json.conceptUnderstanding)) return false;
  if (typeof json.reasoning !== 'number' || isNaN(json.reasoning)) return false;
  if (!Array.isArray(json.mentionedConcepts) || !Array.isArray(json.explainedConcepts)) return false;
  return true;
}

export async function generateWithOpenRouterDetailed(
  prompt: string,
  maxRetries = 2,
  purpose: 'live' | 'eval' | 'report' = 'eval',
  signal?: AbortSignal,
  systemPrompt?: string,
  userPrompt?: string,
  sessionId?: string
): Promise<OpenRouterGenerationResult> {
  const requestId = `api_generate_${hashString(prompt)}_${Date.now()}`;
  const result = await RequestCoordinator.deduplicate(requestId, () =>
    OpenRouterClient.generate<any>({ prompt, purpose: purpose === 'live' ? 'live' : 'eval', systemPrompt, userPrompt, sessionId })
  );

  if (!result.success) {
    const failure = result as import('../../../types').AIClientFailure;
    throw new Error(`OpenRouter Error: ${failure.errorType} - ${failure.message}`);
  }

  if (result.data?.choices && result.data.choices.length > 0) {
    const choice = result.data.choices[0];

    if (choice.finish_reason === 'length') {
      throw new Error(
        'OpenRouter Error: TruncatedResponse - the model hit its output token limit before completing the JSON payload.'
      );
    }

    return {
      content: choice.message.content,
      provider: result.provider || 'openrouter',
      model: result.model || 'openrouter/free',
      latencyMs: result.latencyMs || 0,
      tier: result.tier || 'free'
    };
  }

  throw new Error("Invalid structure returned from API");
}

export async function generateWithOpenRouter(
  prompt: string,
  maxRetries = 2,
  purpose: 'live' | 'eval' | 'report' = 'eval',
  signal?: AbortSignal,
  sessionId?: string
): Promise<string> {
  const res = await generateWithOpenRouterDetailed(prompt, maxRetries, purpose, signal, undefined, undefined, sessionId);
  return res.content;
}

/**
 * Extracts the first complete JSON object from a model response.
 *
 * Replaces `text.match(/\{[\s\S]*\}/)`, which was introduced in db7a2e1 to strip prose around the
 * JSON. That was a real improvement over parsing the raw string, but the pattern is greedy: it
 * spans from the first `{` to the LAST `}` anywhere in the response. Any closing brace in trailing
 * commentary — "…see `{ "score": 8 }` above" — or a second JSON object extends the span and makes
 * the result unparseable, so a response the model got right still failed evaluation.
 *
 * This scans with a brace counter that respects string literals and escapes, returning the first
 * balanced object. Every input the greedy pattern handled correctly is handled identically here;
 * the difference is only in the cases where it previously over-matched.
 *
 * Truncation is reported distinctly rather than as a generic parse error, because a JSON object
 * that opens and never closes means the completion was cut short — a different problem with a
 * different fix from malformed output.
 *
 * Exported for direct unit testing.
 */
export const extractJsonObject = (raw: string): string => {
  const text = String(raw ?? '').trim();

  let startIdx = 0;
  let unterminatedFound = false;

  while ((startIdx = text.indexOf('{', startIdx)) !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let endIdx = -1;

    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { if (inString) escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const candidate = text.slice(startIdx, endIdx + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Candidate brace block was not valid JSON; continue search from next '{'
      }
    } else {
      unterminatedFound = true;
    }

    startIdx++;
  }

  if (unterminatedFound) {
    throw new Error(
      'The model response contains an unterminated JSON object, which means the completion was ' +
      'truncated before it finished writing the payload.'
    );
  }

  throw new Error('No JSON object found in the model response.');
};

// Simple string hash ΓåÆ consistent key per session
export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

const ai = {
  models: {
    generateContent: async (args: any) => {
      // Used by startInterview for dynamic question generation (Live Interview)
      const text = await generateWithOpenRouter(args.contents);
      return { text };
    }
  }
};

// ============================================================================
// LOCAL SCORING ΓÇö Keyword match + answer length + concept density
// ============================================================================

/**
 * H-10: this was dead code. It was imported by aiService.ts but never called, and its
 * `evaluationAvailable` flag was never read anywhere — so API mode had no fallback at all
 * when the LLM was unavailable, despite a complete deterministic engine existing in
 * src/Evaluation/. Returning `score: 0` also meant that if it ever HAD been wired up
 * naively, an outage would have scored every candidate zero.
 *
 * It now delegates to the real local engine. `evaluationAvailable` reports whether a genuine
 * evaluation was produced, so callers can distinguish "scored zero" from "not scored" rather
 * than silently recording a 0.
 */
export function localEvaluate(
  answer: string,
  question: Question
): { score: number; matched: string[]; missed: string[]; confidence: number; evaluationAvailable: boolean; reason: string } {
  const expected = question?.evaluationGuide || [];

  // Coerce defensively: the transcript originates from speech-to-text and the database, so
  // the declared `string` type is not guaranteed at runtime. A TypeError here would abort
  // the whole evaluation on the exact path that exists to handle failures.
  const answerText = typeof answer === "string" ? answer : answer == null ? "" : String(answer);

  if (!answerText.trim()) {
    return {
      score: 0,
      matched: [],
      missed: expected,
      confidence: 100,
      evaluationAvailable: true,
      reason: "Empty answer",
    };
  }

  try {
    // Concept coverage against the question's own checklist, using the same normalisation
    // the local pipeline uses so the two engines agree on what counts as "mentioned".
    const normalized = Normalizer.normalize(answerText);
    const answerStems = new Set(
      Tokenizer.tokenize(normalized).map((t) => Stemmer.stem(t.toLowerCase())),
    );

    const matched: string[] = [];
    const missed: string[] = [];

    for (const point of expected) {
      const pointStems = Tokenizer.tokenize(Normalizer.normalize(point))
        .map((t) => Stemmer.stem(t.toLowerCase()))
        .filter((t) => t.length > 2);
      if (pointStems.length === 0) continue;

      const hits = pointStems.filter((s) => answerStems.has(s)).length;
      // Majority of the concept's significant terms must appear.
      if (hits / pointStems.length >= 0.5) matched.push(point);
      else missed.push(point);
    }

    const denominator = matched.length + missed.length;
    const score = denominator === 0 ? 0 : Math.round((matched.length / denominator) * 10);

    return {
      score: Math.max(0, Math.min(10, score)),
      matched,
      missed,
      // Deliberately below full confidence: this is a keyword-coverage fallback, not the
      // full pipeline, and reviewers should treat it as provisional.
      confidence: denominator === 0 ? 0 : 60,
      evaluationAvailable: denominator > 0,
      reason:
        denominator > 0
          ? "Scored locally (AI evaluator unavailable) — provisional, keyword-coverage only"
          : "No evaluation criteria available for this question",
    };
  } catch (err) {
    console.error("[localEvaluate] Local fallback failed:", err);
    return {
      score: 0,
      matched: [],
      missed: expected,
      confidence: 0,
      evaluationAvailable: false,
      reason: "Local fallback evaluation failed",
    };
  }
}

/**
 * Local adaptive difficulty signal.
 * Used to determine next question difficulty without waiting for AI.
 * Returns 0-10 scale.
 */
export function localDifficultySignal(answer: string, question: Question): number {
  const answerLower = answer.toLowerCase().trim();
  const words = answerLower.split(/\s+/).filter(Boolean);

  // Simple length-based heuristic instead of keyword fallback grading
  if (words.length < 15) return 3;
  if (words.length < 40) return 6;
  return 8;
}

// ============================================================================
// INTERVIEW START
// ============================================================================

const DIRECT_INTERVIEW_FALLBACK = [
  {
    id: 1,
    question: "Tell me about your professional background and what you are looking for in your next role.",
    difficulty: "easy" as const,
    ideal_answer: "Candidate should clearly state their current role, years of experience, and key skills.",
    evaluationGuide: ["Current Role", "Experience", "Skills"],
    maxScore: 10
  },
  {
    id: 2,
    question: "Describe a challenging project you worked on. What was your role and how did you overcome the obstacles?",
    difficulty: "medium" as const,
    ideal_answer: "Candidate defines problem, their specific action, and a positive result.",
    evaluationGuide: ["Problem definition", "Action taken", "Result"],
    maxScore: 10
  },
  {
    id: 3,
    question: "How do you handle disagreements with colleagues or managers?",
    difficulty: "medium" as const,
    ideal_answer: "Seeks to understand, communicates respectfully, finds compromise.",
    evaluationGuide: ["Communication", "Respect", "Compromise"],
    maxScore: 10
  },
  {
    id: 4,
    question: "Where do you see yourself professionally in five years?",
    difficulty: "easy" as const,
    ideal_answer: "Presents clear career progression goals aligned with the role.",
    evaluationGuide: ["Career goals", "Ambition", "Alignment"],
    maxScore: 10
  },
  {
    id: 5,
    question: "What do you consider your greatest professional strength?",
    difficulty: "easy" as const,
    ideal_answer: "Identifies a relevant strength and provides a quick example.",
    evaluationGuide: ["Relevance", "Self-awareness", "Example"],
    maxScore: 10
  },
  {
    id: 6,
    question: "Describe a time when you had to learn a new technology or skill quickly.",
    difficulty: "medium" as const,
    ideal_answer: "Shows adaptability, resourcefulness, and successfully applying the new skill.",
    evaluationGuide: ["Adaptability", "Learning process", "Application"],
    maxScore: 10
  },
  {
    id: 7,
    question: "How do you prioritize your work when dealing with multiple tight deadlines?",
    difficulty: "medium" as const,
    ideal_answer: "Uses a framework (like Eisenhower matrix), communicates with stakeholders, stays organized.",
    evaluationGuide: ["Time management", "Communication", "Organization"],
    maxScore: 10
  },
  {
    id: 8,
    question: "Tell me about a time you made a mistake. How did you handle it?",
    difficulty: "medium" as const,
    ideal_answer: "Takes accountability, fixes the issue, and learns from it.",
    evaluationGuide: ["Accountability", "Resolution", "Learning"],
    maxScore: 10
  },
  {
    id: 9,
    question: "What is your approach to giving and receiving constructive feedback?",
    difficulty: "medium" as const,
    ideal_answer: "Views it as an opportunity for growth; gives it specifically and kindly.",
    evaluationGuide: ["Open-mindedness", "Growth mindset", "Tact"],
    maxScore: 10
  },
  {
    id: 10,
    question: "Why are you interested in joining our company specifically?",
    difficulty: "easy" as const,
    ideal_answer: "Shows research about the company and aligns personal goals with company mission.",
    evaluationGuide: ["Research", "Alignment", "Enthusiasm"],
    maxScore: 10
  }
];

export const startInterview = async (candidate: Candidate): Promise<{ question: Question; totalQuestions: number; settings?: RoleSettings; questionsList: Question[] }> => {
  // Fetch questions specific to the candidate's job role
  let questions: Question[] = [];
  let settings: RoleSettings | undefined;

  // Mini Demo Logic: Generate dynamic questions if isDemo is true
  if (candidate.isDemo && candidate.customTopic) {
    try {
      const topic = candidate.customTopic;
      const prompt = `
        Generate 5 distinct interview questions for a candidate interested in "${topic}".
        Questions should range from easy to medium difficulty.
        Return strictly a JSON array of objects:
        [{ "id": 1, "question": "Question text", "difficulty": "Easy", "maxScore": 10, "keyPoints": ["key1", "key2"] }]
      `;

      const result = await ai.models.generateContent({
        contents: prompt
      });

      let cleanText = result.text || "[]";
      // Sanitize markdown if present
      if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
      else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');

      const genQuestions = JSON.parse(cleanText);
      questions = genQuestions.map((q: any, i: number) => ({
        ...q,
        id: i + 1,
        maxScore: 10
      }));

      // Set Demo Settings
      settings = {
        ...DEFAULT_SETTINGS,
        difficulty: 'Medium',
        preset: 'Normal',
        proctoring: { ...DEFAULT_SETTINGS.proctoring, includeInScore: false }
      };

    } catch (err) {
      console.error("OpenRouter Question generation failed, using static fallback question:", err);
      questions = [{
        id: 1,
        question: `Tell me about your interest in ${candidate.customTopic} and what you hope to achieve.`,
        difficulty: "easy",
        ideal_answer: "The candidate should relate their skills and goals clearly.",
        maxScore: 10,
        evaluationGuide: ["Interest", "Goals"]
      }];
      settings = {
        ...DEFAULT_SETTINGS,
        difficulty: 'Medium',
        preset: 'Normal',
        proctoring: { ...DEFAULT_SETTINGS.proctoring, includeInScore: false }
      };
    }
  } else if (candidate.jobPostId) {
    const job = await StorageService.getJobById(candidate.jobPostId);
    if (job) {
      questions = job.questions;
      settings = job.settings;
    }
  }

  // Fallback to a default set of 10 questions if no job found or no questions
  if (questions.length === 0) {
    questions = [...DIRECT_INTERVIEW_FALLBACK];
  }

  // Shuffle questions randomly
  const shuffled = questions.sort(() => 0.5 - Math.random());
  // Pick 10 questions randomly
  const selectedQuestions = shuffled.slice(0, 10);

  // Fetch global config for proctoring toggles
  const config = await StorageService.getConfig();

  // Merge or override with role-specific settings
  const finalSettings: RoleSettings = settings || {
    ...DEFAULT_SETTINGS,
    difficulty: config.defaultDifficulty as any,
  };

  // Force global proctoring toggles
  if (!config.enableEyeTracking) finalSettings.proctoring.sensitivity = 'Low'; // Effectively disable or reduce impact

  return {
    question: selectedQuestions[0],
    totalQuestions: selectedQuestions.length,
    settings: finalSettings,
    questionsList: selectedQuestions
  };
};

// ============================================================================
// ANSWER EVALUATION ΓÇö Simplified prompt, local score computation
// ============================================================================

// Derive answerQuality from answerType primarily, score secondarily
function deriveAnswerQuality(
  answerType: 'honest_unknown' | 'keyword_list_only' | 'incorrect_attempt' | 'mixed_understanding' | 'partial_explanation' | 'full_explanation',
  contentScore: number
): 'HONEST_UNKNOWN' | 'KEYWORD_LIST' | 'INCORRECT_ATTEMPT' | 'SURFACE_LEVEL' | 'COMPETENT' | 'STRONG' | 'EXPERT' {
  if (answerType === 'honest_unknown') return 'HONEST_UNKNOWN';
  if (answerType === 'incorrect_attempt') return 'INCORRECT_ATTEMPT';
  if (answerType === 'keyword_list_only') return 'KEYWORD_LIST';
  if (answerType === 'mixed_understanding') {
    if (contentScore >= 6) return 'COMPETENT';
    return 'SURFACE_LEVEL';
  }
  if (answerType === 'partial_explanation') {
    if (contentScore >= 8) return 'COMPETENT';
    if (contentScore >= 5) return 'SURFACE_LEVEL';
    return 'SURFACE_LEVEL';
  }
  // full_explanation
  if (contentScore >= 9.5) return 'EXPERT';
  if (contentScore >= 8) return 'STRONG';
  if (contentScore >= 6) return 'COMPETENT';
  return 'SURFACE_LEVEL'; // full_explanation but low score = weak explanation
}

function getQuestionSubject(questionText: string): string {
  let clean = questionText.trim();
  if (clean.endsWith('?')) {
    clean = clean.slice(0, -1);
  }
  
  const prefixes = [
    /^[Ww]hat is\s+/i,
    /^[Ww]hat are\s+/i,
    /^[Ee]xplain\s+/i,
    /^[Dd]escribe\s+/i,
    /^[Cc]an you explain\s+/i,
    /^[Ww]hy do we use\s+/i,
    /^[Ww]hat do you understand by\s+/i
  ];
  
  for (const regex of prefixes) {
    if (regex.test(clean)) {
      clean = clean.replace(regex, '').trim();
      break;
    }
  }
  
  // Strip trailing " work" or " works"
  clean = clean.replace(/\s+works?$/i, '').trim();
  
  // Lowercase the subject if it doesn't start with or contain multi-letter acronyms
  if (clean && !/^[A-Z]{2,}/.test(clean)) {
    if (!/[A-Z]{2,}/.test(clean)) {
      clean = clean.toLowerCase();
    } else {
      clean = clean.charAt(0).toLowerCase() + clean.slice(1);
    }
  }
  
  return clean || 'the topic';
}

function generateFeedback(
  question: Question,
  answerType: 'honest_unknown' | 'keyword_list_only' | 'incorrect_attempt' | 'mixed_understanding' | 'partial_explanation' | 'full_explanation',
  knowledgeScore: number,
  explainedConcepts: string[],
  mentionedConcepts: string[],
  missingKeyPoints: string[],
  technicalErrors: { error: string; severity: 'low' | 'medium' | 'high' }[],
  llmFeedback?: any,
  categoryType?: string
): FeedbackStructure {
  const subject = getQuestionSubject(question.question);
  const isBehavioral = categoryType?.includes('Behavioral') || question.type?.startsWith('Behavioral');
  const isSituational = categoryType?.includes('Situational');
  const isIntroductory = categoryType?.includes('Introductory');

  // If LLM returned valid evidence-grounded feedback, use it directly
  if (llmFeedback && typeof llmFeedback === 'object' && typeof llmFeedback.observation === 'string' && llmFeedback.observation.trim().length > 10) {
    return {
      observation: llmFeedback.observation,
      demonstrated: Array.isArray(llmFeedback.demonstrated) && llmFeedback.demonstrated.length > 0 ? llmFeedback.demonstrated : (mentionedConcepts.length > 0 ? mentionedConcepts : ["Demonstrated key concepts"]),
      gaps: Array.isArray(llmFeedback.gaps) && llmFeedback.gaps.length > 0 ? llmFeedback.gaps : (missingKeyPoints.length > 0 ? missingKeyPoints : ["Key details omitted"]),
      nextSteps: Array.isArray(llmFeedback.nextSteps) && llmFeedback.nextSteps.length > 0 ? llmFeedback.nextSteps : ["Review expected response framework and practice with concrete examples."]
    };
  }

  let observation = "";
  const demonstrated: string[] = [];
  const gaps: string[] = [];
  const nextSteps: string[] = [];
  
  // ─── Evidence-Grounded Transcript Feedback Generation ───
  if (answerType === 'honest_unknown') {
    observation = `You indicated that ${subject} was outside your current domain or experience.`;
    demonstrated.push("Demonstrated honesty and technical self-awareness");
    
    const checklist = missingKeyPoints.length > 0 ? missingKeyPoints : (question.evaluationGuide || []);
    checklist.slice(0, 3).forEach(item => {
      gaps.push(`Core topic not covered: ${item}`);
      nextSteps.push(`Study and practice: ${item}`);
    });
  } 
  else if (answerType === 'keyword_list_only') {
    observation = `Your response named relevant keywords for ${subject}, but did not explain how they function.`;
    if (mentionedConcepts.length > 0) {
      demonstrated.push(`Identified key terms: "${mentionedConcepts.slice(0, 3).join('", "')}"`);
    } else {
      demonstrated.push("No explicit supporting statement detected for concept explanations");
    }
    
    const checklist = missingKeyPoints.length > 0 ? missingKeyPoints : (question.evaluationGuide || []);
    checklist.slice(0, 3).forEach(item => {
      gaps.push(`Lacked detailed mechanics for ${item}`);
      nextSteps.push(`Explain the underlying implementation and trade-offs of ${item}`);
    });
  }
  else if (answerType === 'incorrect_attempt') {
    observation = isBehavioral
      ? `Your answer addressed past experience with ${subject}, but lacked a clear STAR structure (Situation, Task, Action, Result).`
      : isSituational
      ? `Your approach to ${subject} was incomplete or lacked structured triage.`
      : `Your answer attempted to explain ${subject}, but contained technical inaccuracies.`;

    if (explainedConcepts.length > 0) {
      demonstrated.push(`Transcript Evidence: Correctly referenced "${explainedConcepts.slice(0, 2).join('", "')}"`);
    } else if (mentionedConcepts.length > 0) {
      demonstrated.push(`Transcript Evidence: Named "${mentionedConcepts.slice(0, 2).join('", "')}" without full explanation`);
    } else {
      demonstrated.push("No explicit supporting statement detected");
    }

    if (technicalErrors && technicalErrors.length > 0) {
      technicalErrors.forEach(err => gaps.push(`Technical misstatement: ${err.error}`));
    } else {
      gaps.push(`Gaps in technical accuracy for ${subject}`);
    }

    const checklist = missingKeyPoints.length > 0 ? missingKeyPoints : (question.evaluationGuide || []);
    checklist.slice(0, 3).forEach(item => {
      nextSteps.push(`Review ${item} end-to-end and explain it aloud with a practical example.`);
    });
  }
  else if (answerType === 'mixed_understanding') {
    observation = `You demonstrated genuine familiarity with parts of ${subject}, but held technical gaps or errors in other areas.`;
    
    if (explainedConcepts.length > 0) {
      demonstrated.push(`Transcript Evidence: Correctly explained "${explainedConcepts.slice(0, 3).join('", "')}"`);
    } else {
      demonstrated.push("Transcript Evidence: Recalled key details");
    }
    
    if (technicalErrors && technicalErrors.length > 0) {
      technicalErrors.forEach(err => gaps.push(`Technical misstatement: ${err.error}`));
    }
    
    const checklist = missingKeyPoints.length > 0 ? missingKeyPoints : (question.evaluationGuide || []);
    checklist.slice(0, 3).forEach(item => {
      if (!gaps.includes(item)) gaps.push(`Requires clarification: ${item}`);
      nextSteps.push(`Deepen practical understanding of ${item}`);
    });
  }
  else if (answerType === 'partial_explanation') {
    observation = `You provided a solid explanation of core aspects of ${subject}, but omitted some expected details.`;
    
    if (explainedConcepts.length > 0) {
      demonstrated.push(`Transcript Evidence: Accurately explained "${explainedConcepts.slice(0, 3).join('", "')}"`);
    } else {
      demonstrated.push("Transcript Evidence: Explained key technical concepts");
    }
    
    if (technicalErrors && technicalErrors.length > 0) {
      technicalErrors.forEach(err => gaps.push(`Technical error: ${err.error}`));
    }
    
    const checklist = missingKeyPoints.length > 0 ? missingKeyPoints : (question.evaluationGuide || []);
    checklist.slice(0, 3).forEach(item => {
      gaps.push(`Omitted expected area: ${item}`);
      nextSteps.push(`Incorporate ${item} when explaining ${subject}`);
    });
  }
  else { // full_explanation
    observation = `You provided a clear, accurate, and well-structured explanation of ${subject}.`;
    
    if (explainedConcepts.length > 0) {
      demonstrated.push(`Transcript Evidence: Thoroughly explained "${explainedConcepts.join('", "')}"`);
    } else {
      demonstrated.push("Transcript Evidence: Fully articulated all core technical concepts");
    }
    
    if (technicalErrors && technicalErrors.length > 0) {
      technicalErrors.forEach(err => gaps.push(`Minor inaccuracy: ${err.error}`));
    }
    
    nextSteps.push("Explore real-world edge cases, architectural trade-offs, and high-concurrency implications.");
  }
  
  return {
    observation,
    demonstrated,
    gaps,
    nextSteps
  };
}

const honestUnknownPatterns = [
  "i don't know", "i do not know", "not sure", "haven't learned", "never studied",
  "don't remember", "not familiar", "no idea", "can't recall", "cannot recall",
  "haven't worked with", "not confident answering", "don't know much"
];

export function buildEvaluationResult(
  currentQuestion: Question,
  answer: string,
  evalJson: any,
  visualMetrics?: VisualMetrics,
  isBehavioral = false,
  categoryType?: string
): EvaluationResult {
  // ─── 0. Classify answer type ───
  let answerType: 'honest_unknown' | 'keyword_list_only' | 'incorrect_attempt' | 'mixed_understanding' | 'partial_explanation' | 'full_explanation' =
    (evalJson.answerType === 'honest_unknown' || evalJson.answerType === 'keyword_list_only' || evalJson.answerType === 'incorrect_attempt' || evalJson.answerType === 'mixed_understanding' || evalJson.answerType === 'partial_explanation' || evalJson.answerType === 'full_explanation')
      ? evalJson.answerType
      : 'partial_explanation'; // safe default

  const answerLower = answer.toLowerCase().trim();
  const matchesHonestPattern = honestUnknownPatterns.some(pat => answerLower.includes(pat));

  let accuracy = Math.max(0, Math.min(10, evalJson.accuracy ?? 0));
  let conceptCoverage = Math.max(0, Math.min(10, evalJson.conceptCoverage ?? 0));
  let conceptUnderstanding = Math.max(0, Math.min(10, evalJson.conceptUnderstanding ?? 0));
  let reasoning = Math.max(0, Math.min(10, evalJson.reasoning ?? 0));
  let depth = Math.max(0, Math.min(10, evalJson.depth ?? 0));
  
  const clarity = Math.max(0, Math.min(10, evalJson.clarity ?? 0));
  const structure = Math.max(0, Math.min(10, evalJson.structure ?? 0));
  const confidenceScoreVal = Math.max(0, Math.min(10, evalJson.confidence ?? 0));
  const consistency = Math.max(0, Math.min(10, evalJson.consistency ?? 0));
  
  const answerDirectnessScore = Math.max(0, Math.min(10, evalJson.answerDirectnessScore ?? 0));
  const tradeoffReasoningScore = evalJson.tradeoffReasoningScore !== null && evalJson.tradeoffReasoningScore !== undefined
    ? Math.max(0, Math.min(10, evalJson.tradeoffReasoningScore))
    : undefined;

  const curiosity = Math.max(0, Math.min(10, evalJson.curiosity ?? 0));
  const selfCorrection = Math.max(0, Math.min(10, evalJson.selfCorrection ?? 0));

  const rawKnowledgeScore = (accuracy * 0.40) + (conceptCoverage * 0.30) + (conceptUnderstanding * 0.30);
  
  const isHonestUnknown = answerType === 'honest_unknown' || (matchesHonestPattern && rawKnowledgeScore <= 2);

  // ─── 1. KEYWORD-ONLY HARD CAPS (enforced before any scoring) ───
  if (answerType === 'keyword_list_only') {
    accuracy = Math.min(3, accuracy);
    conceptCoverage = Math.min(3, conceptCoverage);
    conceptUnderstanding = Math.min(2, conceptUnderstanding);
    depth = Math.min(1, depth);
    reasoning = Math.min(2, reasoning);
  }

  // ─── 2. Word-count & Vagueness Anti-Inflation Caps ───
  const wordsList = answer.trim().split(/\s+/).filter(Boolean);
  const wordCount = wordsList.length;
  if (wordCount < 15 && answerType !== 'full_explanation' && answerType !== 'honest_unknown') {
    // Extremely short / 1-sentence vague answer
    accuracy = Math.min(3, accuracy);
    conceptCoverage = Math.min(3, conceptCoverage);
    conceptUnderstanding = Math.min(2, conceptUnderstanding);
    depth = Math.min(1, depth);
    reasoning = Math.min(2, reasoning);
  } else if (wordCount < 35 && answerType !== 'full_explanation' && answerType !== 'honest_unknown') {
    // Brief / vague answer under 35 words
    accuracy = Math.min(5, accuracy);
    conceptCoverage = Math.min(5, conceptCoverage);
    conceptUnderstanding = Math.min(4, conceptUnderstanding);
    depth = Math.min(3, depth);
    reasoning = Math.min(3, reasoning);
  }

  // Concept Explanation Ratio Check: Candidate dropped 2+ buzzwords but explained 0 or 1
  const explainedCount = (evalJson.explainedConcepts || []).length;
  const mentionedCount = (evalJson.mentionedConcepts || []).length;
  if (mentionedCount >= 2 && explainedCount <= 1) {
    conceptUnderstanding = Math.min(3, conceptUnderstanding);
    depth = Math.min(2, depth);
    reasoning = Math.min(3, reasoning);
  }

  // ─── 3. Calculate Knowledge & Problem Solving Scores (0-10) ───
  let knowledgeScore = (accuracy * 0.40) + (conceptCoverage * 0.30) + (conceptUnderstanding * 0.30);
  let problemSolvingScore = (reasoning * 0.40) + (depth * 0.30) + (answerDirectnessScore * 0.30);

  // ─── 4. Anti-Inflation Guardrails & Floor Protection ───
  if (accuracy < 4) {
    knowledgeScore = Math.min(3.5, knowledgeScore);
  }
  if (conceptUnderstanding < 4) {
    knowledgeScore = Math.min(4.0, knowledgeScore);
  }
  if (reasoning < 4) {
    problemSolvingScore = Math.min(3.5, problemSolvingScore);
  }
  if (accuracy <= 2 && conceptUnderstanding <= 2) {
    knowledgeScore = Math.min(2.0, knowledgeScore);
  }

  // ─── 5. Conditional Positive Evidence Bonus (blocked for keyword-only & incorrect_attempt) ───
  let evidenceBonus = 0;
  if (answerType !== 'keyword_list_only' && answerType !== 'honest_unknown' && answerType !== 'incorrect_attempt' && (knowledgeScore >= 6 || problemSolvingScore >= 6)) {
    if (evalJson.positiveEvidence?.strongExample) evidenceBonus += 0.25;
    if (evalJson.positiveEvidence?.realProject) evidenceBonus += 0.25;
    if (evalJson.positiveEvidence?.tradeoffDiscussion) evidenceBonus += 0.25;
    if (evalJson.positiveEvidence?.practicalExperience) evidenceBonus += 0.25;
    evidenceBonus = Math.min(1.0, evidenceBonus);
  }

  // ─── 6. Reduced Technical Error Penalties ───
  const errors = evalJson.technicalErrors || [];
  let errorDeduction = 0;
  for (const err of errors) {
    if (err.severity === 'low') errorDeduction += 0.15;
    else if (err.severity === 'medium') errorDeduction += 0.40;
    else if (err.severity === 'high') errorDeduction += 0.80;
  }
  errorDeduction = Math.min(1.5, errorDeduction);

  // ─── 7. Final Adjusted Content Score with HARD CAP for keyword-only & incorrect_attempt ───
  const rawContent = (0.60 * knowledgeScore) + (0.40 * problemSolvingScore);
  let contentScore = Math.round(Math.max(0, Math.min(10, rawContent + evidenceBonus - errorDeduction)) * 10) / 10;

  if (answerType === 'keyword_list_only' || answerType === 'incorrect_attempt') {
    contentScore = Math.min(3.5, contentScore);
  }

  // ─── 8. Communication Score ───
  let communicationScore = Math.round(((clarity + structure + confidenceScoreVal + consistency) / 4) * 10) / 10;

  // ─── 9. Clamped Confidence Alignment / Gap ───
  let effectiveConfidence = Math.min(confidenceScoreVal, knowledgeScore + 2);
  // Safety: keyword-only answers — cap confidence so buzzword-reciters don't appear aligned
  if (answerType === 'keyword_list_only') {
    effectiveConfidence = Math.min(effectiveConfidence, 4);
  }
  let confidenceGap = effectiveConfidence - knowledgeScore; // range -10 to +10

  // ─── 10. Constrained Learning Potential ───
  let learningPotentialScore = (0.40 * curiosity) + (0.30 * reasoning) + (0.30 * selfCorrection);

  // ─── 10.1 Honesty and Bluff Logic ───
  let finalHonestyScore = Math.max(0, Math.min(10, evalJson.honestyScore ?? (isHonestUnknown ? 10 : 8.5)));
  let finalKnowledgeAdmissionScore = Math.max(0, Math.min(10, evalJson.knowledgeAdmissionScore ?? (isHonestUnknown ? 4 : 0)));

  if (isHonestUnknown) {
    answerType = 'honest_unknown';
    
    // Evaluate honestyScore and knowledgeAdmissionScore based on rules
    if (wordCount <= 3) {
      // Very short dismissal (e.g. "Don't know")
      finalHonestyScore = 7.5;
      finalKnowledgeAdmissionScore = 2.0;
    } else if (rawKnowledgeScore > 0.5) {
      // Partial knowledge + admits uncertainty (e.g., Candidate B)
      finalHonestyScore = 9.5;
      if (!evalJson.knowledgeAdmissionScore || evalJson.knowledgeAdmissionScore < 5) {
        finalKnowledgeAdmissionScore = 8.5;
      }
    } else {
      // Pure admission (e.g. "I don't know normalization.")
      finalHonestyScore = 10;
      finalKnowledgeAdmissionScore = 4.0;
    }

    // Force strict scoring guardrail overrides for honest unknowns
    contentScore = 0;
    knowledgeScore = 0;
    problemSolvingScore = 0;
    learningPotentialScore = 0;
    confidenceGap = 0;
    evidenceBonus = 0;
    communicationScore = 0;
  }

  let bluffRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (isHonestUnknown) {
    bluffRisk = 'LOW';
  } else {
    const confidenceGapVal = confidenceScoreVal - (Math.round(knowledgeScore * 10) / 10);
    if ((confidenceScoreVal >= 7 && knowledgeScore <= 3) || confidenceGapVal >= 4) {
      bluffRisk = 'HIGH';
    } else if (confidenceGapVal >= 2) {
      bluffRisk = 'MEDIUM';
    } else {
      bluffRisk = 'LOW';
    }
  }

  let misconceptionRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (evalJson.misconceptionRisk === 'LOW' || evalJson.misconceptionRisk === 'MEDIUM' || evalJson.misconceptionRisk === 'HIGH') {
    misconceptionRisk = evalJson.misconceptionRisk;
  } else {
    if (answerType === 'incorrect_attempt') {
      misconceptionRisk = confidenceScoreVal >= 6 ? 'HIGH' : 'MEDIUM';
    } else if (answerType === 'mixed_understanding') {
      misconceptionRisk = 'MEDIUM';
    } else {
      misconceptionRisk = 'LOW';
    }
  }

  let confidenceCalibration: 'UNDERCONFIDENT' | 'CALIBRATED' | 'OVERCONFIDENT' = 'CALIBRATED';
  const confidenceGapValForCalib = confidenceScoreVal - knowledgeScore;
  if (confidenceGapValForCalib >= 3) {
    confidenceCalibration = 'OVERCONFIDENT';
  } else if (confidenceGapValForCalib <= -3) {
    confidenceCalibration = 'UNDERCONFIDENT';
  }

  // ─── 11. Verdict ───
  // Verdict vocabulary must match shared/verdictPolicy.ts used by the Local engine
  // (Pass/Borderline/Fail) so that both modes produce comparable outcomes.
  // Previously the API path used Excellent/Good/Borderline/Fail — a vocabulary the
  // Local engine never emits — making cross-mode report comparison impossible.
  let verdict: 'Pass' | 'Borderline' | 'Fail';
  if (contentScore >= 7) verdict = 'Pass';
  else if (contentScore >= 5) verdict = 'Borderline';
  else verdict = 'Fail';

  const evaluationConfidence = Math.round(
    (conceptCoverage * 0.3 + conceptUnderstanding * 0.3 + reasoning * 0.2 + consistency * 0.2) * 10
  );

  // ─── 12. Concepts: mentioned vs explained ───
  const mentionedConcepts: string[] = evalJson.mentionedConcepts || evalJson.matchedKeyPoints || [];
  const explainedConcepts: string[] = isHonestUnknown ? [] : (evalJson.explainedConcepts || []);

  // ─── 13. Answer Quality (answerType-primary, score-secondary) ───
  const answerQuality = deriveAnswerQuality(answerType, contentScore);

  // ─── 14. Generate beautiful structured mentor feedback ───
  const feedback = generateFeedback(
    currentQuestion,
    answerType,
    knowledgeScore,
    explainedConcepts,
    mentionedConcepts,
    evalJson.missingKeyPoints || [],
    errors
  );

  return {
    questionId: Number(currentQuestion.id),
    questionText: currentQuestion.question,
    userAnswer: answer,
    contentScore,
    knowledgeScore: Math.round(knowledgeScore * 10) / 10,
    problemSolvingScore: Math.round(problemSolvingScore * 10) / 10,
    learningPotentialScore: Math.round(learningPotentialScore * 10) / 10,
    confidenceGap: Math.round(confidenceGap * 10) / 10,
    grammarScore: 0,
    fluencyScore: 0,
    communicationScore,
    mentionedConcepts,
    explainedConcepts,
    matchedKeyPoints: mentionedConcepts, // backward compat
    missingKeyPoints: evalJson.missingKeyPoints || [],
    answerType,
    answerQuality,
    verdict,
    feedback,
    honestyScore: finalHonestyScore,
    knowledgeAdmissionScore: finalKnowledgeAdmissionScore,
    bluffRisk,
    misconceptionRisk,
    confidenceCalibration,
    analysis: {
      technicalAccuracy: isHonestUnknown ? 0 : accuracy,
      problemSolving: isHonestUnknown ? 0 : depth,
      practicalExecution: isHonestUnknown ? 0 : answerDirectnessScore,
      communication: isHonestUnknown ? 0 : communicationScore,
      coverage: isHonestUnknown ? 0 : conceptCoverage,
      understanding: isHonestUnknown ? 0 : conceptUnderstanding,
      reasoning: isHonestUnknown ? 0 : reasoning,
      depth: isHonestUnknown ? 0 : depth,
      clarity: isHonestUnknown ? 0 : clarity,
      structure: isHonestUnknown ? 0 : structure,
      confidence: isHonestUnknown ? 0 : confidenceScoreVal,
      consistency: isHonestUnknown ? 0 : consistency,
      answerDirectnessScore: isHonestUnknown ? 0 : answerDirectnessScore,
      tradeoffReasoningScore: isHonestUnknown ? 0 : tradeoffReasoningScore,
      curiosity: isHonestUnknown ? 0 : curiosity,
      selfCorrection: isHonestUnknown ? 0 : selfCorrection,
      learningPotential: isHonestUnknown ? 0 : (Math.round(learningPotentialScore * 10) / 10),
      technicalErrors: isHonestUnknown ? [] : errors
    },
    behavioralMetrics: isBehavioral ? {
      communication: isHonestUnknown ? 0 : communicationScore,
      problemSolving: isHonestUnknown ? 0 : depth,
      ownership: isHonestUnknown ? 0 : accuracy,
      teamwork: isHonestUnknown ? 0 : conceptCoverage,
      adaptability: isHonestUnknown ? 0 : depth,
      leadershipPotential: isHonestUnknown ? 0 : Math.round((accuracy + communicationScore) / 2),
      responseStructure: isHonestUnknown ? 0 : structure,
      evidenceStrength: isHonestUnknown ? 0 : depth
    } : undefined,
    confidenceScore: visualMetrics?.confidenceLevel ?? 0,
    expressionAnalysis: "Visual analysis processed.",
    dimensions: {
      correctness: {
        score: accuracy,
        positiveEvidence: evalJson.dimensionEvidence?.correctness?.positiveEvidence?.slice(0, 3) || [],
        negativeEvidence: evalJson.dimensionEvidence?.correctness?.negativeEvidence?.slice(0, 3) || []
      },
      reasoning: {
        score: reasoning,
        positiveEvidence: evalJson.dimensionEvidence?.reasoning?.positiveEvidence?.slice(0, 3) || [],
        negativeEvidence: evalJson.dimensionEvidence?.reasoning?.negativeEvidence?.slice(0, 3) || []
      },
      application: {
        score: answerDirectnessScore,
        positiveEvidence: evalJson.dimensionEvidence?.application?.positiveEvidence?.slice(0, 3) || [],
        negativeEvidence: evalJson.dimensionEvidence?.application?.negativeEvidence?.slice(0, 3) || []
      },
      communication: {
        score: communicationScore,
        positiveEvidence: evalJson.dimensionEvidence?.communication?.positiveEvidence?.slice(0, 3) || [],
        negativeEvidence: evalJson.dimensionEvidence?.communication?.negativeEvidence?.slice(0, 3) || []
      },
      confidence: {
        score: confidenceScoreVal,
        positiveEvidence: evalJson.dimensionEvidence?.confidence?.positiveEvidence?.slice(0, 3) || [],
        negativeEvidence: evalJson.dimensionEvidence?.confidence?.negativeEvidence?.slice(0, 3) || []
      },
      coverage: {
        score: conceptCoverage,
        positiveEvidence: [], // Covered implicitly
        negativeEvidence: []
      }
    },
    timestamp: new Date().toISOString(),
    evaluationConfidence: Math.max(0, Math.min(100, evaluationConfidence)),
    relevanceScore: evalJson.relevanceScore,
    questionSatisfactionScore: evalJson.questionSatisfactionScore
  };
}

export const submitAnswer = async (
  candidate: Candidate,
  currentQuestion: Question,
  answer: string,
  visualMetrics?: VisualMetrics,
  settings?: RoleSettings,
  sessionId?: string,
  purpose: 'live' | 'eval' = 'eval',
  signal?: AbortSignal
): Promise<{ evaluation: EvaluationResult; nextQuestion: Question | null }> => {

  const isIntroductory = String(currentQuestion.id || '').includes("intro") || 
                         /tell me about yourself|introduce yourself|background|walk me through/i.test(currentQuestion.question);
  const isBehavioral = currentQuestion.type?.startsWith("Behavioral") || 
                       /tell me about a time|describe a situation|tell me about a project|mistake|challenge|worked under pressure/i.test(currentQuestion.question);
  const isSituational = /what would you do|how would you handle|production server|tight deadline|scenario/i.test(currentQuestion.question);
  const isTechnical = !isIntroductory && !isBehavioral && !isSituational;

  const categoryType = isIntroductory ? 'Introductory / Personal' :
                       isBehavioral ? 'Behavioral Experience' :
                       isSituational ? 'Situational Scenario' : 'Technical Concept / Engineering';

  const guideStr = isIntroductory
    ? "- Clear self-introduction including background, education/experience, key projects/skills, and career goals."
    : isBehavioral
    ? "- Structured STAR response (Situation, Task, Action with individual ownership, and Result/Learning)."
    : isSituational
    ? "- Clear problem triage, prioritized step-by-step action plan, stakeholder communication, and post-incident prevention."
    : (currentQuestion.evaluationGuide
        ? currentQuestion.evaluationGuide.map(area => `- ${area}`).join("\n")
        : "- Explain the core concepts, mechanisms, practical use cases, and trade-offs of the question.");

  // System prompt: evaluation rules and rubric (sent as system message for better instruction following)
  const evalSystemPrompt = `You are an expert interview evaluator. Evaluate spoken interview answers (speech-to-text transcripts). Focus on SUBSTANCE, not grammar or filler words.

${UNTRUSTED_INPUT_POLICY}

${RUBRIC_DIMENSIONS_POLICY}
${EVIDENCE_DISCIPLINE_POLICY}

Grade like a strict senior tech lead. DO NOT INFLATE SCORES.
- Award marks ONLY for correct technical understanding in own words. Keywords without explanation is NOT understanding.
- Vague, superficial, or 1-sentence answers MUST receive low scores (1.0 to 4.0 out of 10).
- Merely dropping buzzwords without explaining HOW/WHY they work MUST be classified as keyword_list_only or partial_explanation (capped at 1.0 - 3.5).
- Reserve high scores (7.0 - 10.0) ONLY for answers demonstrating clear mechanism, practical use cases, and trade-offs.
mentionedConcepts: concepts NAMED (even unexplained). explainedConcepts: concepts EXPLAINED with understanding. explainedConcepts ⊆ mentionedConcepts.`;

  // User prompt: question context + candidate answer + output format
  const evalUserPrompt = `QUESTION: ${sanitizeUntrusted(currentQuestion.question, MAX_FIELD_CHARS)}
${currentQuestion.ideal_answer ? `IDEAL ANSWER: ${sanitizeUntrusted(currentQuestion.ideal_answer, MAX_FIELD_CHARS)}` : ''}
CATEGORY: ${categoryType}
CHECKLIST: ${guideStr}

SCORING (${categoryType}): ${categoryType === 'Introductory / Personal' ? '8-10: background+skills+projects+career alignment | 5-7: basic info, lacks depth | 1-4: barebones/vague' :
  categoryType === 'Behavioral Experience' ? '8-10: STAR with INDIVIDUAL ownership+result | 6-8: situation+action but no outcomes | 4-5: "we" without personal ownership | 1-3: theoretical advice' :
  categoryType === 'Situational Scenario' ? '8-10: triage+action plan+communication+prevention | 6-8: practical steps but missing escalation | 1-5: unorganized' :
  '8-10: mechanism+use case+trade-offs | 6.5-8: accurate but misses trade-offs | 4-6: partial | 1-3.5: keywords only'}

CLASSIFY answerType FIRST: honest_unknown (explicitly admits) | keyword_list_only | incorrect_attempt | mixed_understanding | partial_explanation | full_explanation
SCORE CAPS: honest_unknown→all 0 | keyword_list→accuracy/conceptCoverage≤4, conceptUnderstanding≤2, depth≤1 | incorrect_attempt→accuracy/conceptCoverage≤2, conceptUnderstanding≤1, depth≤1
For non-honest_unknown: honestyScore (9-10=self-aware, 0-2=bluffing), misconceptionRisk (HIGH/MEDIUM/LOW).

${wrapUntrusted('candidate_answer', answer, {}, MAX_ANSWER_CHARS)}

Return ONLY this JSON (no markdown):
{
  "answerType": "honest_unknown|keyword_list_only|incorrect_attempt|mixed_understanding|partial_explanation|full_explanation",
  "misconceptionRisk": "LOW|MEDIUM|HIGH",
  "accuracy": 0, "conceptCoverage": 0, "relevanceScore": 0, "questionSatisfactionScore": 0,
  "conceptUnderstanding": 0, "reasoning": 0, "depth": 0, "clarity": 0, "structure": 0,
  "confidence": 0, "consistency": 0, "answerDirectnessScore": 0, "tradeoffReasoningScore": null,
  "curiosity": 0, "selfCorrection": 0, "honestyScore": 0, "knowledgeAdmissionScore": 0,
  "technicalErrors": [{"error": "str", "severity": "low|medium|high"}],
  "positiveEvidence": {"strongExample": false, "realProject": false, "tradeoffDiscussion": false, "practicalExperience": false},
  "dimensionEvidence": {
    "correctness": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "reasoning": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "application": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "communication": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "confidence": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]}
  },
  "mentionedConcepts": [], "explainedConcepts": [], "missingKeyPoints": []
}`;

  // Combined prompt for fallback compatibility
  const evalPrompt = evalSystemPrompt + "\n\n" + evalUserPrompt;

  const generateEval = async (prompt: string): Promise<EvaluationResult> => {
    // Single attempt — OpenRouterClient already handles retries + fallback internally
    // Retrying here would add 500ms+ latency per question with no benefit
    const rawResult = await generateWithOpenRouterDetailed(prompt, 1, purpose, signal, evalSystemPrompt, evalUserPrompt, sessionId);
    const extracted = extractJsonObject(rawResult.content);
    const evalJson = JSON.parse(extracted);

    if (!validateEvaluationSchema(evalJson)) {
      throw new Error("SchemaValidationError: Model response JSON is missing required evaluation fields.");
    }

    const evalRes = buildEvaluationResult(currentQuestion, answer, evalJson, visualMetrics, isBehavioral, categoryType);
    evalRes.evaluationMetadata = {
      engineId: 'api-openrouter-v2',
      version: 'v2.2.0',
      timestamp: new Date().toISOString(),
      latencyMs: rawResult.latencyMs,
      mode: 'API',
      evaluationSource: 'API',
      fallbackReason: 'NONE',
      provider: rawResult.provider,
      model: rawResult.model,
      providerTier: rawResult.tier || 'free',
      promptVersion: 'v2.2.0'
    };
    return evalRes;
  };

  try {
    const evaluation = await generateEval(evalPrompt);
    return { evaluation, nextQuestion: null };
  } catch (error: any) {
    console.error("OpenRouter Evaluation Failed:", error);
    ErrorLogService.logError('evaluation', `Answer evaluation failed for question "${currentQuestion.question.substring(0, 30)}...": ${error.message || error}`, error, sessionId, candidate.name);
    throw error;
  }
};

export const retryEvaluation = async (
  question: Question,
  answer: string,
  sessionId?: string
): Promise<EvaluationResult> => {
  const guideStr = question.evaluationGuide
    ? question.evaluationGuide.map(area => `- ${area}`).join("\n")
    : "- Explain the core concepts of the question.";

  const isBehavioral = question.type?.startsWith("Behavioral");

  // Slimmed prompt — same structure as submitAnswer
  const prompt = `Evaluate this spoken interview answer (speech-to-text transcript). Focus on SUBSTANCE, not grammar.

${UNTRUSTED_INPUT_POLICY}

QUESTION: ${sanitizeUntrusted(question.question, MAX_FIELD_CHARS)}
${question.ideal_answer ? `IDEAL ANSWER: ${sanitizeUntrusted(question.ideal_answer, MAX_FIELD_CHARS)}` : ''}
TYPE: ${sanitizeUntrusted(question.type || 'Technical', 100)}
CHECKLIST: ${guideStr}

=== CLASSIFY answerType FIRST ===
- honest_unknown: explicitly admits not knowing | keyword_list_only: lists terms without explaining
- incorrect_attempt: attempts but wrong | mixed_understanding: partial + misconceptions
- partial_explanation: covers SOME areas | full_explanation: correct with examples

SCORE CAPS: honest_unknown→all 0 | keyword_list→accuracy/conceptCoverage≤4, conceptUnderstanding≤2, depth≤1 | incorrect_attempt→accuracy/conceptCoverage≤2, conceptUnderstanding≤1, depth≤1

honestyScore: 9-10=self-aware, 0-2=bluffing. misconceptionRisk: HIGH=confident errors, MEDIUM=mixed, LOW=accurate.

${RUBRIC_DIMENSIONS_POLICY}
${EVIDENCE_DISCIPLINE_POLICY}

Grade like an experienced interviewer. mentionedConcepts: concepts NAMED. explainedConcepts: concepts EXPLAINED. explainedConcepts ⊆ mentionedConcepts.

${wrapUntrusted('candidate_answer', answer, {}, MAX_ANSWER_CHARS)}

Return ONLY this JSON (no markdown):
{
  "answerType": "honest_unknown|keyword_list_only|incorrect_attempt|mixed_understanding|partial_explanation|full_explanation",
  "misconceptionRisk": "LOW|MEDIUM|HIGH",
  "accuracy": 0, "conceptCoverage": 0, "relevanceScore": 0, "questionSatisfactionScore": 0,
  "conceptUnderstanding": 0, "reasoning": 0, "depth": 0,
  "clarity": 0, "structure": 0, "confidence": 0, "consistency": 0, "answerDirectnessScore": 0,
  "tradeoffReasoningScore": null, "curiosity": 0, "selfCorrection": 0,
  "honestyScore": 0, "knowledgeAdmissionScore": 0,
  "technicalErrors": [{"error": "str", "severity": "low|medium|high"}],
  "positiveEvidence": {"strongExample": false, "realProject": false, "tradeoffDiscussion": false, "practicalExperience": false},
  "dimensionEvidence": {
    "correctness": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "reasoning": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "application": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "communication": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]},
    "confidence": {"positiveEvidence": ["quote"], "negativeEvidence": ["quote"]}
  },
  "mentionedConcepts": [], "explainedConcepts": [], "missingKeyPoints": []
}`;

  try {
    const rawText = await generateWithOpenRouter(prompt, 2, 'eval', undefined, sessionId);
    // This path previously had no object extraction at all — only fence stripping — so any prose
    // around the JSON failed the manual re-evaluation outright. Same extractor as submitAnswer.
    const evalJson = JSON.parse(extractJsonObject(rawText));
    return buildEvaluationResult(question, answer, evalJson, undefined, isBehavioral);
  } catch (err: any) {
    console.error("Retry evaluation failed:", err);
    ErrorLogService.logError('evaluation', `Retry evaluation failed: ${err.message || err}`, err, sessionId);
    throw err;
  }
};

