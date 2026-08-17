/**
 * AdaptiveProbeEngine.ts (Phase 5 Adaptive Probing & Safety Gate)
 * Pure, side-effect free decision engine for follow-up probing recommendations.
 * Operates behind VITE_ADAPTIVE_PROBING_ENABLED feature flag.
 * Default behavior: Returns SKIP with zero side-effects.
 */

import { isFeatureFlagEnabled } from '../expert/config';
import { DialogueContextSnapshot_v1 } from './DialogueContext';
import { Question } from '../../../types';

export enum ProbeDecisionReason {
  FLAG_DISABLED = 'FLAG_DISABLED',
  HIGH_CONFIDENCE_UNDERSTANDING = 'HIGH_CONFIDENCE_UNDERSTANDING',
  SESSION_BUDGET_EXHAUSTED = 'SESSION_BUDGET_EXHAUSTED',
  QUESTION_BUDGET_EXHAUSTED = 'QUESTION_BUDGET_EXHAUSTED',
  CONCEPT_ALREADY_PROBED = 'CONCEPT_ALREADY_PROBED',
  MISSING_CONCEPT_PROBE_RECOMMENDED = 'MISSING_CONCEPT_PROBE_RECOMMENDED',
  NO_ACTIONABLE_PROBE = 'NO_ACTIONABLE_PROBE',
  API_PROBE_UNAVAILABLE = 'API_PROBE_UNAVAILABLE'
}

export interface ProbeDecisionResult {
  readonly schemaVersion: 'v1.0';
  readonly decision: 'PROBE' | 'SKIP';
  readonly confidence: number;
  readonly reason: ProbeDecisionReason;
  readonly missingConcepts: readonly string[];
  readonly budgetRemaining: number;
  readonly alreadyAsked: boolean;
  readonly triggerRule: string;
  readonly followUpQuestionText?: string;
  readonly isAntiCheatingProbe?: boolean;
  readonly diagnostics: readonly string[];
}

export interface AdaptiveProbeInput {
  readonly sessionId: string;
  readonly question: Question;
  readonly candidateUtterance: string;
  readonly intentConfidence: number;
  readonly contextSnapshot?: DialogueContextSnapshot_v1;
  readonly sessionProbeCount: number;
  readonly questionProbeCount: number;
}

/** Curated Probe Bank mapping concept keys to deterministic follow-up templates */
export const CURATED_PROBE_BANK: Record<string, string[]> = {
  default: [
    "Could you elaborate more on the underlying mechanism of this concept?",
    "What specific trade-offs or edge cases would you consider here?"
  ],
  async_await: [
    "How does async/await interact with the event loop under the hood?",
    "What happens to exception handling inside an unhandled promise rejection?"
  ],
  event_loop: [
    "Could you walk through how microtasks and macrotasks are processed in order?",
    "What causes call stack blocking during heavy synchronous operations?"
  ],
  dependency_injection: [
    "How does dependency injection decouple component lifecycle management?",
    "What are the trade-offs between constructor injection and service locator patterns?"
  ],
  indexing: [
    "How does a B-Tree index structure improve query execution time?",
    "Under what write-heavy workload conditions does index maintenance degrade throughput?"
  ],
  closure: [
    "How do lexical scope chains preserve variable references in memory?",
    "What strategies prevent accidental memory leaks with long-lived closures?"
  ],
  caching: [
    "What eviction policy (LRU vs LFU) would you select for write-heavy cache workloads?",
    "How do you mitigate cache stampede or thundering herd problems under high concurrency?"
  ]
};

export class AdaptiveProbeEngine {
  public readonly version = 'v1' as const;
  public readonly stabilityTier = 'Internal' as const;

  public static readonly MAX_PROBES_PER_QUESTION = 2;
  public static readonly MAX_PROBES_PER_SESSION = 5;
  public static readonly CONFIDENCE_THRESHOLD = 0.85;

