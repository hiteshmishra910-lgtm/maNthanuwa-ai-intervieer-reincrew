import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterClient } from '../src/Core/ai/openRouterClient';
import { ApiTierManager } from '../src/Core/ai/apiTierManager';

vi.mock('../src/Core/logging/errorLogService', () => ({
  ErrorLogService: {
    logError: vi.fn(),
    logEvent: vi.fn(),
    logWarning: vi.fn(),
    logInfo: vi.fn()
  }
}));

const PAID_MODEL = 'gemini-2.0-flash';

/**
 * Mocks fetch so that:
 * - All free-tier calls (edge function without tier=paid) return 429 quota-exhausted
 * - Paid-tier edge function calls (body.tier === 'paid') return success
 *
 * No direct paid-key fetch is simulated — paid calls are always server-side only.
 */
function mockPaidFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
    const u = String(url);
    let body: any = {};
    try {
      body = init?.body ? JSON.parse(init.body) : {};
    } catch {
      // non-JSON body
    }

    // Paid tier via edge function (body carries tier=paid) — server handles the key
    if (u.includes('/functions/v1/') && body.tier === 'paid') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"ok":"paid-edge"}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
          model: PAID_MODEL,
          telemetry: { provider: 'openrouter-paid', model: PAID_MODEL, tier: 'paid' }
        })
      } as any;
    }

    // Everything on the free tier fails with 429 quota exhaustion
    return {
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: 'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day' }
      })
    } as any;
  });
}

describe('API Tier Manager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ApiTierManager.resetForTests();
  });

  afterEach(() => {
    delete process.env.VITE_PAID_TIER_ENABLED;
    delete process.env.VITE_PAID_MODEL;
  });

  describe('reason classification', () => {
    it('classifies quota exhaustion messages as QUOTA_EXHAUSTED', () => {
      expect(ApiTierManager.classifyReason('RateLimitError', 'Rate limit exceeded: free-models-per-day.')).toBe('QUOTA_EXHAUSTED');
      expect(ApiTierManager.classifyReason('UnknownError', 'quota exceeded for free tier')).toBe('QUOTA_EXHAUSTED');
    });

    it('classifies plain 429 as RATE_LIMIT', () => {
      expect(ApiTierManager.classifyReason('RateLimitError', '429 Too Many Requests')).toBe('RATE_LIMIT');
      expect(ApiTierManager.classifyReason('RateLimitError', 'Rate limit hit')).toBe('RATE_LIMIT');
    });

    it('classifies timeouts and 5xx correctly', () => {
      expect(ApiTierManager.classifyReason('TimeoutError', 'timed out after 25000ms')).toBe('TIMEOUT');
      expect(ApiTierManager.classifyReason('ProviderUnavailableError', 'HTTP 503 service unavailable')).toBe('PROVIDER_UNAVAILABLE');
    });

    it('marks rate limit / provider / timeout errors as fallback-worthy but not generic failures', () => {
      expect(ApiTierManager.isFallbackWorthy('RateLimitError')).toBe(true);
      expect(ApiTierManager.isFallbackWorthy('ProviderUnavailableError')).toBe(true);
      expect(ApiTierManager.isFallbackWorthy('TimeoutError')).toBe(true);
      expect(ApiTierManager.isFallbackWorthy('InvalidResponseError')).toBe(false);
      expect(ApiTierManager.isFallbackWorthy('UnknownError')).toBe(false);
    });

    it('marks NetworkError as fallback-worthy', () => {
      expect(ApiTierManager.isFallbackWorthy('NetworkError')).toBe(true);
    });

    it('marks UnknownError with network-like message as fallback-worthy', () => {
      expect(ApiTierManager.isFallbackWorthy('UnknownError', 'Failed to fetch')).toBe(true);
      expect(ApiTierManager.isFallbackWorthy('UnknownError', 'Network error')).toBe(true);
      expect(ApiTierManager.isFallbackWorthy('UnknownError', 'fetch error')).toBe(true);
    });

    it('does not mark UnknownError with non-network message as fallback-worthy', () => {
      expect(ApiTierManager.isFallbackWorthy('UnknownError', 'Something went wrong')).toBe(false);
      expect(ApiTierManager.isFallbackWorthy('UnknownError', '')).toBe(false);
    });
  });

  describe('session latch TTL', () => {
    it('latch expires after TTL and resets to free tier', () => {
      ApiTierManager.latchSessionPaid('sess-ttl-test');
      expect(ApiTierManager.getActiveTier('sess-ttl-test')).toBe('paid');

      // Simulate TTL expiry by backdating the latch timestamp
      // Access private map via any cast for testing
      (ApiTierManager as any).sessionLatchTimestamps.set('sess-ttl-test', Date.now() - 6 * 60 * 1000);
      expect(ApiTierManager.getActiveTier('sess-ttl-test')).toBe('free');
    });

    it('manual unlatch resets to free tier immediately', () => {
      ApiTierManager.latchSessionPaid('sess-unlatch');
      expect(ApiTierManager.getActiveTier('sess-unlatch')).toBe('paid');

      ApiTierManager.unlatchSession('sess-unlatch');
      expect(ApiTierManager.getActiveTier('sess-unlatch')).toBe('free');
    });
  });

  describe('paid tier config', () => {
    it('defaults paid model to gemini-2.0-flash unless configured', () => {
      expect(ApiTierManager.getPaidModel()).toBe('gemini-2.0-flash');
      process.env.VITE_PAID_MODEL = 'openai/gpt-4o-mini';
      expect(ApiTierManager.getPaidModel()).toBe('openai/gpt-4o-mini');
    });
  });
});

