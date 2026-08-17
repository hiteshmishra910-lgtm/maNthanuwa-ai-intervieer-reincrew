/**
 * Centralized, resilient AI Client for Supabase Edge Functions.
 * 
 * Architecture Highlights:
 * 1. Strict Secret Management: Loads keys strictly via `Deno.env.get("OPENROUTER_API_KEY")` and `Deno.env.get("GEMINI_API_KEY")`.
 * 2. Selective Failover: Falls back ONLY on transient errors (429, 408, 500, 502, 503, 504, timeouts).
 * 3. Retry Before Fallback: Retries OpenRouter 2 times before falling back.
 * 4. Circuit Breaker: 60s cooldown on consecutive 429 rate limit errors to bypass known failing primary.
 * 5. Telemetry & Metadata: Returns standardized choices payload + execution telemetry.
 * 6. Privacy-Preserving Logs: Operational metrics logged without candidate prompts or responses.
 */

export interface LLMMessage {
  role: string;
  content: string;
}

export interface CallLLMOptions {
  prompt?: string;
  messages?: LLMMessage[];
  systemPrompt?: string;
  userPrompt?: string;
  purpose?: "live" | "eval";
  model?: string;
  maxTokens?: number;
  temperature?: number;
  siteUrl?: string;
  functionName?: string;
  tier?: "free" | "paid";
  paidModel?: string;
  /** When true, the server will NOT auto-escalate free requests to paid providers.
   *  Only explicit tier="paid" requests use paid providers. This prevents the edge
   *  function from duplicating paid credits that the client-side ApiTierManager manages. */
  preventAutoEscalation?: boolean;
}

export interface LLMTelemetry {
  provider: string;
  model: string;
  fallbackUsed: boolean;
  originalProvider: string;
  latencyMs: number;
  retryCount: number;
  httpStatus: number;
  tier?: "free" | "paid";
  fallbackReason?: string;
}

export interface LLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  telemetry: LLMTelemetry;
}

// In-memory circuit breaker cooldown state
let circuitBreakerOpenUntil = 0;
const CIRCUIT_COOLDOWN_MS = 60000; // 60 seconds

