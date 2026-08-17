import { describe, it, expect } from 'vitest';
import { resolveCanonicalOverallScore, normalizeScore } from '../src/Core/utils/sessionStatusResolver';

describe('Canonical Overall Score Resolver', () => {
  it('should extract flat overall_score', () => {
    expect(resolveCanonicalOverallScore({ overall_score: 85 })).toBe(85);
  });

  it('should extract flat overallScore or total_score', () => {
    expect(resolveCanonicalOverallScore({ total_score: 92 })).toBe(92);
  });

  it('should extract nested evaluation_logic.overallScores.trustAdjustedScore', () => {
    const session = {
      evaluation_logic: {
        overallScores: {
          trustAdjustedScore: 88,
          knowledgeScore: 95
        }
      }
    };
    expect(resolveCanonicalOverallScore(session)).toBe(88);
  });

  it('should preserve zero (0) as a valid score and NOT fall back', () => {
    const session = {
      overall_score: 0,
      evaluation_logic: {
        overallScores: { trustAdjustedScore: 75 }
      }
    };
    expect(resolveCanonicalOverallScore(session)).toBe(0);
  });

  it('should return null when no score is present, and NOT substitute knowledgeScore or sub-scores', () => {
    const session = {
      evaluation_logic: {
        overallScores: {
          knowledgeScore: 90,
          communicationScore: 80
        }
      }
    };
    expect(resolveCanonicalOverallScore(session)).toBeNull();
  });

  it('should parse valid string scores and round floats properly', () => {
    expect(resolveCanonicalOverallScore({ overall_score: "78.4" })).toBe(78);
    expect(resolveCanonicalOverallScore({ overall_score: "78.6" })).toBe(79);
  });

  it('should return null for invalid numeric strings or NaN', () => {
    expect(resolveCanonicalOverallScore({ overall_score: "not-a-number" })).toBeNull();
    expect(resolveCanonicalOverallScore({ overall_score: NaN })).toBeNull();
  });
});
