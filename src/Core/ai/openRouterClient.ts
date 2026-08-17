import { supabase, getEdgeFunctionAuthHeaders } from "../database/supabaseClient";
import { AIClientResponse, ErrorType } from "../../../types";
import { SupabaseService } from "../database/supabaseService";
import { ApiTierManager } from "./apiTierManager";

interface OpenRouterRequest {
  prompt: string;
  purpose: 'live' | 'eval';
  sessionId?: string;
  systemPrompt?: string;
  userPrompt?: string;
  tier?: 'free' | 'paid';
}

export interface ClassifiedApiKey {
  provider: 'google' | 'openrouter' | 'unknown';
  format: 'google-studio-aq' | 'google-studio-aiza' | 'openrouter-v1' | 'openrouter-generic' | 'unknown';
  valid: boolean;
}

export function classifyApiKey(key?: string): ClassifiedApiKey {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    return { provider: 'unknown', format: 'unknown', valid: false };
  }
  const k = key.trim();
  if (k.startsWith('AQ.')) {
    return { provider: 'google', format: 'google-studio-aq', valid: true };
  }
  if (k.startsWith('AIzaSy')) {
    return { provider: 'google', format: 'google-studio-aiza', valid: true };
  }
  if (k.startsWith('sk-or-v1-')) {
    return { provider: 'openrouter', format: 'openrouter-v1', valid: true };
  }
  if (k.startsWith('sk-')) {
    return { provider: 'openrouter', format: 'openrouter-generic', valid: true };
  }
  return { provider: 'unknown', format: 'unknown', valid: false };
}

/**
 * A resilient client for sending prompts to the OpenRouter edge function,
 * handling rate limits, timeouts, and failing over to the backup function.
 */
export class OpenRouterClient {
  private static readonly MAX_RETRIES = 1;
  private static readonly INITIAL_RETRY_DELAY_MS = 500;
  private static readonly FALLBACK_FUNCTION = 'ai-fallback';
  private static readonly PRIMARY_FUNCTION = 'openrouter-proxy';

  public static getEVAL_TIMEOUT_MS(): number {
    return Number(import.meta.env.VITE_EVAL_TIMEOUT_MS) || 25000;
  }

  public static getLIVE_TIMEOUT_MS(): number {
    return Number(import.meta.env.VITE_LIVE_TIMEOUT_MS) || 30000;
  }

  public static getEVAL_MAX_TOKENS(): number {
    return Number(import.meta.env.VITE_EVAL_MAX_TOKENS) || 4000;
  }

  /**
   * Free → Paid tiered generation.
   *
   * 1. If the session is already latched to the PAID tier, attempt paid first.
   * 2. Otherwise run the FREE tier (direct client keys, openrouter-proxy,
   *    ai-fallback) — the existing resilient flow.
   * 3. If the free tier fails with a fallback-worthy error (rate limit,
   *    quota exhausted, provider unavailable, timeout), and
   *    VITE_PAID_TIER_ENABLED=true, send `tier: "paid"` to the edge function.
   *    The edge function uses server-side paid secrets — no key ever reaches
   *    the client bundle.
   * 4. Every free → paid switch is recorded as a fallback event
   *    (timestamp, reason, tier used) and the session is latched to paid.
   */
  public static async generate<T = any>(
    request: OpenRouterRequest
  ): Promise<AIClientResponse<T>> {
    const startTime = performance.now();
    const timeoutMs = request.purpose === 'live' ? this.getLIVE_TIMEOUT_MS() : this.getEVAL_TIMEOUT_MS();
    const sessionId = request.sessionId;

    const activeTier = ApiTierManager.getActiveTier(sessionId);
    console.log(`[OpenRouterClient] Active tier: ${activeTier} (session: ${sessionId || 'none'})`);

    if (activeTier === 'paid') {
      const paidFirst = await this.invokePaidTier<T>(request, timeoutMs, startTime);
      if (paidFirst.success) {
        return paidFirst;
      }
      console.warn('[OpenRouterClient] Paid tier failed for paid-latched session; falling back to free tier attempt.');
    }

    const freeResult = await this.runFreeTier<T>(request, timeoutMs, startTime);

    if (freeResult.success) {
      return freeResult;
    }

    const failure = freeResult as import('../../../types').AIClientFailure;
    if (ApiTierManager.isFallbackWorthy(failure.errorType, failure.message)) {
      const reason = ApiTierManager.classifyReason(failure.errorType, failure.message);
      console.warn(`[OpenRouterClient] Free tier failed (${failure.errorType}). Escalating to PAID tier.`);

      const paidAttempt = await this.invokePaidTier<T>(request, timeoutMs, startTime);

      if (paidAttempt.success) {
        ApiTierManager.latchSessionPaid(sessionId);
        ApiTierManager.recordFallback({
          timestamp: new Date().toISOString(),
          reason,
          fromTier: 'free',
          toTier: 'paid',
          paidResult: 'success',
          provider: paidAttempt.provider,
          model: paidAttempt.model,
          sessionId,
          message: failure.message
        });
        return paidAttempt;
      }

      ApiTierManager.recordFallback({
        timestamp: new Date().toISOString(),
        reason,
        fromTier: 'free',
        toTier: 'paid',
        paidResult: 'failed',
        sessionId,
        message: failure.message
      });
    }

    return freeResult;
  }

