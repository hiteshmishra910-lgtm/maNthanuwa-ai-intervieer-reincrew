/**
 * Unified Evaluation Scoring Policy
 *
 * Single source of truth for substance analysis, length-tier caps, and score safety gates
 * across all three evaluation modes (Local, Expert, API).
 *
 * Architecture:
 *   finalQuestionScore = min(rawScore, requiredElementCoverageCap, substanceCap, lengthCap)
 *
 * Cross-mode invariants:
 *   1. Same answer → same safety caps across Local, Expert and API modes.
 *   2. Length/substance rules are upper bounds, never score floors.
 *   3. Phase 12 required-element cap remains authoritative.
 *   4. Raw rubric scoring remains objective and unchanged.
 *   5. Well-formed short answers are not automatically punished merely for being concise.
 *   6. Behavioral depth requirements depend on question type.
 *   7. Final score can never increase because of applying a safety policy.
 *   8. No mode may bypass the final scoring policy.
 *   9. Fallback/API failure must not create a more generous score.
 *  10. Regression tests must compare score ordering, not just absolute values.
 */

// ─── LENGTH TIERS ────────────────────────────────────────────────────────────

export type LengthTier = 'SEVERE_INSUFFICIENCY' | 'VERY_LIMITED' | 'LIMITED' | 'MODERATE' | 'SUFFICIENT';

export interface LengthTierResult {
  tier: LengthTier;
  wordCount: number;
  /** Non-destructive upper-bound caps for each score dimension. */
  caps: ScoreCaps;
}

export interface ScoreCaps {
  technicalAccuracy: number;
  conceptUnderstanding: number;
  reasoning: number;
  communication: number;
  confidence: number;
}

/**
 * Classify an answer into a length tier. The tier determines maximum possible
 * scores — a ceiling, not an automatic score.
 *
 * A technically correct 15-word answer CAN demonstrate knowledge; it simply
 * cannot receive the same maximum as a fully developed answer when the rubric
 * requires explanation, reasoning, trade-offs, or evidence.
 */
export function getLengthTier(
  wordCount: number,
  evidenceCount: number = 0,
  isBehavioral: boolean = false,
  hasCompleteSentence: boolean = false,
  isIntroductory: boolean = false,
): LengthTierResult {
  if (wordCount < 5) {
    return {
      tier: 'SEVERE_INSUFFICIENCY',
      wordCount,
      caps: {
        technicalAccuracy: (evidenceCount > 0 && !isBehavioral) ? 2.0 : 0.5,
        conceptUnderstanding: (evidenceCount > 0 && !isBehavioral) ? 2.0 : 0.5,
        reasoning: 0.0,
        communication: 0.5,
        confidence: 1.0,
      },
    };
  }
  if (wordCount < 12) {
    // Behavioral answers under 12 words cannot provide STAR depth, so strictly cap at 3.0.
    // Introductory questions (like self-introductions) with a complete sentence cap at 5.0.
    // Technical answers with evidence scale up to 7.0.
    const openEndedCap = (isIntroductory && hasCompleteSentence) ? 5.0 : 3.0;
    const accuracyCap = (!isBehavioral && evidenceCount > 0) ? Math.min(7.0, 3.0 + evidenceCount * 3.5) : openEndedCap;
    const understandingCap = (!isBehavioral && evidenceCount > 0) ? Math.min(6.5, 2.5 + evidenceCount * 3.0) : openEndedCap;
    return {
      tier: 'VERY_LIMITED',
      wordCount,
      caps: {
        technicalAccuracy: accuracyCap,
        conceptUnderstanding: understandingCap,
        reasoning: 2.0,
        communication: 3.0,
        confidence: 3.0,
      },
    };
  }
  if (wordCount < 20) {
    const accuracyCap = evidenceCount > 0 ? Math.min(8.5, 5.0 + evidenceCount * 2.0) : 5.0;
    const understandingCap = evidenceCount > 0 ? Math.min(8.0, 4.0 + evidenceCount * 2.0) : 4.0;
    return {
      tier: 'LIMITED',
      wordCount,
      caps: {
        technicalAccuracy: accuracyCap,
        conceptUnderstanding: understandingCap,
        reasoning: 3.5,
        communication: 5.0,
        confidence: 4.0,
      },
    };
  }
  if (wordCount < 25) {
    const accuracyCap = evidenceCount > 0 ? Math.min(9.5, 7.0 + evidenceCount * 1.5) : 7.0;
    const understandingCap = evidenceCount > 0 ? Math.min(9.0, 6.0 + evidenceCount * 1.5) : 6.0;
    return {
      tier: 'MODERATE',
      wordCount,
      caps: {
        technicalAccuracy: accuracyCap,
        conceptUnderstanding: understandingCap,
        reasoning: 5.5,
        communication: 7.0,
        confidence: 6.0,
      },
    };
  }
  return {
    tier: 'SUFFICIENT',
    wordCount,
    caps: {
      technicalAccuracy: 10.0,
      conceptUnderstanding: 10.0,
      reasoning: 10.0,
      communication: 10.0,
      confidence: 10.0,
    },
  };
}