  /**
   * Deterministic hash for mapping (sessionId:conceptId) to curated probe bank templates.
   */
  public static getCuratedProbe(sessionId: string, conceptId: string): string {
    const key = (conceptId || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const templates = CURATED_PROBE_BANK[key] || CURATED_PROBE_BANK.default;
    
    // Hash sessionId:conceptId to pick deterministically
    const seed = `${sessionId}:${key}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % templates.length;
    return templates[idx];
  }

  /**
   * Generates a SKIP result for API probe generation failures.
   */
  public static createApiProbeUnavailableResult(budgetRemaining: number = 0): ProbeDecisionResult {
    return {
      schemaVersion: 'v1.0',
      decision: 'SKIP',
      confidence: 0,
      reason: ProbeDecisionReason.API_PROBE_UNAVAILABLE,
      missingConcepts: [],
      budgetRemaining,
      alreadyAsked: false,
      triggerRule: 'API_PROBE_UNAVAILABLE',
      diagnostics: ['API probe generation failed or was unavailable. Silently skipped without local substitution.']
    };
  }

  /**
   * Normalizes text for duplicate probe string comparison.
   */
  private static normalizeProbeText(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }


  /**
   * Deterministic, side-effect free evaluation of adaptive probing recommendations.
   * Never mutates input context, never alters scores, never emits UI events.
   */
  public evaluateProbingDecision(input: AdaptiveProbeInput): ProbeDecisionResult {
    const budgetRemaining = Math.max(
      0,
      AdaptiveProbeEngine.MAX_PROBES_PER_SESSION - input.sessionProbeCount
    );

    // 1. Feature Flag Gate: If flag is OFF, return SKIP immediately
    if (!isFeatureFlagEnabled('ADAPTIVE_PROBING_ENABLED')) {
      return {
        schemaVersion: 'v1.0',
        decision: 'SKIP',
        confidence: 1.0,
        reason: ProbeDecisionReason.FLAG_DISABLED,
        missingConcepts: [],
        budgetRemaining,
        alreadyAsked: false,
        triggerRule: 'FLAG_DISABLED',
        diagnostics: ['VITE_ADAPTIVE_PROBING_ENABLED is false']
      };
    }

    // 2. Question Probe Budget Exhaustion Gate
    if (input.questionProbeCount >= AdaptiveProbeEngine.MAX_PROBES_PER_QUESTION) {
      return {
        schemaVersion: 'v1.0',
        decision: 'SKIP',
        confidence: 1.0,
        reason: ProbeDecisionReason.QUESTION_BUDGET_EXHAUSTED,
        missingConcepts: [],
        budgetRemaining,
        alreadyAsked: false,
        triggerRule: 'MAX_PROBES_PER_QUESTION_REACHED',
        diagnostics: [`Question probe limit reached (${input.questionProbeCount}/${AdaptiveProbeEngine.MAX_PROBES_PER_QUESTION})`]
      };
    }

    // 3. Session Probe Budget Exhaustion Gate
    if (budgetRemaining <= 0) {
      return {
        schemaVersion: 'v1.0',
        decision: 'SKIP',
        confidence: 1.0,
        reason: ProbeDecisionReason.SESSION_BUDGET_EXHAUSTED,
        missingConcepts: [],
        budgetRemaining: 0,
        alreadyAsked: false,
        triggerRule: 'MAX_PROBES_PER_SESSION_REACHED',
        diagnostics: [`Session probe limit reached (${input.sessionProbeCount}/${AdaptiveProbeEngine.MAX_PROBES_PER_SESSION})`]
      };
    }

    // 4. Confidence Threshold Gate (>= 0.85 confidence -> concept well understood, SKIP)
    if (input.intentConfidence >= AdaptiveProbeEngine.CONFIDENCE_THRESHOLD) {
      return {
        schemaVersion: 'v1.0',
        decision: 'SKIP',
        confidence: input.intentConfidence,
        reason: ProbeDecisionReason.HIGH_CONFIDENCE_UNDERSTANDING,
        missingConcepts: [],
        budgetRemaining,
        alreadyAsked: false,
        triggerRule: 'CONFIDENCE_GE_85',
        diagnostics: [`High candidate confidence (${input.intentConfidence.toFixed(2)} >= 0.85)`]
      };
    }

    // 5. Missing Concept Analysis
    const targetConcepts = input.question.keyConcepts || [];
    const coveredConcepts = input.contextSnapshot?.coveredConceptIds || [];
    const missingConcepts: string[] = [];

    for (const conceptKey of targetConcepts) {
      const cId = typeof conceptKey === 'string' ? conceptKey : (conceptKey as any).id || (conceptKey as any).concept;
      if (cId && !coveredConcepts.includes(cId)) {
        missingConcepts.push(cId);
      }
    }

    // If no missing concepts are identifiable, return NO_ACTIONABLE_PROBE
    if (missingConcepts.length === 0) {
      return {
        schemaVersion: 'v1.0',
        decision: 'SKIP',
        confidence: input.intentConfidence,
        reason: ProbeDecisionReason.NO_ACTIONABLE_PROBE,
        missingConcepts: [],
        budgetRemaining,
        alreadyAsked: false,
        triggerRule: 'ALL_CONCEPTS_COVERED',
        diagnostics: ['No actionable missing concepts identified for follow-up probe']
      };
    }

    // 6. Anti-Cheating & Mechanical Explanation Probe Criteria Audit
    const textLower = (input.candidateUtterance || '').toLowerCase();
    const hasTechnicalClaim = /\b(event loop|async|promise|closure|index|cache|microtask|dependency injection|transaction|query|database|react|state)\b/i.test(textLower);
    const hasMechanicalExplanation = /\b(because|how|works by|internal|allocates|executes|under the hood|behind the scenes|stack|queue|memory)\b/i.test(textLower);
    const isAntiCheatingTriggered = hasTechnicalClaim && !hasMechanicalExplanation;

    const primaryMissing = missingConcepts[0];
    const proposedProbeText = AdaptiveProbeEngine.getCuratedProbe(input.sessionId, primaryMissing);
    const normalizedProposed = AdaptiveProbeEngine.normalizeProbeText(proposedProbeText);

    const probeHistory = input.contextSnapshot?.probeHistory || [];
    const fallbackText = AdaptiveProbeEngine.normalizeProbeText(`Could you elaborate more on how ${primaryMissing} operates?`);
    const conceptNorm = AdaptiveProbeEngine.normalizeProbeText(primaryMissing);

    const isDuplicate = probeHistory.some(existing => {
      const norm = AdaptiveProbeEngine.normalizeProbeText(existing);
      return norm === normalizedProposed || norm === fallbackText || (conceptNorm.length > 2 && norm.includes(conceptNorm));
    });

    if (isDuplicate) {
      return {
        schemaVersion: 'v1.0',
        decision: 'SKIP',
        confidence: input.intentConfidence,
        reason: ProbeDecisionReason.CONCEPT_ALREADY_PROBED,
        missingConcepts,
        budgetRemaining,
        alreadyAsked: true,
        triggerRule: 'DUPLICATE_PROBE_PREVENTED',
        diagnostics: [`Probe for ${primaryMissing} was already asked in this session`]
      };
    }

    // Recommend PROBE
    return {
      schemaVersion: 'v1.0',
      decision: 'PROBE',
      confidence: input.intentConfidence,
      reason: ProbeDecisionReason.MISSING_CONCEPT_PROBE_RECOMMENDED,
      missingConcepts,
      budgetRemaining: budgetRemaining - 1,
      alreadyAsked: false,
      isAntiCheatingProbe: isAntiCheatingTriggered,
      triggerRule: isAntiCheatingTriggered ? 'ANTI_CHEATING_MECHANICAL_PROBE' : 'LOW_CONFIDENCE_MISSING_CONCEPT',
      followUpQuestionText: proposedProbeText,
      diagnostics: [
        `Recommend follow-up probe for missing concept: ${primaryMissing}`,
        ...(isAntiCheatingTriggered ? ['Anti-cheating probe triggered as evidence-gathering mechanism (not a cheating determination).'] : []),
        `Confidence: ${input.intentConfidence.toFixed(2)}`,
        `Budget remaining after probe: ${budgetRemaining - 1}`
      ]
    };
  }
}

