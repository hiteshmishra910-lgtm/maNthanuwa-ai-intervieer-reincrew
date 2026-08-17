const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

export function getAllowedOrigins(): string[] {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (fromEnv?.trim()) {
    return fromEnv
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  // If running in Supabase Edge Function (production), ALLOWED_ORIGINS is required.
  // Missing it means CORS will reject all cross-origin requests, which is safer than
  // silently allowing localhost origins in production.
  const isProduction = !!Deno.env.get("DENO_DEPLOYMENT_ID");
  if (isProduction) {
    return []; // Reject all cross-origin requests
  }

  // Local development fallback only. In production, set ALLOWED_ORIGINS in Supabase Edge Function secrets.
  return LOCAL_DEVELOPMENT_ORIGINS;
}

export function resolveCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const requestOrigin = origin || "";
  const allowOrigin =
    requestOrigin && allowed.includes(requestOrigin)
      ? requestOrigin
      : allowed[0] || "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clerk-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