// ─── SUBSTANCE ANALYSIS ──────────────────────────────────────────────────────

export interface SubstanceAnalysis {
  wordCount: number;
  sentenceCount: number;
  /** Does the answer form at least one complete sentence? */
  hasCompleteSentence: boolean;
  /** Number of distinct concept/evidence signals detected. */
  evidenceCount: number;
  /** STAR element coverage for behavioral questions (0-4). */
  starCoverage: number;
  /** Whether the answer is a fragment (incomplete sentence). */
  isFragment: boolean;
  /** Substance quality factor 0.0-1.0. */
  substanceFactor: number;
}

/**
 * Analyze the substance of an answer beyond just word count.
 * Considers sentence completeness, evidence density, and STAR structure.
 */
export function classifyAnswerSubstance(
  answer: string,
  evidenceCount: number,
  isBehavioral: boolean,
  questionSatisfaction?: string,
): SubstanceAnalysis {
  const trimmed = (answer || '').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const answerLower = trimmed.toLowerCase();

  // Sentence completeness: contains at least one verb-like pattern or satisfied intent
  const sentences = trimmed.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const sentenceCount = sentences.length;

  const verbMarkers = ['is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did',
    'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
    'helps', 'helped', 'uses', 'used', 'means', 'makes', 'made', 'works', 'worked',
    'allows', 'enables', 'provides', 'creates', 'implements', 'handles', 'manages',
    'processes', 'stores', 'defines', 'describes', 'ensures', 'prevents', 'involves', 'am', 'enjoy', 'enjoys', 'like', 'likes'];
  const hasCompleteSentence = questionSatisfaction === 'YES' || sentences.some(s => {
    const sWords = s.split(/\s+/);
    return sWords.length >= 3 && sWords.some(w => verbMarkers.includes(w.toLowerCase()));
  });

  const isFragment = !hasCompleteSentence && wordCount < 8;

  // STAR analysis for behavioral
  let starCoverage = 0;
  if (isBehavioral) {
    if (/\b(situation|context|project|team|during|when|while)\b/i.test(answerLower)) starCoverage++;
    if (/\b(task|challenge|problem|goal|objective|responsible)\b/i.test(answerLower)) starCoverage++;
    if (/\b(action|implemented|did|resolved|decided|took|approached|built|created|designed|fixed|helped)\b/i.test(answerLower)) starCoverage++;
    if (/\b(result|outcome|impact|improved|reduced|achieved|completed|delivered|learned|succeeded)\b/i.test(answerLower)) starCoverage++;
  }

  // Substance factor: combines word count, evidence, and sentence completeness
  // This is NOT a score — it's a ceiling multiplier (0.0 to 1.0)
  let substanceFactor: number;
  if (isFragment) {
    substanceFactor = 0.05; // Fragments get almost nothing
  } else if (wordCount < 5) {
    substanceFactor = 0.1;
  } else if (wordCount < 12) {
    // Complete sentences get a higher baseline (0.40) for open-ended/concise responses
    const base = hasCompleteSentence ? 0.45 : 0.15;
    substanceFactor = Math.min(0.60, base + evidenceCount * 0.1);
  } else if (wordCount < 20) {
    const base = hasCompleteSentence ? 0.55 : 0.30;
    substanceFactor = Math.min(0.75, base + evidenceCount * 0.1);
  } else if (wordCount < 25) {
    substanceFactor = Math.min(0.85, 0.50 + evidenceCount * 0.08);
  } else {
    substanceFactor = Math.min(1.0, 0.65 + evidenceCount * 0.07);
  }

  // Behavioral answers need STAR coverage
  if (isBehavioral && wordCount >= 12) {
    const starFactor = starCoverage / 4;
    // Blend: 60% word/evidence based, 40% STAR based
    substanceFactor = substanceFactor * 0.6 + starFactor * 0.4;
  }

  return {
    wordCount,
    sentenceCount,
    hasCompleteSentence,
    evidenceCount,
    starCoverage,
    isFragment,
    substanceFactor: Math.round(substanceFactor * 100) / 100,
  };
}

// ─── SUBSTANCE-BASED SCORE CAP ──────────────────────────────────────────────

