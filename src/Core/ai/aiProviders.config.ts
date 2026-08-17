// AI provider configuration is now handled entirely server-side via the
// ai-fallback edge function. API keys are stored as Supabase Edge Function secrets.
// This file is kept as a stub for any legacy type references.
export interface ProviderConfig {
  name: string;
  model: string;
  apiUrl: string;
  getApiKey: () => string;
  timeoutMs: number;
}

// No providers are configured client-side — all API keys live in edge function secrets.
export const AI_PROVIDERS: ProviderConfig[] = [];
