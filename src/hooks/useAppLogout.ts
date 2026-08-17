import { useCallback } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { clearAuthTokens } from '../Core/database/supabaseClient';

/**
 * Single sign-out path for the whole app.
 *
 * PHASE 1 — why this exists:
 * The Admin and HR dashboards rendered a visible "Logout" button whose handler was
 * `() => { window.location.href = '/' }` (App.tsx). That performs a navigation and nothing
 * else — Clerk keeps the session, the module-level Supabase bearer token in supabaseClient
 * survives, and `PublicRoute restricted` immediately redirects the still-signed-in user back
 * to /candidate/dashboard. The net effect was that logging out was impossible from those
 * screens, which matters most on shared campus machines where the next user inherits the session.
 *
 * The candidate-facing screens (CandidateProfile, LandingScreen) already called Clerk's
 * signOut() correctly, but none of the sign-out paths cleared the in-memory Supabase/Clerk
 * tokens or the in-progress interview id.
 *
 * Order matters: clear local state first so that if signOut() throws (offline, network error)
 * we have still dropped the credentials this tab holds.
 */
export function useAppLogout() {
  const { signOut } = useClerk();

  return useCallback(async (redirectTo = '/') => {
    try {
      clearAuthTokens();
      sessionStorage.removeItem('current_session_id');
    } catch (err) {
      console.error('[useAppLogout] Failed to clear local auth state', err);
    }

    try {
      // redirectUrl lets Clerk own the post-sign-out navigation, which avoids a race where we
      // navigate before the session cookie is cleared and PublicRoute bounces us back in.
      await signOut({ redirectUrl: redirectTo });
    } catch (err) {
      console.error('[useAppLogout] Clerk signOut failed; forcing navigation', err);
      window.location.href = redirectTo;
    }
  }, [signOut]);
}