  private static async runFreeTier<T>(
    request: OpenRouterRequest,
    timeoutMs: number,
    startTime: number
  ): Promise<AIClientResponse<T>> {
    let attempt = 0;
    let currentDelay = this.INITIAL_RETRY_DELAY_MS;

    while (attempt <= this.MAX_RETRIES) {
      let fallbackAttempted = false;
      try {
        const result = await this.invokeWithTimeout(
          this.PRIMARY_FUNCTION,
          { ...request, preventAutoEscalation: true },
          timeoutMs
        );
        
        const latencyMs = Math.round(performance.now() - startTime);
        
        // Success case
        if (!result.error && result.data) {
          if (!result.data.choices || !Array.isArray(result.data.choices)) {
            throw { type: 'InvalidResponseError', message: 'Malformed successful response: missing choices array' };
          }
          
          const responseStr = JSON.stringify(result.data);
          const promptTokens = result.data.usage?.prompt_tokens || Math.ceil(request.prompt.length / 4);
          const completionTokens = result.data.usage?.completion_tokens || Math.ceil(responseStr.length / 4);
          const totalTokens = result.data.usage?.total_tokens || (promptTokens + completionTokens);
          
          const modelUsed = result.data.model || (request.purpose === 'live' 
            ? (import.meta.env.VITE_FAST_MODEL || 'openrouter/free') 
            : (import.meta.env.VITE_EVAL_MODEL || 'openrouter/free'));

          SupabaseService.incrementSystemUsageStats(promptTokens, completionTokens).catch(e => {
            console.warn("Failed to increment usage stats:", e);
          });

          return {
            success: true,
            data: result.data as T,
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: totalTokens
            },
            provider: 'openrouter',
            model: modelUsed,
            latencyMs,
            tier: 'free'
          };
        }

        // Handle specific server-side errors
        if (result.error) {
          const errMsg = result.error.message || JSON.stringify(result.error);
          
          if (errMsg.includes('Rate limit') || errMsg.includes('429')) {
            throw { type: 'RateLimitError', message: errMsg };
          }
          if (errMsg.includes('500') || errMsg.includes('502') || errMsg.includes('503') || errMsg.includes('504')) {
             throw { type: 'ProviderUnavailableError', message: errMsg };
          }
          
          return {
            success: false,
            errorType: 'InvalidResponseError',
            retryable: false,
            message: errMsg
          };
        }
      } catch (err: any) {
        const isLastAttempt = attempt === this.MAX_RETRIES;
        let errorType: ErrorType = err.type || (err.name === 'TimeoutError' ? 'TimeoutError' : 'UnknownError');
        if (err.message && (err.message.includes('429') || err.message.includes('Rate limit'))) {
          errorType = 'RateLimitError';
        }
        // Classify fetch TypeErrors (DOMException / TypeError from failed network requests)
        if (errorType === 'UnknownError' && (err.name === 'TypeError' || err.message?.includes('Failed to fetch'))) {
          errorType = 'NetworkError' as ErrorType;
        }
        
        // If it's a 5xx error, RateLimitError, Timeout, or NetworkError, try the fallback function
        if (!fallbackAttempted && (errorType === 'ProviderUnavailableError' || errorType === 'TimeoutError' || errorType === 'RateLimitError' || errorType === 'NetworkError')) {
           console.warn(`[OpenRouterClient] Primary failed with ${errorType}. Attempting fallback (attempt #${attempt + 1})...`);
           fallbackAttempted = true;
           try {
              const fallbackResult = await this.invokeWithTimeout(
                this.FALLBACK_FUNCTION,
                { ...request, preventAutoEscalation: true },
                timeoutMs
              );
              
              if (!fallbackResult.error && fallbackResult.data) {
                 if (!fallbackResult.data.choices || !Array.isArray(fallbackResult.data.choices)) {
                   throw { type: 'InvalidResponseError', message: 'Malformed successful response: missing choices array' };
                 }
                 const responseStr = JSON.stringify(fallbackResult.data);
                 const promptTokens = fallbackResult.data.usage?.prompt_tokens || Math.ceil(request.prompt.length / 4);
                 const completionTokens = fallbackResult.data.usage?.completion_tokens || Math.ceil(responseStr.length / 4);
                 SupabaseService.incrementSystemUsageStats(promptTokens, completionTokens).catch(() => {});
                 
                 return {
                    success: true,
                    data: fallbackResult.data as T,
                    usage: {
                      prompt_tokens: promptTokens,
                      completion_tokens: completionTokens,
                      total_tokens: promptTokens + completionTokens
                    },
                    provider: 'ai-fallback',
                    model: 'fallback',
                    latencyMs: Math.round(performance.now() - startTime),
                    tier: 'free'
                 };
              }
           } catch (fallbackErr) {
             console.error("[OpenRouterClient] Fallback also failed:", fallbackErr);
           }
        }

        if (isLastAttempt || errorType === 'InvalidResponseError' || errorType === 'RateLimitError') {
          return {
            success: false,
            errorType: errorType,
            retryable: false,
            message: err.message || String(err)
          };
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= 2;
        attempt++;
      }
    }
    
    return {
      success: false,
      errorType: 'UnknownError',
      retryable: false,
      message: 'Max retries exceeded'
    };
  }

