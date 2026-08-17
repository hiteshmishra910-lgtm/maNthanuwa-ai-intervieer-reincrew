import { supabase, getEdgeFunctionAuthHeaders } from "../database/supabaseClient";
import { ErrorLogService } from "../logging/errorLogService";

// ─── Main export: calls ai-fallback edge function (all keys server-side) ──────
export async function generateWithFailover(
  prompt: string,
  purpose: "live" | "eval" | "report" = "eval",
  _signal?: AbortSignal,
  sessionId?: string,
  traceId?: string,
  timeoutMs: number = 15000 // default 15s
): Promise<string> {
  let timeoutId: any;
  try {
    const controller = new AbortController();
    if (_signal) {
      _signal.addEventListener('abort', () => controller.abort());
    }
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const { data, error } = await supabase.functions.invoke("ai-fallback", {
      body: { prompt, purpose, sessionId, traceId },
      headers: getEdgeFunctionAuthHeaders(),
    });

    if (error) {
      throw new Error(`Fallback Edge Function error: ${error.message || JSON.stringify(error)}`);
    }

    if (!data || !data.choices || data.choices.length === 0) {
      throw new Error("Fallback Edge Function returned an invalid response.");
    }

    // Log token usage to system_usage_stats (non-blocking)
    if (data.usage) {
      // Using dynamic import to avoid circular dependency at module level
      const { SupabaseService } = await import("../database/supabaseService");
      SupabaseService.incrementSystemUsageStats(
        data.usage.prompt_tokens || 0,
        data.usage.completion_tokens || 0,
      ).catch((e: any) => console.error("Failed to log system metric:", e));
    }

    if (timeoutId) clearTimeout(timeoutId);
    return data.choices[0].message.content;
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    ErrorLogService.logError(
      "api",
      `AI fallback failed: ${err.message || err}`,
      { prompt: prompt.substring(0, 100), purpose, sessionId, traceId },
    );
    throw err;
  }
}
