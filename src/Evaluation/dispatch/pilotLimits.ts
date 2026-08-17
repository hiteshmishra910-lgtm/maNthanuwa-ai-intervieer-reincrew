/**
 * Pilot Safety Limits — per-mode concurrency caps for candidate batch processing.
 *
 * These limits prevent pilot HRs from overloading the system by assigning too many
 * candidates to a single drive. Limits are enforced at two layers:
 *
 *   1. Frontend: CreateDriveForm warns HR if total_candidates exceeds the cap.
 *   2. Backend: process-evaluation-queue worker caps concurrent processing per mode.
 *
 * Adjust these values as pilot feedback and concurrency numbers come in.
 */

export interface PilotModeLimits {
  /** Maximum candidates allowed in a single drive for this mode */
  maxCandidatesPerDrive: number;
  /** Maximum concurrent sessions actively being evaluated */
  maxConcurrentSessions: number;
  /** Queue worker: max jobs to process per invocation for this mode */
  queueBatchSize: number;
}

/** Per-mode configuration */
export const PILOT_LIMITS: Record<string, PilotModeLimits> = {
  LOCAL: {
    maxCandidatesPerDrive: 100,
    maxConcurrentSessions: 50,
    queueBatchSize: 10, // LOCAL doesn't use queue, but kept for symmetry
  },
  HYBRID: {
    maxCandidatesPerDrive: 30,
    maxConcurrentSessions: 15,
    queueBatchSize: 5,
  },
  API: {
    maxCandidatesPerDrive: 20,
    maxConcurrentSessions: 8,
    queueBatchSize: 3,
  },
};

/**
 * Global pipeline limit: max total active evaluation jobs across ALL modes.
 * This is a safety net — if total concurrent load exceeds this, new jobs queue
 * but don't get processed until capacity frees up.
 */
export const GLOBAL_MAX_CONCURRENT_JOBS = 25;

/**
 * Queue worker: absolute max jobs to fetch per invocation (hard safety cap).
 * Even if per-mode limits allow more, the worker never processes more than this
 * in a single invocation.
 */
export const QUEUE_WORKER_MAX_BATCH = 10;

/** Get the limit config for a mode, with fallback to LOCAL defaults */
export function getLimitsForMode(mode: string): PilotModeLimits {
  const normalized = (mode || 'LOCAL').toUpperCase();
  return PILOT_LIMITS[normalized] || PILOT_LIMITS['LOCAL'];
}
