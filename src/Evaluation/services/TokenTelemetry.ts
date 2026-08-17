export interface SessionTokenTelemetry {
  sessionId: string;
  mode: 'API' | 'HYBRID' | 'LOCAL';
  totalApiCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
  failedTurnRetries: number;
}

const TOKEN_COST_PER_1K_PROMPT = 0.00015; // standard openrouter/free or gemini flash estimate
const TOKEN_COST_PER_1K_COMPLETION = 0.0006;

class TokenTelemetryService {
  private sessions = new Map<string, SessionTokenTelemetry>();

  public getOrCreate(sessionId: string, mode: 'API' | 'HYBRID' | 'LOCAL'): SessionTokenTelemetry {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        mode,
        totalApiCalls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        averageLatencyMs: 0,
        failedTurnRetries: 0
      });
    }
    return this.sessions.get(sessionId)!;
  }

  public recordApiCall(
    sessionId: string,
    mode: 'API' | 'HYBRID' | 'LOCAL',
    promptTokens: number,
    completionTokens: number,
    latencyMs: number,
    isRetry: boolean = false
  ) {
    const s = this.getOrCreate(sessionId, mode);
    s.totalApiCalls += 1;
    s.promptTokens += promptTokens;
    s.completionTokens += completionTokens;
    s.totalTokens += (promptTokens + completionTokens);
    if (isRetry) s.failedTurnRetries += 1;

    // Update cumulative average latency
    const prevCount = s.totalApiCalls - 1;
    s.averageLatencyMs = Math.round((s.averageLatencyMs * prevCount + latencyMs) / s.totalApiCalls);

    // Estimate cost
    const promptCost = (promptTokens / 1000) * TOKEN_COST_PER_1K_PROMPT;
    const completionCost = (completionTokens / 1000) * TOKEN_COST_PER_1K_COMPLETION;
    s.estimatedCostUsd += (promptCost + completionCost);

    console.log(`[TokenTelemetry] Session ${sessionId} [${mode}] Call #${s.totalApiCalls}: ` +
      `Tokens=${promptTokens}+${completionTokens} (${promptTokens + completionTokens}), ` +
      `TotalTokens=${s.totalTokens}, Latency=${latencyMs}ms, TotalCost=$${s.estimatedCostUsd.toFixed(5)}`
    );
  }

  public getSummary(sessionId: string): SessionTokenTelemetry | undefined {
    return this.sessions.get(sessionId);
  }
}

export const TokenTelemetry = new TokenTelemetryService();
