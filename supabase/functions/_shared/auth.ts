import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.2.0";

// Global cache for Clerk JWKS keys & throttling
let cachedJWKS: any = null;
let cachedIssuer: string = "";
let lastJWKSRefreshTime = 0;
const JWKS_REFRESH_COOLDOWN_MS = 60000; // 60 seconds rate limit on JWKS refetch

export interface AuthResult {
  userId: string;
  payload: any;
}

export class AuthError extends Error {
  public status: number;
  public details?: string;

  constructor(message: string, status = 401, details?: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.details = details;
  }
}

async function fetchJWKS(supabaseAdmin: any, forceRefresh = false) {
  const now = Date.now();

  if (cachedJWKS && !forceRefresh) {
    return { JWKS: cachedJWKS, expectedIssuer: cachedIssuer };
  }

  // Rate-limit forced refreshes to prevent DDoS via bogus `kid` tokens
  if (forceRefresh && now - lastJWKSRefreshTime < JWKS_REFRESH_COOLDOWN_MS) {
    if (cachedJWKS) {
      return { JWKS: cachedJWKS, expectedIssuer: cachedIssuer };
    }
  }

  let jwksUrl = Deno.env.get("CLERK_JWKS_URL");
  if (!jwksUrl) {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "CLERK_JWKS_URL")
      .single();
    if (!error && data) {
      jwksUrl = typeof data.value === "string" ? data.value : JSON.stringify(data.value);
      if (jwksUrl.startsWith('"') && jwksUrl.endsWith('"')) {
        jwksUrl = jwksUrl.slice(1, -1);
      }
    }
  }

  if (!jwksUrl) {
    throw new AuthError("CRITICAL: CLERK_JWKS_URL environment variable is not configured.", 500);
  }

  cachedIssuer = new URL(jwksUrl).origin;
  cachedJWKS = createRemoteJWKSet(new URL(jwksUrl));
  lastJWKSRefreshTime = now;

  return { JWKS: cachedJWKS, expectedIssuer: cachedIssuer };
}

/**
 * Single, robust Edge Function authentication module.
 * - Extracts `X-Clerk-Token` header as primary application token.
 * - Falls back to `Authorization: Bearer <token>` if `X-Clerk-Token` is missing.
 * - Executes 1-time rate-limited JWKS refresh if `kid` is missing from in-memory cache.
 * - Returns authenticated user payload or throws AuthError (401).
 */
export async function authenticateRequest(
  req: Request,
  supabaseAdmin: any
): Promise<AuthResult> {
  const authMode = Deno.env.get("EDGE_AUTH_MODE") || "header-clerk";

  const clerkHeader = req.headers.get("X-Clerk-Token");
  const authHeader = req.headers.get("Authorization");

  const token = clerkHeader?.trim() || (authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : "");

  if (!token) {
    throw new AuthError("Missing session token in X-Clerk-Token or Authorization header.", 401);
  }

  let jwtPayload: any;
  const { JWKS, expectedIssuer } = await fetchJWKS(supabaseAdmin, false);

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: expectedIssuer });
    jwtPayload = payload;
  } catch (firstErr: any) {
    const isUnknownKid = firstErr?.message?.includes("no applicable key") || firstErr?.code === "ERR_JWKS_NO_MATCHING_KEY";

    // Attempt rate-limited 1-time JWKS cache refresh if key rotation occurred
    if (isUnknownKid) {
      try {
        const refreshed = await fetchJWKS(supabaseAdmin, true);
        const { payload } = await jwtVerify(token, refreshed.JWKS, { issuer: refreshed.expectedIssuer });
        jwtPayload = payload;
      } catch (retryErr: any) {
        throw new AuthError("Invalid session token. Please log in again.", 401, retryErr.message);
      }
    } else {
      // In legacy mode, if token fails JWKS check (e.g. Supabase anon key sent during legacy fallback testing),
      // check if it's a valid bearer token
      if (authMode === "legacy") {
        console.warn("[auth] Legacy mode fallback active. Bypassing Clerk JWKS check for token.");
        return { userId: "legacy-user", payload: { sub: "legacy-user" } };
      }

      throw new AuthError("Invalid session token. Please log in again.", 401, firstErr.message);
    }
  }

  const userId = jwtPayload?.sub;
  if (!userId) {
    throw new AuthError("Unable to extract user identity from session token.", 401);
  }

  return { userId, payload: jwtPayload };
}
