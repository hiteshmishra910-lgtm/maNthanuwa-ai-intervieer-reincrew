/**
 * Demo Isolation Guards
 * Enforces the Demo Isolation Contract: Ensures demo entities can NEVER be mutated
 * or written to Supabase production persistence.
 */

export const DEMO_SESSION_PREFIX = 'demo-session-';

export function isDemoSessionId(id?: string | null): boolean {
  if (!id) return false;
  return typeof id === 'string' && (id.startsWith(DEMO_SESSION_PREFIX) || id.includes('-demo-'));
}

export function isDemoCandidate(candidate: any): boolean {
  if (!candidate) return false;
  return Boolean(
    candidate.isDemo === true ||
    (candidate.id && typeof candidate.id === 'string' && candidate.id.startsWith('demo-cand-'))
  );
}

export function isDemoEntity(entity: any): boolean {
  if (!entity) return false;
  if (entity.isDemo === true) return true;
  if (isDemoCandidate(entity)) return true;
  if (typeof entity.id === 'string' && (entity.id.startsWith('demo-') || isDemoSessionId(entity.id))) return true;
  if (typeof entity.session_id === 'string' && isDemoSessionId(entity.session_id)) return true;
  return false;
}

export function assertNotDemoEntity(entity: any, actionName: string = 'Persistence Action'): void {
  if (isDemoEntity(entity)) {
    const errorMsg = `[Demo Isolation Guard Error] Blocked ${actionName}: Demo entities cannot be written to production database tables.`;
    console.warn(errorMsg, entity);
    throw new Error(errorMsg);
  }
}