/**
 * Compute a substance-based ceiling for open-ended/behavioral answers.
 * This replaces the old fixed 6.0 floor with an evidence-scaled ceiling.
 *
 * @param substance - Analysis from classifyAnswerSubstance
 * @param maxScore  - Maximum achievable score (10.0 for normal questions)
 * @returns A non-destructive upper bound (0-10)
 */
export function computeSubstanceCap(substance: SubstanceAnalysis, maxScore: number = 10.0): number {
  return Math.round(Math.min(maxScore, maxScore * substance.substanceFactor) * 10) / 10;
}

// ─── UNIFIED SCORE POLICY APPLICATION ────────────────────────────────────────

export interface ScoreDimensions {
  technicalAccuracy: number;
  conceptUnderstanding: number;
  reasoning: number;
  communication: number;
  confidence: number;
}

export interface PolicyResult {
  scores: ScoreDimensions;
  lengthTier: LengthTierResult;
  substance: SubstanceAnalysis;
  appliedCaps: string[];
}

/**
 * Apply the unified scoring policy as non-destructive upper bounds.
 *
 * This is the single entry point that all three modes (Local, Expert, API) MUST call
 * after computing their raw scores. It applies:
 *   1. Length-tier caps
 *   2. Substance-based caps
 *   3. Score Gravity (peripherals cannot exceed accuracy + ceiling offset)
 *
 * The caller is responsible for also applying Phase 12 required-element caps
 * and any question-alignment policy caps.
 */
export function applyUnifiedScoringPolicy(
  rawScores: ScoreDimensions,
  answer: string,
  evidenceCount: number,
  isBehavioral: boolean,
  accuracyForGravity?: number,
  isIntroductory: boolean = false,
  questionSatisfaction?: string,
): PolicyResult {
  const appliedCaps: string[] = [];

  // 1. Substance analysis
  const substance = classifyAnswerSubstance(answer, evidenceCount, isBehavioral, questionSatisfaction);

  // 2. Length tier caps
  const words = (answer || '').trim().split(/\s+/).filter(Boolean);
  const behavioralEvidence = isBehavioral ? substance.starCoverage : evidenceCount;
  const lengthTier = getLengthTier(words.length, behavioralEvidence, isBehavioral, substance.hasCompleteSentence, isIntroductory);

  // Start from raw scores
  const scores: ScoreDimensions = { ...rawScores };

  // Apply length tier caps (non-destructive upper bounds)
  if (lengthTier.tier !== 'SUFFICIENT') {
    const caps = lengthTier.caps;
    if (scores.technicalAccuracy > caps.technicalAccuracy) {
      scores.technicalAccuracy = caps.technicalAccuracy;
      appliedCaps.push(`Length cap (${lengthTier.tier}): accuracy ${rawScores.technicalAccuracy.toFixed(1)} → ${caps.technicalAccuracy}`);
    }
    if (scores.conceptUnderstanding > caps.conceptUnderstanding) {
      scores.conceptUnderstanding = caps.conceptUnderstanding;
      appliedCaps.push(`Length cap (${lengthTier.tier}): understanding ${rawScores.conceptUnderstanding.toFixed(1)} → ${caps.conceptUnderstanding}`);
    }
    if (scores.reasoning > caps.reasoning) {
      scores.reasoning = caps.reasoning;
      appliedCaps.push(`Length cap (${lengthTier.tier}): reasoning ${rawScores.reasoning.toFixed(1)} → ${caps.reasoning}`);
    }
    if (scores.communication > caps.communication) {
      scores.communication = caps.communication;
      appliedCaps.push(`Length cap (${lengthTier.tier}): communication ${rawScores.communication.toFixed(1)} → ${caps.communication}`);
    }
    if (scores.confidence > caps.confidence) {
      scores.confidence = caps.confidence;
      appliedCaps.push(`Length cap (${lengthTier.tier}): confidence ${rawScores.confidence.toFixed(1)} → ${caps.confidence}`);
    }
  }

  // Apply substance-based cap for behavioral answers
  if (isBehavioral && substance.substanceFactor < 1.0) {
    const rawSubCap = computeSubstanceCap(substance);
    // Fragments (<5 words or incomplete non-sentences) cap at 0.5; complete sentences cap at least at 3.0 unless limited by length tier
    const subCap = substance.isFragment ? Math.min(0.5, rawSubCap) : rawSubCap;
    if (scores.technicalAccuracy > subCap) {
      scores.technicalAccuracy = subCap;
      appliedCaps.push(`Substance cap (factor=${substance.substanceFactor}): accuracy → ${subCap}`);
    }
    if (scores.conceptUnderstanding > subCap) {
      scores.conceptUnderstanding = subCap;
      appliedCaps.push(`Substance cap: understanding → ${subCap}`);
    }
  }

  // Apply Score Gravity — peripherals cannot exceed accuracy + GRAVITY_OFFSET
  const GRAVITY_OFFSET = 2.0;
  const gravityAnchor = accuracyForGravity !== undefined ? accuracyForGravity : scores.technicalAccuracy;
  const GRAVITY_THRESHOLD = 3.0; // Synchronized with KNOWLEDGE_GATE_CAP

  if (gravityAnchor <= GRAVITY_THRESHOLD) {
    const maxPeripheral = gravityAnchor + GRAVITY_OFFSET;
    appliedCaps.push(`Score Gravity: Accuracy is critically low (${gravityAnchor}). Capping peripheral scores to ${maxPeripheral}.`);

    if (scores.communication > maxPeripheral) {
      scores.communication = maxPeripheral;
    }
    if (scores.confidence > maxPeripheral) {
      scores.confidence = maxPeripheral;
    }
    if (scores.conceptUnderstanding > maxPeripheral) {
      scores.conceptUnderstanding = maxPeripheral;
    }
    if (scores.reasoning > maxPeripheral) {
      scores.reasoning = maxPeripheral;
    }
  }

  // Ensure all scores are in [0, 10]
  scores.technicalAccuracy = clamp(scores.technicalAccuracy);
  scores.conceptUnderstanding = clamp(scores.conceptUnderstanding);
  scores.reasoning = clamp(scores.reasoning);
  scores.communication = clamp(scores.communication);
  scores.confidence = clamp(scores.confidence);

  return { scores, lengthTier, substance, appliedCaps };
}

