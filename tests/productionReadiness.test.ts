import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationDispatcher } from '../src/Evaluation/dispatch/EvaluationDispatcher';
import { LocalEvaluationStrategy } from '../src/Evaluation/engines/LocalEvaluationStrategy';
import { InteractiveEvaluationStrategy } from '../src/Evaluation/engines/InteractiveEvaluationStrategy';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { EvaluationMode, Question } from '../types';
import * as apiService from '../src/Core/api/apiService';
import { evaluationQueue } from '../src/Evaluation/dispatch/EvaluationQueue';
import { SupabaseService } from '../src/Core/database/supabaseService';

/**
 * Must be a valid UUID — `interview_sessions.id` is a uuid column and `finalizeInterview`
 * persists lifecycle rows against it. See the matching note in dispatcherAndStrategies.test.ts.
 */
const HYBRID_SESSION_ID = '123e4567-e89b-12d3-a456-426614174000';

vi.mock('../src/Core/api/apiService', () => ({
  submitAnswer: vi.fn(),
}));

vi.mock('../src/Evaluation/dispatch/EvaluationQueue', () => {
  return {
    evaluationQueue: {
      enqueue: vi.fn().mockResolvedValue(undefined),
      processQueue: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe('Phase 2: Production Readiness Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockQuestion: Question = {
    id: 'q-1',
    question: 'What is a closure?',
    questionType: 'Definition',
    evaluationGuide: ['Scope', 'Functions'],
  };

  const getContext = (mode: EvaluationMode, response: string): EvaluationContext => ({
    session: { id: 'test-session', mode },
    candidate: { name: 'Test User', role: 'Candidate' },
    question: mockQuestion,
    response,
    evaluationProfile: {
      id: 'prof-1',
      version: 'v1',
      name: 'Default Profile',
      description: '',
      weights: { Critical: 50, Important: 30, NiceToHave: 20 },
      rubricVersion: 'v1',
    } as any,
  });

  describe('Local Mode', () => {
    it('should complete without external calls and produce deterministic scores', async () => {
      const context = getContext(EvaluationMode.LOCAL, 'A closure is a function that remembers its outer variables.');
      const strategy = LocalEvaluationStrategy.getInstance();
      
      const result1 = await strategy.evaluateQuestion(context);
      const result2 = await strategy.evaluateQuestion(context);

      expect(apiService.submitAnswer).toHaveBeenCalledTimes(0);
      
      const res1Clean = { ...result1, timestamp: undefined, developerTrace: undefined, evaluationMetadata: { ...result1.evaluationMetadata, latencyMs: 0, timestamp: undefined } };
      const res2Clean = { ...result2, timestamp: undefined, developerTrace: undefined, evaluationMetadata: { ...result2.evaluationMetadata, latencyMs: 0, timestamp: undefined } };
      
      expect(res1Clean).toEqual(res2Clean);
    });
  });

  describe('Interactive Mode', () => {
    it('should validate API failure error handling without silent local fallback', async () => {
      (apiService.submitAnswer as any).mockRejectedValueOnce(new Error('Provider timeout'));

      const context = getContext(EvaluationMode.API, 'Closure remembers scope');
      const strategy = InteractiveEvaluationStrategy.getInstance();

      const result = await strategy.evaluateQuestion(context);

      expect(apiService.submitAnswer).toHaveBeenCalledTimes(1);
      expect((result as any).isApiError).toBe(true);
      expect((result as any).status).toBe('API_UNAVAILABLE');
    });
  });

  describe('Hybrid Mode', () => {
    it('should queue the job successfully on finalizeInterview', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();
      vi.spyOn(SupabaseService, 'logEvaluationLifecycle').mockImplementation(async () => {});
      vi.spyOn(SupabaseService, 'updateSession').mockImplementation(async () => ({}) as any);

      // Valid UUID required: finalizeInterview persists lifecycle rows keyed on
      // interview_sessions.id, a uuid column. 'hybrid-session' produced
      // `22P02 invalid input syntax for type uuid` and failed the test for a reason unrelated to
      // the queueing behaviour under test.
      await dispatcher.finalizeInterview(HYBRID_SESSION_ID, [], undefined, EvaluationMode.HYBRID);

      expect(evaluationQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(evaluationQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: HYBRID_SESSION_ID
      }));
    });
  });
});
