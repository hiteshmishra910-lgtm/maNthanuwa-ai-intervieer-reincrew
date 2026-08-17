import { ErrorLogService } from '../logging/errorLogService';

/**
 * Wraps an async function with:
 * - Response time tracking
 * - Request logging (success & failure)
 * - Meaningful error messages
 */
export async function withMonitoring<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    ErrorLogService.logRequest(service, operation, duration, true);
    return result;
  } catch (error: any) {
    const duration = Math.round(performance.now() - start);
    const message = error?.message || String(error) || 'Unknown error';
    ErrorLogService.logRequest(service, operation, duration, false, message);
    // Re-throw so caller handles it — we just observe
    throw error;
  }
}

/**
 * Formats a raw error into a meaningful message for debugging
 */
export function formatError(error: any, context: string): string {
  if (!error) return `[${context}] Unknown error occurred`;

  if (error?.code === 'PGRST116') return `[${context}] Record not found in database`;
  if (error?.code === '23505') return `[${context}] Duplicate entry — record already exists`;
  if (error?.code === '23503') return `[${context}] Foreign key violation — related record missing`;
  if (error?.message?.includes('JWT')) return `[${context}] Session expired — user needs to re-login`;
  if (error?.message?.includes('FetchError') || error?.message?.includes('NetworkError')) {
    return `[${context}] Network unreachable — check internet or Supabase URL`;
  }
  if (error?.status === 429) return `[${context}] Rate limit hit — too many API requests`;
  if (error?.status === 401) return `[${context}] Unauthorized — invalid API key`;

  return `[${context}] ${error.message || String(error)}`;
}
