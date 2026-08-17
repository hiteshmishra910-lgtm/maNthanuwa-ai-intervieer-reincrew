import { callLLM } from "../_shared/aiClient.ts";

export async function callOpenRouter(systemPrompt: string, userPrompt: string) {
  console.log(`[Hybrid] LLM request initiated`);

  const response = await callLLM({
    systemPrompt,
    userPrompt,
    purpose: "eval",
    maxTokens: 4096,
    temperature: 0.2,
    functionName: "evaluate-hybrid-job",
  });

  const content = response.choices?.[0]?.message?.content || "";
  const telemetry = response.telemetry;

  return {
    raw_response: response,
    content,
    metadata: {
      model: telemetry.model,
      provider: telemetry.provider,
      fallbackUsed: telemetry.fallbackUsed,
      originalProvider: telemetry.originalProvider,
      prompt_version: "v2-batch-json",
      temperature: 0.2,
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
      duration_ms: telemetry.latencyMs,
    },
  };
}

