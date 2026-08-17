import { ErrorLogService } from '../logging/errorLogService';

interface ApiKeyState {
  key: string;
  label: string;          // e.g. "key-1" for logging, never log the raw key
  isRateLimited: boolean;
  rateLimitedUntil: number; // timestamp ms, 0 if not limited
  requestCount: number;
  failureCount: number;
}

class ApiKeyManagerClass {
  private keys: ApiKeyState[] = [];
  private currentIndex = 0;

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    // Reads comma-separated keys from env: VITE_OPENROUTER_API_KEYS=key1,key2,key3
    const raw =
      (import.meta.env?.VITE_OPENROUTER_API_KEYS as string) ||
      (typeof process !== 'undefined' ? process.env.VITE_OPENROUTER_API_KEYS : '') ||
      '';

    const rawKeys = raw.split(',').map(k => k.trim()).filter(Boolean);

    // Fallback to single legacy key if the multi-key var isn't set
    if (rawKeys.length === 0) {
      const single =
        (import.meta.env?.VITE_OPENROUTER_API_KEY as string) ||
        (typeof process !== 'undefined' ? process.env.VITE_OPENROUTER_API_KEY : '') ||
        '';
      if (single) rawKeys.push(single);
    }

    this.keys = rawKeys.map((key, i) => ({
      key,
      label: `key-${i + 1}`,
      isRateLimited: false,
      rateLimitedUntil: 0,
      requestCount: 0,
      failureCount: 0
    }));

    if (this.keys.length === 0) {
      console.error('[ApiKeyManager] No API keys configured.');
    } else {
      console.log(`[ApiKeyManager] Loaded ${this.keys.length} API key(s).`);
    }
  }

  /** Returns the next available (non-rate-limited) key using round-robin rotation */
  getNextKey(): ApiKeyState | null {
    if (this.keys.length === 0) return null;

    const now = Date.now();

    // Clear expired rate limits
    this.keys.forEach(k => {
      if (k.isRateLimited && k.rateLimitedUntil <= now) {
        k.isRateLimited = false;
        k.rateLimitedUntil = 0;
        console.log(`[ApiKeyManager] ${k.label} rate limit expired, back in rotation.`);
      }
    });

    const available = this.keys.filter(k => !k.isRateLimited);
    if (available.length === 0) {
      console.warn('[ApiKeyManager] All API keys are currently rate-limited.');
      return null;
    }

    // Round-robin among available keys
    this.currentIndex = (this.currentIndex + 1) % available.length;
    return available[this.currentIndex];
  }

  /** Marks a key as rate-limited for a cooldown period (default 60s) */
  markRateLimited(label: string, cooldownMs = 60000) {
    const k = this.keys.find(k => k.label === label);
    if (!k) return;
    k.isRateLimited = true;
    k.rateLimitedUntil = Date.now() + cooldownMs;
    k.failureCount += 1;
    console.warn(`[ApiKeyManager] ${k.label} marked rate-limited for ${cooldownMs}ms.`);
    ErrorLogService.logError(
      'api',
      `API key ${k.label} hit rate limit (429), cooling down for ${cooldownMs}ms`,
      { label: k.label }
    );
  }

  recordSuccess(label: string) {
    const k = this.keys.find(k => k.label === label);
    if (k) k.requestCount += 1;
  }

  recordFailure(label: string) {
    const k = this.keys.find(k => k.label === label);
    if (k) k.failureCount += 1;
  }

  /** For debugging / admin dashboard visibility */
  getStats() {
    return this.keys.map(k => ({
      label: k.label,
      isRateLimited: k.isRateLimited,
      rateLimitedUntil: k.rateLimitedUntil,
      requestCount: k.requestCount,
      failureCount: k.failureCount
    }));
  }

  getKeyCount() {
    return this.keys.length;
  }
}

// Singleton ΓÇö one shared pool across the whole app
export const ApiKeyManager = new ApiKeyManagerClass();
