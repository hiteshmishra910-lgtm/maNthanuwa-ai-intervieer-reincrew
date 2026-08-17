import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationDispatcher } from '../src/Evaluation/dispatch/EvaluationDispatcher';
import { LocalEvaluationStrategy } from '../src/Evaluation/engines/LocalEvaluationStrategy';
import { InteractiveEvaluationStrategy } from '../src/Evaluation/engines/InteractiveEvaluationStrategy';
import { BatchEvaluationStrategy } from '../src/Evaluation/engines/BatchEvaluationStrategy';
import { EvaluationMode, Question } from '../types';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { evaluationQueue } from '../src/Evaluation/dispatch/EvaluationQueue';
import * as apiService from '../src/Core/api/apiService';
import { SupabaseService } from '../src/Core/database/supabaseService';

/**
 * Session identifiers used in these tests must be valid UUIDs.
 *
 * `finalizeInterview` writes session lifecycle rows (updateSession, logEvaluationLifecycle) keyed
 * on `interview_sessions.id`, which is a uuid column. A readable placeholder such as
 * 'hybrid_123' is rejected by Postgres with `22P02 invalid input syntax for type uuid`, which
 * fails the test for a database-contract reason that has nothing to do with the routing
 * behaviour under test.
 */
const HYBRID_SESSION_ID = '123e4567-e89b-12d3-a456-426614174000';

// Mock the network calls in apiService to prevent actual LLM usage during tests
vi.mock('../src/Core/api/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/Core/api/apiService')>();
  return {
    ...actual,
    submitAnswer: vi.fn(),
  };
});

// Helper to create a dummy context
const createContext = (mode: string): EvaluationContext => ({
  session: { id: 'test_session', mode },
  candidate: { name: 'Test', role: 'CSE' },
  question: { id: 'q1', question: 'Test?', evaluationGuide: [] } as Question,
  response: 'A closure is a function bundled together with references to its surrounding lexical environment, allowing access to outer variables.',
  evaluationProfile: { id: 'default', version_number: 1 } as any,
});