  /**
   * PAID tier attempt — server-side only.
   *
   * Sends `tier: "paid"` to the openrouter-proxy edge function.
   * The edge function uses PAID_OPENROUTER_API_KEY / PAID_GEMINI_API_KEY
   * Supabase secrets — the paid key is NEVER read or used on the client.
   * If VITE_PAID_TIER_ENABLED is not set to "true", escalation is skipped
   * immediately to avoid unnecessary edge-function calls.
   */
  private static async invokePaidTier<T>(
    request: OpenRouterRequest,
    timeoutMs: number,
    startTime: number
  ): Promise<AIClientResponse<T>> {
    const paidModel = ApiTierManager.getPaidModel();

    try {
      const result = await this.invokeWithTimeout(
        this.PRIMARY_FUNCTION,
        { ...request, tier: 'paid', paidModel },
        timeoutMs,
        true // skipClientKeys — paid calls must always go via edge function
      );

      if (!result.error && result.data && Array.isArray(result.data.choices)) {
        const responseStr = JSON.stringify(result.data);
        const promptTokens = result.data.usage?.prompt_tokens || Math.ceil(request.prompt.length / 4);
        const completionTokens = result.data.usage?.completion_tokens || Math.ceil(responseStr.length / 4);

        SupabaseService.incrementSystemUsageStats(promptTokens, completionTokens).catch(() => {});

        return {
          success: true,
          data: result.data as T,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
          },
          provider: result.data.telemetry?.provider || 'openrouter-paid',
          model: result.data.model || paidModel,
          latencyMs: Math.round(performance.now() - startTime),
          tier: 'paid'
        };
      }

      if (result.error) {
        console.error(`[OpenRouterClient] PAID tier edge function returned error: ${result.error.message || JSON.stringify(result.error)}`);
      }
    } catch (paidErr: any) {
      console.error(`[OpenRouterClient] PAID tier edge function call failed: ${paidErr?.message || paidErr}`);
    }

