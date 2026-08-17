import { ErrorLogService } from '../logging/errorLogService';

export type ApiTier = 'free' | 'paid';

export type FallbackReason =
  | 'RATE_LIMIT'
  | 'QUOTA_EXHAUSTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'OTHER';

export interface TierFallbackEvent {
  timestamp: string;
  reason: FallbackReason;
  fromTier: ApiTier;
  toTier: ApiTier;
  paidResult: 'success' | 'failed' | 'skipped';
  provider?: string;
  model?: string;
  sessionId?: string;
  message?: string;
}

const MAX_FALLBACK_EVENTS = 100;
const LATCH_TTL_MS = 5 * 60 * 1000; // 5 minutes — after which the latch expires and free tier is retried

/**
 * Manages the free → paid API tier state for interview evaluation.
 *
 * - Tracks the active tier per interview session so a session that already
 *   escalated to the paid tier goes straight to paid on later questions
 *   (no repeated free-tier timeouts burning latency per question).
 * - Session latches expire after LATCH_TTL_MS so that if free tier recovers,
 *   subsequent questions can retry it instead of burning paid credits.
 * - Records every fallback event with timestamp, reason, and tier transition
 *   for debugging and for Shreya's tier status indicator.
 * - Paid escalation is routed entirely through the Supabase Edge Function.
 *   No paid API key is ever stored or read on the client.
 *   The server holds paid secrets; the client only decides WHEN to escalate.
 */
class ApiTierManagerClass {
  private sessionTiers = new Map<string, ApiTier>();
  private sessionLatchTimestamps = new Map<string, number>();
  private fallbackEvents: TierFallbackEvent[] = [];

  getActiveTier(sessionId?: string): ApiTier {
    if (!sessionId) return 'free';
    const tier = this.sessionTiers.get(sessionId);
    if (!tier) return 'free';
    // Check if the latch has expired
    const latchedAt = this.sessionLatchTimestamps.get(sessionId);
    if (latchedAt && Date.now() - latchedAt > LATCH_TTL_MS) {
      console.log(`[ApiTierManager] Session ${sessionId} latch expired after ${LATCH_TTL_MS / 1000}s. Resetting to free tier.`);
      this.sessionTiers.delete(sessionId);
      this.sessionLatchTimestamps.delete(sessionId);
      return 'free';
    }
    return tier;
  }

  latchSessionPaid(sessionId?: string): void {
    if (sessionId) {
      this.sessionTiers.set(sessionId, 'paid');
      this.sessionLatchTimestamps.set(sessionId, Date.now());
      console.log(`[ApiTierManager] Session ${sessionId} latched to PAID tier.`);
    }
  }

  unlatchSession(sessionId?: string): void {
    if (sessionId) {
      this.sessionTiers.delete(sessionId);
      this.sessionLatchTimestamps.delete(sessionId);
      console.log(`[ApiTierManager] Session ${sessionId} unlatched (reset to free tier).`);
    }
  }

  isFallbackWorthy(errorType: string, message?: string): boolean {
    if (
      errorType === 'RateLimitError' ||
      errorType === 'ProviderUnavailableError' ||
      errorType === 'TimeoutError'
    ) {
      return true;
    }
    // Network errors (TypeError from failed fetch) surface as 'UnknownError'
    // but should still trigger paid escalation.
    if (errorType === 'NetworkError') return true;
    if (errorType === 'UnknownError' && message && /failed to fetch|network|fetch error/i.test(message)) {
      return true;
    }
    return false;
  }

  classifyReason(errorType: string, message: string): FallbackReason {
    const m = message || '';
    if (/free-models-per-day|quota exceeded|daily.*limit|quota exhausted/i.test(m)) {
      return 'QUOTA_EXHAUSTED';
    }
    if (errorType === 'RateLimitError' || /429|rate limit/i.test(m)) return 'RATE_LIMIT';
    if (errorType === 'TimeoutError' || /timeout|abort/i.test(m)) return 'TIMEOUT';
    if (errorType === 'ProviderUnavailableError' || /5\d\d/i.test(m)) return 'PROVIDER_UNAVAILABLE';
    if (/network|fetch|failed to fetch/i.test(m)) return 'NETWORK';
    return 'OTHER';
  }

  recordFallback(event: TierFallbackEvent): void {
    this.fallbackEvents.unshift(event);
    if (this.fallbackEvents.length > MAX_FALLBACK_EVENTS) {
      this.fallbackEvents.pop();
    }

    const label = `[ApiTierManager] Fallback ${event.fromTier} → ${event.toTier} (${event.reason}, paid=${event.paidResult})`;
    if (event.paidResult === 'success') {
      console.warn(label, event);
    } else {
      console.error(label, event);
    }

    try {
      ErrorLogService.logEvent('api', label, {
        ...event,
      }, event.paidResult === 'success' ? 'warn' : 'error', event.sessionId);
    } catch {
      // Logging must never break the evaluation path.
    }

    if (event.sessionId) {
      this.persistFallback(event).catch(() => {
        // Fire-and-forget; persistence failure must not affect evaluation.
      });
    }
  }

  getFallbackEvents(): TierFallbackEvent[] {
    return [...this.fallbackEvents];
  }

  /**
   * Returns the model name hint for paid-tier requests (non-sensitive).
   * The actual paid API key lives in Supabase Edge Function secrets —
   * it is never read or used on the client.
   */
  getPaidModel(): string {
    return (
      (import.meta.env?.VITE_PAID_MODEL as string) ||
      (typeof process !== 'undefined' ? process.env.VITE_PAID_MODEL : '') ||
      'gemini-2.0-flash'
    );
  }


  resetForTests(): void {
    this.sessionTiers.clear();
    this.sessionLatchTimestamps.clear();
    this.fallbackEvents = [];
  }

  private async persistFallback(event: TierFallbackEvent): Promise<void> {
    try {
      const { supabase } = await import('../database/supabaseClient');
      await supabase.from('ai_provider_logs').insert({
        session_id: event.sessionId,
        provider_name: event.provider || 'tier-fallback',
        model_used: event.model || null,
        purpose: 'eval',
        response_time_ms: 0,
        success: event.paidResult === 'success',
        error_type: event.paidResult === 'success' ? null : event.reason,
        provider_tier: event.toTier,
        fallback_reason: `${event.reason}${event.message ? `: ${event.message}` : ''}`.slice(0, 500),
      });
    } catch (err) {
      console.warn('[ApiTierManager] Failed to persist fallback event:', err);
    }
  }
}

export const ApiTierManager = new ApiTierManagerClass();