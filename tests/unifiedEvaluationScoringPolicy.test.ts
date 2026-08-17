import { describe, it, expect } from 'vitest';
import { ScoreAggregator } from '../src/Evaluation/pipeline/ScoreAggregator';
import { ExpertEvaluator } from '../src/Evaluation/expert/ExpertEvaluator';
import {
  applyUnifiedScoringPolicy,
  classifyAnswerSubstance,
  getLengthTier,
} from '../shared/evaluationScoringPolicy';
import { Question } from '../types';

describe('Unified Evaluation Scoring Policy & Strict Rigor', () => {
  describe('Specific User Benchmark Cases', () => {
    it('forces "neural networks are the" fragment to score <= 1.0/10 overall across technical dimensions', () => {
      const answer = 'neural networks are the';
      const result = applyUnifiedScoringPolicy(
        {
          technicalAccuracy: 8.0,
          conceptUnderstanding: 8.0,
          reasoning: 8.0,
          communication: 10.0,
          confidence: 8.0,
        },
        answer,
        0,
        false,
        8.0
      );

      expect(result.scores.technicalAccuracy).toBeLessThanOrEqual(0.5);
      expect(result.scores.conceptUnderstanding).toBeLessThanOrEqual(0.5);
      expect(result.scores.reasoning).toBeLessThanOrEqual(0.0);
      expect(result.scores.communication).toBeLessThanOrEqual(0.5);
      expect(result.scores.confidence).toBeLessThanOrEqual(1.0);
    });

    it('forces vague 1-sentence behavioral answer ("I helped a teammate...") to score <= 3.0/10 overall', () => {
      const answer = 'I helped a teammate when she was dealing with assignment';
      const result = applyUnifiedScoringPolicy(
        {
          technicalAccuracy: 7.5,
          conceptUnderstanding: 7.5,
          reasoning: 6.0,
          communication: 9.0,
          confidence: 8.0,
        },
        answer,
        1,
        true,
        7.5
      );

      expect(result.scores.technicalAccuracy).toBeLessThanOrEqual(3.0);
      expect(result.scores.conceptUnderstanding).toBeLessThanOrEqual(3.0);
      expect(result.scores.communication).toBeLessThanOrEqual(5.0); // Score gravity engages
    });

    it('allows well-formed concise answers to achieve decent credit without unfair penalty', () => {
      const conciseAnswer =
        'Closure is a function bundled together with references to its surrounding state or lexical environment.';
      const result = applyUnifiedScoringPolicy(
        {
          technicalAccuracy: 9.0,
          conceptUnderstanding: 8.5,
          reasoning: 7.0,
          communication: 8.0,
          confidence: 7.5,
        },
        conciseAnswer,
        2,
        false,
        9.0
      );

      // Word count is ~14 words (LIMITED tier), so cap on accuracy is 5.0 for limited evidence
      // but higher than fragments (0.5) or vague statements
      expect(result.scores.technicalAccuracy).toBeGreaterThan(3.0);
    });
  });

  describe('Monotonic Evidence & Quality Progression', () => {
    it('maintains monotonic score ordering: Fragment < Vague < Concise-Correct < Detailed', () => {
      const sampleQuestion: Question = {
        id: 101,
        question: 'What is a closure in JavaScript?',
        type: 'Core',
        keyConcepts: [
          { id: 'lexical_scope', concept: 'Lexical Scope', importance: 'high' },
          { id: 'inner_function', concept: 'Inner Function', importance: 'high' },
        ],
      };

      const fragment = 'closure is a';
      const vague = 'It helps to keep variables in memory and run functions later.';
      const conciseCorrect =
        'A closure is a function that retains access to variables from its outer lexical scope even after that outer function has executed.';
      const detailed =
        'A closure is created whenever a function is defined inside another function. The inner function retains access to the outer function variables via lexical scope link, enabling data encapsulation, private state, and callbacks.';

      const resFragment = applyUnifiedScoringPolicy(
        { technicalAccuracy: 2.0, conceptUnderstanding: 1.0, reasoning: 0.5, communication: 3.0, confidence: 3.0 },
        fragment, 0, false, 2.0
      );
      const resVague = applyUnifiedScoringPolicy(
        { technicalAccuracy: 4.0, conceptUnderstanding: 3.5, reasoning: 3.0, communication: 5.0, confidence: 4.0 },
        vague, 1, false, 4.0
      );
      const resConcise = applyUnifiedScoringPolicy(
        { technicalAccuracy: 7.0, conceptUnderstanding: 6.5, reasoning: 6.0, communication: 7.5, confidence: 7.0 },
        conciseCorrect, 2, false, 7.0
      );
      const resDetailed = applyUnifiedScoringPolicy(
        { technicalAccuracy: 9.5, conceptUnderstanding: 9.0, reasoning: 9.0, communication: 9.0, confidence: 9.0 },
        detailed, 3, false, 9.5
      );

      expect(resFragment.scores.technicalAccuracy).toBeLessThan(resVague.scores.technicalAccuracy);
      expect(resVague.scores.technicalAccuracy).toBeLessThan(resConcise.scores.technicalAccuracy);
      expect(resConcise.scores.technicalAccuracy).toBeLessThan(resDetailed.scores.technicalAccuracy);
    });
  });
});
