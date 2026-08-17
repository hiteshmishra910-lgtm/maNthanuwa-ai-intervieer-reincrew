import { describe, it, expect, vi } from 'vitest';
import { InteractiveEvaluationStrategy } from '../src/Evaluation/engines/InteractiveEvaluationStrategy';
import { LocalEvaluationStrategy } from '../src/Evaluation/engines/LocalEvaluationStrategy';
import * as apiService from '../src/Core/api/apiService';

describe('API Failover and Provenance Contract', () => {
  it('should tag failover results with evaluationSource: API_FALLBACK_LOCAL on HTTP 429 error', async () => {
    vi.spyOn(apiService, 'submitAnswer').mockRejectedValueOnce(
      new Error('OpenRouter daily free-tier request cap reached (429 Rate limit)')
    );

    const context: any = {
      session: { id: 'test_session_429', mode: 'API' },
      candidate: { name: 'Test Candidate', email: 'test@example.com', role: 'CSE' },
      question: { id: 'q1', question: 'What is indexing in SQL?', ideal_answer: 'B-tree index speeds up queries' },
      response: 'Indexing helps speed up database queries by creating structured lookup trees.',
      configuration: { mode: 'API' }
    };

    const result = await InteractiveEvaluationStrategy.getInstance().evaluateQuestion(context);

    expect(result).toBeDefined();
    expect((result as any).evaluationMetadata?.evaluationSource).toBe('API_FALLBACK_LOCAL');
    expect((result as any).evaluationMetadata?.fallbackReason).toBe('RATE_LIMIT');
    expect((result as any).technicalAccuracyScore).toBeGreaterThan(0);
  });

  it('should tag failover results with evaluationSource: API_FALLBACK_LOCAL on 12s Timeout', async () => {
    vi.spyOn(apiService, 'submitAnswer').mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 15000))
    );

    const context: any = {
      session: { id: 'test_session_timeout', mode: 'API' },
      candidate: { name: 'Test Candidate', email: 'test@example.com', role: 'CSE' },
      question: { id: 'q2', question: 'What is transaction ACID?', ideal_answer: 'Atomicity, Consistency, Isolation, Durability' },
      response: 'ACID stands for Atomicity, Consistency, Isolation, and Durability.',
      configuration: { mode: 'API' }
    };

    const result = await InteractiveEvaluationStrategy.getInstance().evaluateQuestion(context);

    expect(result).toBeDefined();
    expect((result as any).evaluationMetadata?.evaluationSource).toBe('API_FALLBACK_LOCAL');
    expect((result as any).evaluationMetadata?.fallbackReason).toBe('TIMEOUT');
  }, 25000);

  it('should rethrow programming bugs (e.g. TypeError) instead of swallowing them into local fallback', async () => {
    vi.spyOn(apiService, 'submitAnswer').mockRejectedValueOnce(
      new TypeError('Cannot read property undefined of null in rubric parser')
    );

    const context: any = {
      session: { id: 'test_session_bug', mode: 'API' },
      candidate: { name: 'Test Candidate', email: 'test@example.com', role: 'CSE' },
      question: { id: 'q3', question: 'Explain recursion', ideal_answer: 'Function calling itself' },
      response: 'Recursion is when a function calls itself.',
      configuration: { mode: 'API' }
    };

    await expect(
      InteractiveEvaluationStrategy.getInstance().evaluateQuestion(context)
    ).rejects.toThrow(TypeError);
  });
});