describe('OpenRouterClient Free \u2192 Paid fallback (server-side routing)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ApiTierManager.resetForTests();
  });

  afterEach(() => {
    delete process.env.VITE_PAID_MODEL;
  });

  it('automatically switches to paid via edge function when free tier is quota-exhausted', async () => {
    const fetchSpy = mockPaidFetch();

    const result = await OpenRouterClient.generate<{ choices: any[] }>({
      prompt: 'Evaluate this answer',
      purpose: 'eval',
      sessionId: 'sess-paid-switch-1'
    });

    expect(result.success).toBe(true);
    const success = result as any;
    expect(success.tier).toBe('paid');
    // Provider comes from edge function telemetry — no direct client key used
    expect(success.provider).toBe('openrouter-paid');

    // A fallback event was recorded with reason + tier transition
    const events = ApiTierManager.getFallbackEvents();
    expect(events.length).toBe(1);
    expect(events[0].fromTier).toBe('free');
    expect(events[0].toTier).toBe('paid');
    expect(events[0].reason).toBe('QUOTA_EXHAUSTED');
    expect(events[0].paidResult).toBe('success');
    expect(typeof events[0].timestamp).toBe('string');

    // Session is latched so the next question skips the free tier
    expect(ApiTierManager.getActiveTier('sess-paid-switch-1')).toBe('paid');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('latch: a session already on paid goes straight to the paid tier on the next question', async () => {
    mockPaidFetch();

    await OpenRouterClient.generate({ prompt: 'Q1', purpose: 'eval', sessionId: 'sess-paid-latch' });
    expect(ApiTierManager.getActiveTier('sess-paid-latch')).toBe('paid');

    const result = await OpenRouterClient.generate<{ choices: any[] }>({
      prompt: 'Q2',
      purpose: 'eval',
      sessionId: 'sess-paid-latch'
    });

    expect(result.success).toBe(true);
    expect((result as any).tier).toBe('paid');
    // No NEW fallback event for Q2 — the switch already happened on Q1
    expect(ApiTierManager.getFallbackEvents().length).toBe(1);
  });

  it('records a failed switch when the paid tier edge function also fails', async () => {
    // All calls fail with quota message — free and paid both
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded: free-models-per-day' } })
    } as any));

    const result = await OpenRouterClient.generate<{ choices: any[] }>({
      prompt: 'Evaluate this answer',
      purpose: 'eval',
      sessionId: 'sess-paid-broken'
    });

    expect(result.success).toBe(false);
    const events = ApiTierManager.getFallbackEvents();
    expect(events.length).toBe(1);
    expect(events[0].paidResult).toBe('failed');
    expect(events[0].reason).toBe('QUOTA_EXHAUSTED');
  });

  it('does not retry the free tier for a latched session when the paid tier works (no dropped interviews regression)', async () => {
    mockPaidFetch();

    await OpenRouterClient.generate({ prompt: 'Q1', purpose: 'eval', sessionId: 'sess-latched-regression' });

    const second = await OpenRouterClient.generate<{ choices: any[] }>({
      prompt: 'Q2',
      purpose: 'eval',
      sessionId: 'sess-latched-regression'
    });

    expect(second.success).toBe(true);
    expect((second as any).tier).toBe('paid');
  });

  it('triggers paid escalation on network error (TypeError: Failed to fetch)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
      const u = String(url);
      let body: any = {};
      try { body = init?.body ? JSON.parse(init.body) : {}; } catch { /* non-JSON */ }

      // Paid tier via edge function succeeds
      if (u.includes('/functions/v1/') && body.tier === 'paid') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: '{"ok":"paid-edge"}' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
            model: PAID_MODEL,
            telemetry: { provider: 'openrouter-paid', model: PAID_MODEL, tier: 'paid' }
          })
        } as any;
      }

      // All free-tier calls fail with network error
      throw new TypeError('Failed to fetch');
    });

    const result = await OpenRouterClient.generate<{ choices: any[] }>({
      prompt: 'Evaluate this answer',
      purpose: 'eval',
      sessionId: 'sess-network-paid'
    });

    expect(result.success).toBe(true);
    expect((result as any).tier).toBe('paid');

    const events = ApiTierManager.getFallbackEvents();
    expect(events.length).toBe(1);
    expect(events[0].fromTier).toBe('free');
    expect(events[0].toTier).toBe('paid');
    expect(events[0].paidResult).toBe('success');
  });

  it('paid-latched session falls back to free when paid tier fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
      const u = String(url);
      let body: any = {};
      try { body = init?.body ? JSON.parse(init.body) : {}; } catch { /* non-JSON */ }

      // Free tier edge function with preventAutoEscalation succeeds
      if (u.includes('/functions/v1/') && body.preventAutoEscalation === true) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: '{"ok":"free-fallback"}' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
            model: 'openrouter/free',
            telemetry: { provider: 'openrouter', model: 'openrouter/free', tier: 'free' }
          })
        } as any;
      }

      // Paid edge function fails
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal server error' } })
      } as any;
    });

    // Manually latch to paid to simulate prior escalation
    ApiTierManager.latchSessionPaid('sess-paid-fallback-free');

    const result = await OpenRouterClient.generate<{ choices: any[] }>({
      prompt: 'Evaluate this answer',
      purpose: 'eval',
      sessionId: 'sess-paid-fallback-free'
    });

    // Should fall back to free and succeed
    expect(result.success).toBe(true);
  });
});