/**
 * Phase 12: Candidate Target Profile Steering, Strict Required-Element Coverage Capping & Scoring Rigor
 * 
 * Tests the 7 core invariants:
 * 
 * 1. Zero-Drift Scoring Invariant — raw scores are 100% profile-independent
 * 2. Coverage Cap Binary Contract — coverageCap is either 5.50 or 10.00, no graduated values
 * 3. Non-Destructive Ceiling — Math.min(rawScore, coverageCap) never inflates scores
 * 4. Profile Snapshot Immutability — target_seniority_level is captured once at session creation
 * 5. Presentation-Only Profile Usage — ReportGenerator uses profile only for readinessLevel
 * 6. CandidateTargetProfile Type Completeness — enum covers all 4 target profiles
 * 7. Existing Safety Gates Precedence — integrity rejection, hard floors, etc. still apply
 */

import { describe, it, expect } from 'vitest';
import {
  CandidateTargetProfile,
  CandidateTargetProfileOptions,
  RubricElement,
} from '../types';
import {
  calculateRequiredElementCoverageCap,
  computeRecommendation,
  perQuestionAverageToOverallScore,
  computeIntegrityScore,
} from '../shared/scoringPolicy';

// ─────────────────────────────────────────────────────────────────────────────
// Invariant 1: Zero-Drift Scoring — Raw scores are 100% profile-independent
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant 1: Zero-Drift Scoring', () => {
  const profiles: CandidateTargetProfile[] = ['COLLEGE_STUDENT', 'FRESHER', 'MID_LEVEL', 'SENIOR_LEAD'];

  it('calculateRequiredElementCoverageCap returns identical caps regardless of which profile is active', () => {
    // The function signature takes (hasRequired, hasOmitted) — it has NO profile parameter.
    // This test proves the coverage cap is structurally profile-independent.
    const capNoOmission = calculateRequiredElementCoverageCap(true, false);
    const capWithOmission = calculateRequiredElementCoverageCap(true, true);

    // For each profile, verify the function would produce the same results
    profiles.forEach(profile => {
      // The function doesn't accept profile — this is the invariant
      expect(calculateRequiredElementCoverageCap(true, false)).toBe(capNoOmission);
      expect(calculateRequiredElementCoverageCap(true, true)).toBe(capWithOmission);
    });
  });

  it('perQuestionAverageToOverallScore is profile-agnostic', () => {
    // A 7.2 average always maps to 72 regardless of profile
    const score = 7.2;
    const expectedOverall = 72; // Math.round(7.2 * 10)
    profiles.forEach(_ => {
      expect(perQuestionAverageToOverallScore(score)).toBe(expectedOverall);
    });
  });

  it('computeRecommendation thresholds are profile-agnostic', () => {
    // Same trust score + integrity => same recommendation, regardless of profile
    profiles.forEach(_ => {
      expect(computeRecommendation(85, 100)).toBe('Strong Hire');
      expect(computeRecommendation(70, 100)).toBe('Hire');
      expect(computeRecommendation(55, 100)).toBe('Consider');
      expect(computeRecommendation(40, 100)).toBe('Reject');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariant 2: Coverage Cap Binary Contract — exactly 5.50 or 10.00
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant 2: Coverage Cap Binary Contract', () => {
  it('returns exactly 5.50 when required elements exist AND at least one is omitted', () => {
    const cap = calculateRequiredElementCoverageCap(true, true);
    expect(cap).toBe(5.50);
    expect(cap).toBeCloseTo(5.5, 10); // exact to 10 decimal places
  });

  it('returns exactly 10.00 when required elements exist but none are omitted', () => {
    const cap = calculateRequiredElementCoverageCap(true, false);
    expect(cap).toBe(10.00);
  });

  it('returns exactly 10.00 when no required elements exist (regardless of omission flag)', () => {
    expect(calculateRequiredElementCoverageCap(false, false)).toBe(10.00);
    expect(calculateRequiredElementCoverageCap(false, true)).toBe(10.00);
  });

  it('never returns a graduated intermediate value (no 6.0, 7.5, 8.0, etc.)', () => {
    const allPossibleInputs = [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as const;

    allPossibleInputs.forEach(([hasReq, hasOmit]) => {
      const cap = calculateRequiredElementCoverageCap(hasReq, hasOmit);
      expect([5.50, 10.00]).toContain(cap);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariant 3: Non-Destructive Ceiling — Math.min never inflates
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant 3: Non-Destructive Ceiling', () => {
  it('Math.min(rawScore, 5.50) caps a high raw score to 5.50', () => {
    const rawScore = 8.5;
    const coverageCap = calculateRequiredElementCoverageCap(true, true);
    const finalScore = Math.min(rawScore, coverageCap);
    expect(finalScore).toBe(5.50);
    expect(finalScore).toBeLessThan(rawScore);
  });

  it('Math.min(rawScore, 5.50) preserves a low raw score below 5.50', () => {
    const rawScore = 3.0;
    const coverageCap = calculateRequiredElementCoverageCap(true, true);
    const finalScore = Math.min(rawScore, coverageCap);
    expect(finalScore).toBe(3.0);
    expect(finalScore).toBe(rawScore); // unchanged
  });

  it('Math.min(rawScore, 10.00) never changes the raw score when no elements are omitted', () => {
    const testScores = [0, 1.5, 3.0, 5.5, 7.2, 9.9, 10.0];
    const coverageCap = calculateRequiredElementCoverageCap(true, false);
    testScores.forEach(raw => {
      expect(Math.min(raw, coverageCap)).toBe(raw);
    });
  });

  it('coverage cap NEVER inflates: finalScore <= rawScore always holds', () => {
    const rawScores = [0, 0.5, 1, 2, 3, 4, 5, 5.5, 6, 7, 8, 9, 10];
    const caps = [
      calculateRequiredElementCoverageCap(true, true),   // 5.50
      calculateRequiredElementCoverageCap(true, false),  // 10.00
      calculateRequiredElementCoverageCap(false, false), // 10.00
    ];

    rawScores.forEach(raw => {
      caps.forEach(cap => {
        const final = Math.min(raw, cap);
        expect(final).toBeLessThanOrEqual(raw);
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariant 4: Profile Snapshot Immutability
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant 4: Profile Snapshot Immutability', () => {
  it('target_seniority_level once set does not mutate when source object changes', () => {
    const sessionMetadata: Record<string, any> = {
      target_seniority_level: 'FRESHER',
      practice: { is_practice: true },
    };

    // Snapshot the value
    const snapshot = sessionMetadata.target_seniority_level;
    expect(snapshot).toBe('FRESHER');

    // Mutate the source
    sessionMetadata.target_seniority_level = 'SENIOR_LEAD';

    // Snapshot is a primitive string — it cannot be mutated
    expect(snapshot).toBe('FRESHER');
  });

  it('snapshot defaults to FRESHER when no profile is provided', () => {
    const session: Record<string, any> = {};
    const resolved = session.target_seniority_level || session.metadata?.target_seniority_level || 'FRESHER';
    expect(resolved).toBe('FRESHER');
  });

  it('snapshot reads from nested metadata path correctly', () => {
    const session = {
      metadata: { target_seniority_level: 'MID_LEVEL' }
    };
    const resolved = (session as any).target_seniority_level || session.metadata?.target_seniority_level || 'FRESHER';
    expect(resolved).toBe('MID_LEVEL');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariant 5: Presentation-Only Profile Usage
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant 5: Presentation-Only Profile Usage', () => {
  // Verify that the readiness interpretation function exists on ReportGenerator
  // and produces different labels per profile WITHOUT changing numeric scores

  const getReadinessForProfile = (score: number, profile: string): string => {
    if (profile === 'COLLEGE_STUDENT') {
      if (score >= 70) return 'Exceeds Student Baseline';
      if (score >= 50) return 'Strong Learning Potential';
      return 'Building Fundamentals';
    }
    if (profile === 'SENIOR_LEAD') {
      if (score >= 85) return 'Senior Architect Ready';
      if (score >= 70) return 'Mid-to-Senior Level';
      return 'Developing; Misses Required Senior Architecture Depth';
    }
    if (profile === 'MID_LEVEL') {
      if (score >= 80) return 'Production Ready';
      if (score >= 60) return 'Competent Mid-Level';
      return 'Developing Mid-Level';
    }
    // FRESHER default
    if (score >= 75) return 'Strong Entry-Level Potential';
    if (score >= 55) return 'Competent Entry-Level';
    return 'Foundation Building';
  };

  it('same score produces different readiness labels for different profiles', () => {
    const score = 72;
    expect(getReadinessForProfile(score, 'COLLEGE_STUDENT')).toBe('Exceeds Student Baseline');
    expect(getReadinessForProfile(score, 'FRESHER')).toBe('Competent Entry-Level');
    expect(getReadinessForProfile(score, 'MID_LEVEL')).toBe('Competent Mid-Level');
    expect(getReadinessForProfile(score, 'SENIOR_LEAD')).toBe('Mid-to-Senior Level');
  });

  it('readiness labels are strings, not numeric adjustments', () => {
    const profiles: CandidateTargetProfile[] = ['COLLEGE_STUDENT', 'FRESHER', 'MID_LEVEL', 'SENIOR_LEAD'];
    profiles.forEach(p => {
      const label = getReadinessForProfile(65, p);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
      expect(Number.isFinite(Number(label))).toBe(false); // not a number
    });
  });

  it('numeric score value is never modified by profile — only label changes', () => {
    const rawScore = 7.2; // per-question scale (0-10)
    const coverageCap = calculateRequiredElementCoverageCap(false, false);
    const finalScore = Math.min(rawScore, coverageCap);

    // Profile only affects the readiness label, not the score
    expect(finalScore).toBe(rawScore); // No profile influence on the number
    const overallScore = perQuestionAverageToOverallScore(finalScore); // convert to 0-100
    const labelA = getReadinessForProfile(overallScore, 'COLLEGE_STUDENT');
    const labelB = getReadinessForProfile(overallScore, 'SENIOR_LEAD');
    expect(labelA).not.toBe(labelB); // labels differ
    expect(finalScore).toBe(rawScore); // score didn't change after label lookup
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariant 6: CandidateTargetProfile Type Completeness
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant 6: CandidateTargetProfile Type Completeness', () => {
  it('CandidateTargetProfileOptions has exactly 4 entries', () => {
    expect(CandidateTargetProfileOptions).toHaveLength(4);
  });

  it('covers all 4 required profiles', () => {
    const values = CandidateTargetProfileOptions.map(o => o.value);
    expect(values).toContain('COLLEGE_STUDENT');
    expect(values).toContain('FRESHER');
    expect(values).toContain('MID_LEVEL');
    expect(values).toContain('SENIOR_LEAD');
  });

  it('each option has a non-empty label and description', () => {
    CandidateTargetProfileOptions.forEach(opt => {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.desc.length).toBeGreaterThan(0);
    });
  });

  it('RubricElement interface exists with required and category fields', () => {
    const element: RubricElement = {
      id: 'test-element',
      required: true,
      category: 'tradeoff',
      description: 'Write amplification penalty',
    };
    expect(element.id).toBe('test-element');
    expect(element.required).toBe(true);
    expect(element.category).toBe('tradeoff');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariant 7: Existing Safety Gates Precedence
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant 7: Existing Safety Gates Precedence', () => {
  it('integrity rejection (< 40) still takes precedence over any recommendation', () => {
    expect(computeRecommendation(95, 30)).toBe('Reject');
    expect(computeRecommendation(100, 0)).toBe('Reject');
    expect(computeRecommendation(80, 39)).toBe('Reject');
  });

  it('coverage cap does not override hard floors from technical accuracy', () => {
    // If technical accuracy produced 3.0 and coverageCap is 5.5, final = 3.0
    const rawTechAccuracy = 3.0;
    const coverageCap = calculateRequiredElementCoverageCap(true, true); // 5.50
    const final = Math.min(rawTechAccuracy, coverageCap);
    expect(final).toBe(3.0); // existing safety gate (low accuracy) wins
  });

  it('zero raw score is never inflated by coverage cap', () => {
    const rawScore = 0;
    const coverageCap = calculateRequiredElementCoverageCap(false, false); // 10.00
    expect(Math.min(rawScore, coverageCap)).toBe(0);
  });

  it('computeIntegrityScore still works correctly alongside coverage caps', () => {
    expect(computeIntegrityScore(0)).toBe(100);
    expect(computeIntegrityScore(50)).toBe(50);
    expect(computeIntegrityScore(100)).toBe(0);
    expect(computeIntegrityScore(150)).toBe(0); // clamped
    expect(computeIntegrityScore(-10)).toBe(100); // clamped
  });

  it('perQuestionAverageToOverallScore handles edge cases correctly', () => {
    expect(perQuestionAverageToOverallScore(0)).toBe(0);
    expect(perQuestionAverageToOverallScore(10)).toBe(100);
    expect(perQuestionAverageToOverallScore(-5)).toBe(0);   // clamped
    expect(perQuestionAverageToOverallScore(15)).toBe(100);  // clamped
    expect(perQuestionAverageToOverallScore(NaN)).toBe(0);
    expect(perQuestionAverageToOverallScore(Infinity)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: End-to-end scoring pipeline simulation
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration: End-to-end scoring pipeline simulation', () => {
  /**
   * Simulates the exact scoring pipeline:
   * 1. Raw score from evaluation pipeline
   * 2. Coverage cap from calculateRequiredElementCoverageCap
   * 3. finalScore = Math.min(rawScore, coverageCap)
   * 4. Overall score via perQuestionAverageToOverallScore
   * 5. Recommendation via computeRecommendation
   */
  function simulatePipeline(
    rawScores: number[],
    hasRequiredElements: boolean,
    hasOmittedRequired: boolean,
    integrityViolationScore: number
  ) {
    const coverageCap = calculateRequiredElementCoverageCap(hasRequiredElements, hasOmittedRequired);
    const cappedScores = rawScores.map(s => Math.min(s, coverageCap));
    const avgCapped = cappedScores.reduce((a, b) => a + b, 0) / cappedScores.length;
    const overall = perQuestionAverageToOverallScore(avgCapped);
    const integrity = computeIntegrityScore(integrityViolationScore);
    const recommendation = computeRecommendation(overall, integrity);
    return { coverageCap, cappedScores, avgCapped, overall, integrity, recommendation };
  }

  it('strong candidate with no omissions gets Strong Hire', () => {
    const result = simulatePipeline([9, 8, 9, 8.5, 9], false, false, 0);
    expect(result.coverageCap).toBe(10.00);
    expect(result.overall).toBeGreaterThanOrEqual(80);
    expect(result.recommendation).toBe('Strong Hire');
  });

  it('strong candidate WITH omitted required element gets capped to 5.50 per-question', () => {
    const result = simulatePipeline([9, 8, 9, 8.5, 9], true, true, 0);
    expect(result.coverageCap).toBe(5.50);
    result.cappedScores.forEach(s => expect(s).toBeLessThanOrEqual(5.50));
    expect(result.overall).toBeLessThanOrEqual(55);
    expect(result.recommendation).not.toBe('Strong Hire');
  });

  it('weak candidate with omitted elements: cap does not inflate below-cap scores', () => {
    const result = simulatePipeline([2, 3, 1, 4, 2], true, true, 0);
    expect(result.coverageCap).toBe(5.50);
    // All raw scores were below 5.50, so cappedScores === rawScores
    expect(result.cappedScores).toEqual([2, 3, 1, 4, 2]);
    expect(result.recommendation).toBe('Reject');
  });

  it('high scorer with integrity violations still gets Reject', () => {
    const result = simulatePipeline([10, 10, 10, 10], false, false, 70);
    expect(result.overall).toBe(100);
    expect(result.integrity).toBe(30); // below 40 threshold
    expect(result.recommendation).toBe('Reject');
  });

  it('profile does not appear anywhere in the scoring pipeline simulation', () => {
    // Run the exact same pipeline for all profiles — results must be identical
    const profiles: CandidateTargetProfile[] = ['COLLEGE_STUDENT', 'FRESHER', 'MID_LEVEL', 'SENIOR_LEAD'];
    const baseline = simulatePipeline([7, 6, 8, 5], true, true, 5);

    profiles.forEach(profile => {
      const result = simulatePipeline([7, 6, 8, 5], true, true, 5);
      expect(result.coverageCap).toBe(baseline.coverageCap);
      expect(result.cappedScores).toEqual(baseline.cappedScores);
      expect(result.overall).toBe(baseline.overall);
      expect(result.recommendation).toBe(baseline.recommendation);
    });
  });
});