    return {
      success: false,
      errorType: 'ProviderUnavailableError',
      retryable: false,
      message: 'Paid tier unavailable (check server-side PAID_OPENROUTER_API_KEY / PAID_GEMINI_API_KEY secrets)'
    };
  }

  private static async executeFetchWithKey(apiKey: string, body: any, controller: AbortController): Promise<any> {
    const classified = classifyApiKey(apiKey);
    const paidModelOverride = body.paidModel as string | undefined;

    if (classified.provider === 'google') {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      // Build request with system instruction when system+user separation is provided
      const geminiBody: any = {
        contents: [{ parts: [{ text: body.systemPrompt && body.userPrompt ? body.userPrompt : body.prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: body.purpose === 'live' ? 2000 : OpenRouterClient.getEVAL_MAX_TOKENS()
        }
      };
      if (body.systemPrompt && body.userPrompt) {
        geminiBody.systemInstruction = { parts: [{ text: body.systemPrompt }] };
      }
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Gemini API HTTP ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { 
        data: { 
          choices: [{ message: { content: rawText }, finish_reason: 'stop' }], 
          model: 'gemini-2.0-flash' 
        }, 
        error: null 
      };
    }

    const model = paidModelOverride
      ? paidModelOverride
      : body.purpose === 'live'
        ? (import.meta.env.VITE_FAST_MODEL || 'openrouter/free')
        : (import.meta.env.VITE_EVAL_MODEL || 'openrouter/free');

    const maxTokens = body.purpose === 'live' ? 2000 : OpenRouterClient.getEVAL_MAX_TOKENS();

    // Use system+user message separation when both provided — improves instruction following
    // and allows the model to process evaluation rules (system) independently from the answer (user)
    const messages = (body.systemPrompt && body.userPrompt)
      ? [{ role: "system", content: body.systemPrompt }, { role: "user", content: body.userPrompt }]
      : [{ role: "user", content: body.prompt }];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': (typeof window !== 'undefined' ? window.location.origin : null) || 'http://localhost:3000',
        'X-Title': "Reincrew AI"
      },
      body: JSON.stringify({
        model: model,
        messages,
        temperature: 0.1,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });

    let responseData = null;
    try {
      responseData = await response.json();
    } catch {
      // JSON parse fallback
    }

    if (!response.ok) {
      throw new Error(`OpenRouter HTTP ${response.status}: ${responseData?.error?.message || response.statusText}`);
    }

    return { data: responseData, error: null };
  }

  private static currentKeyIndex = 0;

  private static async invokeWithTimeout(
    functionName: string, 
    body: any, 
    timeoutMs: number,
    skipClientKeys = false
  ): Promise<any> {
    try {
      // For paid-tier calls: always skip client keys and go directly to the edge
      // function. Paid secrets live server-side only, never in the client bundle.
      const apiKeys = body.tier === 'paid'
        ? []
        : [
          import.meta.env.VITE_OPENROUTER_API_KEY,
          import.meta.env.VITE_GEMINI_API_KEY,
          import.meta.env.VITE_OPENROUTER_API_KEY_SECONDARY,
          import.meta.env.VITE_SECONDARY_API_KEY
        ].filter((k): k is string => classifyApiKey(k).valid);

      if (apiKeys.length > 0 && functionName !== 'ai-fallback' && !skipClientKeys) {
        // Round-Robin Load Balancing: Start at alternating key to distribute traffic 50/50
        const startIndex = OpenRouterClient.currentKeyIndex % apiKeys.length;
        OpenRouterClient.currentKeyIndex++;

        const orderedKeys = [
          ...apiKeys.slice(startIndex),
          ...apiKeys.slice(0, startIndex)
        ];

        for (let i = 0; i < orderedKeys.length; i++) {
          const apiKey = orderedKeys[i].trim();
          const keyController = new AbortController();
          const keyTimeoutId = setTimeout(() => keyController.abort(), timeoutMs);

          try {
            console.log(`[OpenRouterClient] Load-Balancing request using API Key slot (attempt #${i + 1}, timeout: ${timeoutMs}ms)`);
            const result = await OpenRouterClient.executeFetchWithKey(apiKey, body, keyController);
            if (result && result.data) {
              return result;
            }
          } catch (keyErr: any) {
            const isTimeout = keyErr.name === 'AbortError' || keyErr.message?.includes('timed out') || keyErr.type === 'TimeoutError';
            console.warn(`[OpenRouterClient] Key slot #${i + 1} failed: ${isTimeout ? `Timeout after ${timeoutMs}ms` : (keyErr?.message || keyErr)}.`);
            if (keyErr?.message?.includes('429') || keyErr?.message?.includes('Rate limit')) {
              throw { type: 'RateLimitError', message: keyErr.message };
            }
            if (isTimeout && i === orderedKeys.length - 1) {
              throw { name: 'TimeoutError', type: 'TimeoutError', message: `Request to ${functionName} timed out after ${timeoutMs}ms` };
            }
          } finally {
            clearTimeout(keyTimeoutId);
          }
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const currentSessionId = sessionStorage.getItem("current_session_id") || "unknown";
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getEdgeFunctionAuthHeaders()
          },
          body: JSON.stringify({ ...body, sessionId: body.sessionId || currentSessionId }),
          signal: controller.signal
        });
        
        let responseData = null;
        try {
          responseData = await response.json();
        } catch {
          // Intentional — failed status frequently returns non-JSON
        }

        if (!response.ok) {
          const errorMsg = responseData?.details ? `${responseData.error} - ${responseData.details}` : (responseData?.error || response.statusText || String(response.status));
          return { data: null, error: { message: errorMsg } };
        }
        return { data: responseData, error: null };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw { name: 'TimeoutError', type: 'TimeoutError', message: `Request to ${functionName} timed out after ${timeoutMs}ms` };
      }
      throw err;
    }
  }
}

