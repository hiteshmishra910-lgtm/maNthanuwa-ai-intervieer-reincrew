import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterClient } from '../src/Core/ai/openRouterClient';
import { InteractiveEvaluationStrategy } from '../src/Evaluation/engines/InteractiveEvaluationStrategy';
import * as apiService from '../src/Core/api/apiService';
import { EvaluationMode } from '../types';

vi.mock('../src/Core/logging/errorLogService', () => ({
  ErrorLogService: {
    logError: vi.fn(),
    logEvent: vi.fn()
  }
}));

describe('API Rate Limit & Quota Failover Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('OpenRouterClient Failover & RateLimit Handling', () => {
    it('should route 429 rate limit errors to fallback mechanism', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('openrouter.ai')) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              error: {
                message: 'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day'
              }
            })
          } as any;
        }
        // Fallback edge function mock response
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"score": 8, "feedback": "Fallback evaluation successful"}' } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 }
          })
        } as any;
      });

      const result = await OpenRouterClient.generate<{ choices: any[] }>({
        prompt: 'Test prompt',
        purpose: 'eval'
      });

      expect(result.success).toBe(true);
      expect((result as any).provider).toBe('ai-fallback');
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should NOT bypass Edge Function when functionName is ai-fallback even if local VITE_OPENROUTER_API_KEY is present', async () => {
      const fetchCalls: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        fetchCalls.push(urlStr);
        if (urlStr.includes('openrouter.ai') || urlStr.includes('googleapis.com')) {
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: 'Rate limit exceeded' } })
          } as any;
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Fallback response' } }]
          })
        } as any;
      });

      await OpenRouterClient.generate({ prompt: 'Test', purpose: 'eval' });

      // Check that at least one call went to Supabase functions / ai-fallback
      const fallbackCall = fetchCalls.find(u => u.includes('ai-fallback'));
      expect(fallbackCall).toBeDefined();
    });

    it('should treat 429 rate limit errors as non-retryable against the primary endpoint', async () => {
      let primaryCallCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        if (String(url).includes('openrouter.ai')) {
          primaryCallCount++;
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: 'Rate limit exceeded: free-models-per-day' } })
          } as any;
        }
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Fallback down' } })
        } as any;
      });

      const result = await OpenRouterClient.generate({ prompt: 'Test', purpose: 'eval' });

      expect(result.success).toBe(false);
      // Should attempt primary exactly once without burning extra daily quota retries
      expect(primaryCallCount).toBe(1);
    });
  });

  describe('InteractiveEvaluationStrategy Quota Classification', () => {
    it('should surface API_QUOTA_EXHAUSTED status and operatorReason on 429 free-models-per-day failure', async () => {
      vi.spyOn(apiService, 'submitAnswer').mockRejectedValueOnce(
        new Error('Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day')
      );

      const context: any = {
        session: { id: 'sess-quota-test', mode: EvaluationMode.API },
        question: { id: 'q1', question: 'What is CLOSURE?' },
        response: 'Closure retains access to outer variables.'
      };

      const strategy = InteractiveEvaluationStrategy.getInstance();
      const result: any = await strategy.evaluateQuestion(context);

      expect(result.isApiError).toBe(true);
      expect(result.status).toBe('API_QUOTA_EXHAUSTED');
      expect(result.evaluationMetadata.errorCategory).toBe('API_QUOTA_EXHAUSTED');
      expect(result.evaluationMetadata.operatorReason).toContain('OpenRouter daily free-tier request cap reached');
      expect(result.userMessage).toContain('AI evaluation is temporarily unavailable');
    });

    it('should leak no sensitive provider key or credit details in candidate userMessage', async () => {
      vi.spyOn(apiService, 'submitAnswer').mockRejectedValueOnce(
        new Error('429 Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day')
      );

      const context: any = {
        session: { id: 'sess-quota-leak-test', mode: EvaluationMode.API },
        question: { id: 'q2', question: 'Explain promises' },
        response: 'Promises represent async values.'
      };

      const strategy = InteractiveEvaluationStrategy.getInstance();
      const result: any = await strategy.evaluateQuestion(context);

      expect(result.userMessage).not.toContain('credits');
      expect(result.userMessage).not.toContain('openrouter');
      expect(result.userMessage).not.toContain('429');
      expect(result.userMessage).not.toContain('free-models-per-day');
    });
  });
});