describe('Milestone 4.5: Evaluation Routing & Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Strategy Selection', () => {
    it('Dispatcher should route LOCAL mode to LocalEvaluationStrategy', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();
      const context = createContext(EvaluationMode.LOCAL);
      
      const localSpy = vi.spyOn(LocalEvaluationStrategy.getInstance(), 'evaluateQuestion');
      const interactiveSpy = vi.spyOn(InteractiveEvaluationStrategy.getInstance(), 'evaluateQuestion');
      const batchSpy = vi.spyOn(BatchEvaluationStrategy.getInstance(), 'evaluateQuestion');

      await dispatcher.evaluateQuestion(context);

      expect(localSpy).toHaveBeenCalled();
      expect(interactiveSpy).not.toHaveBeenCalled();
      expect(batchSpy).not.toHaveBeenCalled();
    });

    it('Dispatcher should route API mode to InteractiveEvaluationStrategy', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();
      const context = createContext(EvaluationMode.API);
      
      const localSpy = vi.spyOn(LocalEvaluationStrategy.getInstance(), 'evaluateQuestion');
      const interactiveSpy = vi.spyOn(InteractiveEvaluationStrategy.getInstance(), 'evaluateQuestion');
      const batchSpy = vi.spyOn(BatchEvaluationStrategy.getInstance(), 'evaluateQuestion');

      // Mock LLM answer to prevent failure
      (apiService.submitAnswer as any).mockResolvedValue({
        evaluation: { 
          analysis: {},
          relevanceScore: 0.9,
          questionSatisfactionScore: 8
        }
      });

      await dispatcher.evaluateQuestion(context);

      expect(localSpy).not.toHaveBeenCalled();
      expect(interactiveSpy).toHaveBeenCalled();
      expect(batchSpy).not.toHaveBeenCalled();
    });

    it('Dispatcher should route HYBRID mode to BatchEvaluationStrategy', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();
      const context = createContext(EvaluationMode.HYBRID);
      
      const localSpy = vi.spyOn(LocalEvaluationStrategy.getInstance(), 'evaluateQuestion');
      const interactiveSpy = vi.spyOn(InteractiveEvaluationStrategy.getInstance(), 'evaluateQuestion');
      const batchSpy = vi.spyOn(BatchEvaluationStrategy.getInstance(), 'evaluateQuestion');

      await dispatcher.evaluateQuestion(context);

      // Batch delegates directly to Local under the hood during the interview
      expect(batchSpy).toHaveBeenCalled();
      expect(localSpy).toHaveBeenCalled(); // Delegated call
      expect(interactiveSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. API Mode & Immutability', () => {
    it('InteractiveEvaluationStrategy should call submitAnswer (LLM) synchronously and freeze result', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();
      const context = createContext(EvaluationMode.API);

      (apiService.submitAnswer as any).mockResolvedValue({
        evaluation: {
          answerType: 'full_explanation',
          analysis: { technicalAccuracy: 8, understanding: 8 },
          matchedKeyPoints: ['k1', 'k2'],
          relevanceScore: 0.9,
          questionSatisfactionScore: 8
        }
      });

      const result = await dispatcher.evaluateQuestion(context);

      // Verify LLM was hit exactly once
      expect(apiService.submitAnswer).toHaveBeenCalledTimes(1);

      // Verify the result correctly mapped from LLM
      expect(result.technicalAccuracyScore).toBe(8);
      expect(result.evaluationMetadata?.mode).toBe('Interactive');

      // Verify immutability (Object.isFrozen)
      expect(Object.isFrozen(result)).toBe(true);

      // Ensure TypeScript enforces immutability. If we do the below, TS throws a compile error:
      // result.contentScore = 10;
      // At runtime, mutating a frozen object in strict mode throws TypeError
      expect(() => {
        (result as any).contentScore = 10;
      }).toThrowError(TypeError);
    });
  });

  describe('3. Hybrid Mode (Queueing)', () => {
    it('BatchEvaluationStrategy uses zero-latency local fallback during evaluateQuestion', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();
      const context = createContext(EvaluationMode.HYBRID);

      await dispatcher.evaluateQuestion(context);

      // In hybrid mode, evaluateQuestion should NOT call LLM.
      expect(apiService.submitAnswer).not.toHaveBeenCalled();
    });

    it('Dispatcher queues the session for full background LLM evaluation at finalizeInterview', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();

      const queueSpy = vi.spyOn(evaluationQueue, 'enqueue').mockImplementation(async () => {});
      vi.spyOn(SupabaseService, 'logEvaluationLifecycle').mockImplementation(async () => {});
      vi.spyOn(SupabaseService, 'updateSession').mockImplementation(async () => ({}) as any);

      // Must be a syntactically valid UUID. finalizeInterview writes session lifecycle rows via
      // updateSession/logEvaluationLifecycle, and interview_sessions.id is a uuid column, so a
      // placeholder like 'hybrid_123' made Postgres reject the write with
      // `22P02 invalid input syntax for type uuid` — failing the test for a reason unrelated to
      // the queueing behaviour it exists to verify.
      const masterReport = await dispatcher.finalizeInterview(HYBRID_SESSION_ID, [], {}, EvaluationMode.HYBRID);

      // Verify it was put into the queue
      expect(queueSpy).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: HYBRID_SESSION_ID,
        history: [],
      }));

      // Verify the immediate return report indicates processing state
      expect(masterReport.completionState).toBe('QUEUED');
    });
  });

  describe('4. Local Mode', () => {
    it('LocalEvaluationStrategy makes zero LLM calls', async () => {
      const dispatcher = EvaluationDispatcher.getInstance();
      const context = createContext(EvaluationMode.LOCAL);
      
      await dispatcher.evaluateQuestion(context);

      // Verify absolutely zero network calls occurred
      expect(apiService.submitAnswer).not.toHaveBeenCalled();
    });
  });
});