export function isTransientError(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

export async function callLLM(options: CallLLMOptions): Promise<LLMResponse> {
  const functionName = options.functionName || "aiClient";
  const startTime = performance.now();

  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const paidOpenRouterKey = Deno.env.get("PAID_OPENROUTER_API_KEY");
  const paidGeminiKey = Deno.env.get("PAID_GEMINI_API_KEY");
  const paidModelEnv = Deno.env.get("PAID_MODEL") || options.paidModel || "gemini-2.0-flash";

  // Construct standard messages array
  let messages: LLMMessage[] = [];
  if (options.messages && options.messages.length > 0) {
    messages = options.messages;
  } else if (options.systemPrompt && options.userPrompt) {
    messages = [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ];
  } else if (options.prompt) {
    messages = [{ role: "user", content: options.prompt }];
  } else {
    throw new Error(`[${functionName}] Invalid callLLM invocation: No prompt or messages provided.`);
  }

  const fastModel = Deno.env.get("VITE_FAST_MODEL") || "openrouter/free";
  const evalModel = Deno.env.get("VITE_EVAL_MODEL") || "openrouter/free";
  const defaultModel = options.purpose === "live" ? fastModel : evalModel;
  const targetModel = options.model || defaultModel;
  const max_tokens: number = options.maxTokens || 4000;
  const maxTokens = max_tokens;
  const temperature = options.temperature ?? 0.1;

  const now = Date.now();
  const isCircuitBreakerActive = openRouterKey && now < circuitBreakerOpenUntil;

  const requestTier = options.tier || "free";

  if (requestTier === "paid") {
    console.log(`[${functionName}] PAID tier request — attempting paid providers only.`);
  } else if (isCircuitBreakerActive) {
    console.warn(`[${functionName}] Circuit breaker active (429 cooldown). Bypassing OpenRouter directly to Gemini.`);
  }

  let retryCount = 0;
  let lastTransientErrorStatus = 0;
  let lastErrorMsg = "";

  // ---------------------------------------------------------------------------
  // STEP 1: Attempt OpenRouter Primary (with 2 retries on transient errors)
  // ---------------------------------------------------------------------------
  if (openRouterKey && !isCircuitBreakerActive && requestTier !== "paid") {
    const MAX_OPENROUTER_ATTEMPTS = 2;

    while (retryCount < MAX_OPENROUTER_ATTEMPTS) {
      retryCount++;
      const attemptStart = performance.now();
      console.log(`[${functionName}] Calling OpenRouter (Attempt ${retryCount}/${MAX_OPENROUTER_ATTEMPTS}, Model: ${targetModel})...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openRouterKey}`,
            "HTTP-Referer": options.siteUrl || "https://reincrew.ai",
            "X-Title": "Reincrew AI",
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const attemptLatency = Math.round(performance.now() - attemptStart);

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim() || "";
          
          if (!content) {
            console.warn(`[${functionName}] OpenRouter attempt ${retryCount} returned empty response content (0 chars). Treating as transient failure.`);
            lastTransientErrorStatus = 502;
            lastErrorMsg = "OpenRouter returned empty content (0 chars)";
            if (retryCount < MAX_OPENROUTER_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            } else {
              break; // Fall through to Gemini fallback
            }
          }

          const totalLatency = Math.round(performance.now() - startTime);

          console.log(`[${functionName}] ✓ OpenRouter succeeded (Status: 200, Latency: ${totalLatency}ms, Retries: ${retryCount - 1})`);

          return {
            id: data.id || `openrouter-${Date.now()}`,
            choices: data.choices || [],
            usage: data.usage || undefined,
            telemetry: {
              provider: "openrouter",
              model: data.model || targetModel,
              fallbackUsed: false,
              originalProvider: "openrouter",
              latencyMs: totalLatency,
              retryCount: retryCount - 1,
              httpStatus: 200,
              tier: "free",
            },
          };
        }

        const errorText = await response.text();
        const status = response.status;
        lastTransientErrorStatus = status;
        lastErrorMsg = `HTTP ${status}: ${errorText.substring(0, 200)}`;

        console.warn(`[${functionName}] OpenRouter attempt ${retryCount} failed with status ${status} (Latency: ${attemptLatency}ms)`);

        // Permanent errors (400, 401, 403) MUST NOT fall back or retry
        if (!isTransientError(status)) {
          console.error(`[${functionName}] Permanent error from OpenRouter (${status}). Aborting without fallback.`);
          throw new Error(`OpenRouter permanent error ${status}: ${errorText.substring(0, 200)}`);
        }

        // Handle 429 rate limit by activating Circuit Breaker
        if (status === 429) {
          circuitBreakerOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
          console.warn(`[${functionName}] 429 Rate Limit encountered. Circuit breaker engaged for 60s.`);
          break; // Stop retrying OpenRouter, fall through to Gemini
        }

        // Exponential backoff before retry (1s)
        if (retryCount < MAX_OPENROUTER_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 1000));
        }

      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr.name === "AbortError" || fetchErr.message?.includes("aborted");
        lastTransientErrorStatus = isTimeout ? 408 : 503;
        lastErrorMsg = fetchErr.message || String(fetchErr);

        console.warn(`[${functionName}] OpenRouter attempt ${retryCount} network/timeout error: ${lastErrorMsg}`);

        if (fetchErr.message?.includes("permanent error")) {
          throw fetchErr;
        }

        if (retryCount < MAX_OPENROUTER_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Execute Gemini Fallback (Only reached on transient failures or 429,
  // skipped for explicit paid requests)
  // ---------------------------------------------------------------------------
  let freeFailedMsg = `Primary OpenRouter failed (${lastErrorMsg})`;

  if (requestTier !== "paid") {
    if (!geminiKey) {
      freeFailedMsg = `LLM call failed. Primary provider returned transient error (${lastTransientErrorStatus}: ${lastErrorMsg}) and GEMINI_API_KEY secret is not configured.`;
    } else {
      console.log(`[${functionName}] Initiating Gemini Fallback (gemini-2.0-flash)...`);

      try {
        // Try OpenAI-compatible Gemini REST endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${geminiKey}`,
          },
          body: JSON.stringify({
            model: "gemini-2.0-flash",
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const totalLatency = Math.round(performance.now() - startTime);

          console.log(`[${functionName}] ✓ Gemini Fallback succeeded (Status: 200, Total Latency: ${totalLatency}ms)`);

          return {
            id: data.id || `gemini-fallback-${Date.now()}`,
            choices: data.choices || [],
            usage: data.usage || undefined,
            telemetry: {
              provider: "gemini",
              model: "gemini-2.0-flash",
              fallbackUsed: true,
              originalProvider: "openrouter",
              latencyMs: totalLatency,
              retryCount: retryCount,
              httpStatus: 200,
              tier: "free",
            },
          };
        }

        // If OpenAI-compatible endpoint returns an error, attempt Native REST endpoint as ultimate backup
        const errText = await response.text();
        console.warn(`[${functionName}] Gemini OpenAI-compat endpoint returned ${response.status}: ${errText.substring(0, 150)}. Trying Native REST...`);

        // Prepare text prompt for Native Gemini REST API
        const userPromptContent = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
        const nativeRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userPromptContent }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
              },
            }),
          }
        );

        if (nativeRes.ok) {
          const nativeData = await nativeRes.json();
          const generatedText = nativeData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const totalLatency = Math.round(performance.now() - startTime);

          console.log(`[${functionName}] ✓ Gemini Native REST succeeded (Status: 200, Total Latency: ${totalLatency}ms)`);

          return {
            id: `gemini-native-${Date.now()}`,
            choices: [
              {
                message: {
                  role: "assistant",
                  content: generatedText,
                },
                finish_reason: "stop",
              },
            ],
            telemetry: {
              provider: "gemini",
              model: "gemini-2.0-flash-native",
              fallbackUsed: true,
              originalProvider: "openrouter",
              latencyMs: totalLatency,
              retryCount: retryCount,
              httpStatus: 200,
              tier: "free",
            },
          };
        }

        const nativeErrText = await nativeRes.text();
        throw new Error(`Gemini Fallback failed. Compat: ${response.status}, Native: ${nativeRes.status} (${nativeErrText.substring(0, 150)})`);

      } catch (fallbackErr: any) {
        freeFailedMsg = `Primary OpenRouter failed (${lastErrorMsg}) and Gemini Fallback failed (${fallbackErr.message})`;
        console.error(`[${functionName}] ❌ Free tier failed after ${Math.round(performance.now() - startTime)}ms. Error: ${fallbackErr.message}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: PAID Tier (explicit paid request, or automatic escalation when
  // paid secrets are configured and the free tier failed)
  // When preventAutoEscalation is true, only explicit tier="paid" uses paid providers.
  // ---------------------------------------------------------------------------
  if (requestTier !== "paid" && options.preventAutoEscalation) {
    console.log(`[${functionName}] Free tier failed but preventAutoEscalation is true. Not auto-escalating.`);
    throw new Error(`AI Provider Failure: ${freeFailedMsg}`, {
      cause: new Error(freeFailedMsg),
    });
  }

  if (!paidOpenRouterKey && !paidGeminiKey) {
    console.error(`[${functionName}] Paid tier not configured and free tier failed: ${freeFailedMsg}`);
    if (requestTier === "paid") {
      throw new Error(`[${functionName}] Paid tier requested but no paid secrets configured. Set PAID_OPENROUTER_API_KEY or PAID_GEMINI_API_KEY.`);
    }
    throw new Error(`AI Provider Failure: ${freeFailedMsg}`, {
      cause: new Error(freeFailedMsg),
    });
  }

  let paidFailedMsg = freeFailedMsg;

  const attemptPaidProvider = async (
    providerName: string,
    attempt: () => Promise<{ ok: boolean; json: () => Promise<any>; text: () => Promise<string>; status: number }>
  ): Promise<LLMResponse | null> => {
    // Paid tier gets 1 retry on transient errors (free tier gets 2 retries + Gemini fallback)
    const MAX_PAID_ATTEMPTS = 2;
    for (let i = 0; i < MAX_PAID_ATTEMPTS; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await attempt();
        if (response.ok) {
          const data = await response.json();
          const totalLatency = Math.round(performance.now() - startTime);
          console.log(`[${functionName}] ✓ PAID tier succeeded (${providerName}, Status: 200, Total Latency: ${totalLatency}ms)`);
          return {
            id: data.id || `${providerName}-paid-${Date.now()}`,
            choices: data.choices || [],
            usage: data.usage || undefined,
            telemetry: {
              provider: providerName,
              model: paidModelEnv,
              fallbackUsed: true,
              originalProvider: "free-tier",
              latencyMs: totalLatency,
              retryCount: i,
              httpStatus: response.status || 200,
              tier: "paid",
              fallbackReason: freeFailedMsg.substring(0, 300),
            },
          };
        }
        const errText = await response.text();
        paidFailedMsg = `${providerName} failed: HTTP ${response.status}: ${errText.substring(0, 200)}`;
        // Only retry on transient errors (429, 5xx, 408)
        if (i < MAX_PAID_ATTEMPTS - 1 && isTransientError(response.status)) {
          console.warn(`[${functionName}] PAID tier ${providerName} transient error ${response.status}, retrying...`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new Error(paidFailedMsg);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          paidFailedMsg = `${providerName} timed out after 20000ms`;
          if (i < MAX_PAID_ATTEMPTS - 1) {
            console.warn(`[${functionName}] PAID tier ${providerName} timed out, retrying...`);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    return null;
  };

  try {
    if (paidOpenRouterKey) {
      console.log(`[${functionName}] Initiating PAID tier via OpenRouter (model: ${paidModelEnv})...`);
      const result = await attemptPaidProvider("openrouter-paid", () =>
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${paidOpenRouterKey}`,
            "HTTP-Referer": options.siteUrl || "https://reincrew.ai",
            "X-Title": "Reincrew AI",
          },
          body: JSON.stringify({
            model: paidModelEnv.startsWith("gemini") ? `google/${paidModelEnv}` : paidModelEnv,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        })
      );
      if (result) return result;
    }

    if (paidGeminiKey) {
      console.log(`[${functionName}] Initiating PAID tier via Gemini (model: ${paidModelEnv})...`);
      const result = await attemptPaidProvider("gemini-paid", () =>
        fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${paidGeminiKey}`,
          },
          body: JSON.stringify({
            model: paidModelEnv.startsWith("gemini") ? paidModelEnv : "gemini-2.0-flash",
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        })
      );
      if (result) return result;
    }
  } catch (paidErr: any) {
    console.error(`[${functionName}] ❌ PAID tier failed: ${paidErr.message}`);
    throw new Error(`AI Provider Failure: ${freeFailedMsg} and PAID tier failed (${paidErr.message})`, { cause: paidErr });
  }

  throw new Error(`AI Provider Failure: ${freeFailedMsg} and PAID tier failed (${paidFailedMsg})`);
}
