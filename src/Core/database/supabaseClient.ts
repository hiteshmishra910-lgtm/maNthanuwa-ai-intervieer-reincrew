import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder_anon_key';

// Internal state for auth token
let _token: string | null = null;

// Clerk JWT stored separately — edge functions verify against Clerk JWKS,
// so they need the raw Clerk token (not filtered through isSupabaseToken).
let _clerkToken: string | null = null;

/**
 * Call this with the raw Clerk JWT so edge functions (e.g. cloudinary-sign)
 * can receive a valid token for Clerk JWKS verification.
 */
export function setClerkToken(token: string | null) {
  _clerkToken = token;
}

/**
 * Clear all in-memory auth state.
 *
 * PHASE 1: the module-level `_token` / `_clerkToken` live for the lifetime of the JS module,
 * so signing out of Clerk alone does NOT stop subsequent Supabase calls from being sent with
 * the previous user's bearer token. Any sign-out path must call this.
 */
export function clearAuthTokens(): void {
  _token = null;
  _clerkToken = null;
}

// Internal mutable instance — never export this directly
const customFetch = (url: RequestInfo | URL, options: RequestInit = {}) => {
  const headers = new Headers(options?.headers || {});
  if (_token) {
    headers.set('Authorization', `Bearer ${_token}`);
  }
  return fetch(url, { ...options, headers });
};

const _client: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch,
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Always returns the current authenticated (or anon) client.
 * Use this when you need direct access to the client instance.
 */
export const getSupabase = (): SupabaseClient => _client;

function isSupabaseToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const decodePart = (part: string) => {
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonStr);
    };

    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);

    // Compatible if signed symmetrically with HS256 (like standard Supabase tokens or custom Clerk JWT templates for Supabase)
    // OR if it's an RS256 token from Clerk (our primary auth provider)
    const isSupabaseToken = header.alg === 'HS256' || payload.iss === 'supabase';

    // PHASE 1: the Clerk issuer used to be hardcoded to 'clerk.accounts.dev', which is Clerk's
    // DEVELOPMENT domain. On a production Clerk instance with a custom domain the issuer does
    // not contain that string, so the RS256 fallback token was silently rejected and every
    // subsequent request downgraded to the anon key. VITE_CLERK_ISSUER lets deployments declare
    // their real issuer; the development domain remains accepted so existing setups are unchanged.
    const configuredIssuer = (import.meta.env?.VITE_CLERK_ISSUER as string | undefined)?.trim();
    const iss = typeof payload.iss === 'string' ? payload.iss : '';
    const isClerkToken =
      header.alg === 'RS256' &&
      (iss.includes('clerk.accounts.dev') || (!!configuredIssuer && iss.startsWith(configuredIssuer)));

    return isSupabaseToken || isClerkToken;
  } catch {
    return false;
  }
}

/**
 * Call this whenever you get a fresh Clerk JWT.
 * All subsequent getSupabase() and supabase.from(...) calls will use the new token.
 */
export const setSupabaseAuthToken = (token: string | null): void => {
  if (token && !isSupabaseToken(token)) {
    // PHASE 1: this used to be a console.warn, which made the failure mode invisible — the app
    // kept running as an anonymous user while appearing signed in. Escalated to console.error
    // with actionable detail so a misconfigured issuer is diagnosable rather than silent.
    console.error(
      '[SupabaseClient] Rejected auth token: not a Supabase-compatible JWT. ' +
      'Requests will fall back to the anon key and user-scoped data will be unavailable. ' +
      'If this is a production Clerk instance, set VITE_CLERK_ISSUER to its issuer URL, ' +
      'or ensure the Clerk "supabase" JWT template exists.'
    );
    return;
  }
  console.log('[SupabaseClient] Updating auth token:', token ? `${token.substring(0, 20)}...` : 'null');
  _token = token;
};


/**
 * Kept for backward-compat with existing imports of `supabase`.
 * ⚠️  This is a PROXY — reads always go to the current _client.
 * This means `supabase.from(...)` will always use the latest token.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const value = (_client as any)[prop];
    // Bind methods to the client to preserve `this` context
    if (typeof value === 'function') {
      return value.bind(_client);
    }
    return value;
  },
});

export const getEdgeFunctionAuthHeaders = (overrideToken?: string) => {
  const key = supabaseAnonKey || '';
  const clerkToken = overrideToken || _clerkToken || (_token && _token !== key ? _token : '');

  const headers: Record<string, string> = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  };

  if (clerkToken) {
    headers['X-Clerk-Token'] = clerkToken;
  }

  return headers;
};

/** Constructs a complete fetch RequestInit object for Supabase Edge Functions. */
export const buildEdgeFunctionRequest = (body: object, overrideToken?: string): RequestInit => {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getEdgeFunctionAuthHeaders(overrideToken),
    },
    body: JSON.stringify(body),
  };
};

/** Returns the current Clerk JWT for passing to edge functions. */
export const getClerkToken = (): string | null => _clerkToken || _token;