/**
 * Compute the initial communication score based on substance rather than
 * defaulting to 10. Short/empty answers should not receive automatic
 * communication credit.
 *
 * @returns A starting communication score (0-10) that reflects answer substance
 */
export function computeSubstanceBasedCommunicationStart(wordCount: number, sentenceCount: number, hasCompleteSentence: boolean): number {
  if (wordCount === 0) return 0;
  if (wordCount < 5) return 1.0;
  if (!hasCompleteSentence) return 2.0;
  if (wordCount < 12) return 4.0;
  if (wordCount < 20) return 6.0;
  if (sentenceCount < 2) return 6.5;
  return 8.0; // Full 10 must be earned through quality, not given by default
}

/**
 * Compute the initial confidence score based on demonstrated evidence
 * rather than defaulting to 8.0. Confidence should be earned through
 * demonstrated knowledge, not assumed.
 *
 * @returns A starting confidence score (0-10) that reflects evidence quality
 */
export function computeEvidenceBasedConfidenceStart(evidenceCount: number, wordCount: number): number {
  if (wordCount === 0) return 0;
  if (wordCount < 5) return 1.0;
  if (evidenceCount === 0) return 3.0;
  if (evidenceCount === 1) return 4.5;
  if (evidenceCount <= 3) return 5.5;
  return 6.5; // Full confidence must be earned through quality signals
}

/**
 * Compute the initial reasoning score based on demonstrated connections
 * rather than defaulting to 5.0. Reasoning requires demonstrated logical structure.
 *
 * @returns A starting reasoning score (0-10)
 */
export function computeEvidenceBasedReasoningStart(
  validConnections: number,
  expectedRelations: number,
  wordCount: number,
): number {
  if (wordCount === 0) return 0;
  if (wordCount < 5) return 0;

  if (expectedRelations > 0) {
    // If we have expected relations, score based on actual vs expected
    const connectionRatio = validConnections / expectedRelations;
    return Math.round(Math.min(10, connectionRatio * 10) * 10) / 10;
  }

  // Fallback: base on demonstrated connections, starting from 2.0 instead of 5.0
  if (validConnections === 0) return 2.0;
  return Math.min(10, 2.0 + validConnections * 1.5);
}

/**
 * Compute a substance-scaled facts score for open-ended questions.
 * Replaces the old fixed 6.0 floor.
 */
export function computeOpenEndedFactsScore(
  satisfaction: 'YES' | 'PARTIAL' | 'NO',
  relevantContentRatio: number,
  substance: SubstanceAnalysis,
): number {
  if (satisfaction === 'YES') {
    const ratio = (typeof relevantContentRatio === 'number' && relevantContentRatio > 0) ? relevantContentRatio : 1.0;
    const baseScore = Math.max(6.0, ratio * 8.5);
    const subFactor = Math.max(0.50, substance.substanceFactor);
    return Math.round(Math.min(8.5, baseScore * subFactor) * 10) / 10;
  }
  if (satisfaction === 'PARTIAL') {
    const subFactor = Math.max(0.40, substance.substanceFactor);
    return Math.round(Math.min(4.0, 4.0 * subFactor) * 10) / 10;
  }
  return 0;
}

function clamp(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
}
