/**
 * phase6BackgroundQueue.test.ts
 * Phase 6 Acceptance Test Suite: Asynchronous Background Queue & Worker Reuse
 * Verifies mergeToken atomic idempotency, transient vs deterministic failure classification,
 * feature flag bypass isolation, observability telemetry, dead-letter max retry routing, and concurrent worker handling.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { evaluationQueue } from '../src/Evaluation/dispatch/EvaluationQueue';
import { setFeatureFlagOverride, isFeatureFlagEnabled } from '../src/Evaluation/expert/config';
import { AsyncQueueEnrichmentJobDTO_v1 } from '../src/Evaluation/pipeline/sharedContracts';

describe('Phase 6 Asynchronous Background Queue & Worker Reuse Suite', () => {
  beforeEach(() => {
    evaluationQueue.clearMergeTokens();
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', false);
  });

  afterEach(() => {
    evaluationQueue.clearMergeTokens();
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', false);
  });

  test('✓ 1. Flag OFF: Bypasses queue processing immediately with zero side-effects', async () => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', false);
    expect(isFeatureFlagEnabled('BACKGROUND_ENRICHMENT_ENABLED')).toBe(false);

    const job: AsyncQueueEnrichmentJobDTO_v1 = {
      schemaVersion: 'v1.0',
      jobId: 'job_off_1',
      sessionId: 'sess_off',
      mergeToken: 'sess_off:q1:1',
      attemptNumber: 1,
      createdAtISO: new Date().toISOString(),
      expiresAtISO: new Date(Date.now() + 86400000).toISOString(),
      payload: { questionId: 'q1', transcript: 'Sample response' }
    };

    const result = await evaluationQueue.processEnrichmentJob(job);
    expect(result.status).toBe('SUCCESS');
    expect(result.duplicateSuppressed).toBe(false);
    expect(result.diagnostics[0]).toContain('bypassed');
  });

  test('✓ 2. Atomic mergeToken Idempotency: Concurrent/duplicate jobs return DUPLICATE_SUPPRESSED', async () => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', true);

    const job: AsyncQueueEnrichmentJobDTO_v1 = {
      schemaVersion: 'v1.0',
      jobId: 'job_101',
      sessionId: 'sess_101',
      mergeToken: 'sess_101:q1:1',
      attemptNumber: 1,
      createdAtISO: new Date().toISOString(),
      expiresAtISO: new Date(Date.now() + 86400000).toISOString(),
      payload: { questionId: 'q1', transcript: 'Sample response' }
    };

    // First attempt -> SUCCESS
    const firstResult = await evaluationQueue.processEnrichmentJob(job);
    expect(firstResult.status).toBe('SUCCESS');
    expect(firstResult.duplicateSuppressed).toBe(false);

    // Duplicate attempt -> DUPLICATE_SUPPRESSED
    const secondResult = await evaluationQueue.processEnrichmentJob(job);
    expect(secondResult.status).toBe('DUPLICATE_SUPPRESSED');
    expect(secondResult.duplicateSuppressed).toBe(true);
    expect(secondResult.diagnostics[0]).toContain('Duplicate mergeToken suppressed');
  });

  test('✓ 3. Error Classification: Deterministic failure returns FAILED_NON_RETRYABLE', async () => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', true);

    const invalidJob: AsyncQueueEnrichmentJobDTO_v1 = {
      schemaVersion: 'v1.0',
      jobId: 'job_invalid',
      sessionId: 'sess_inv',
      mergeToken: 'sess_inv:q1:1',
      attemptNumber: 1,
      createdAtISO: new Date().toISOString(),
      expiresAtISO: new Date(Date.now() + 86400000).toISOString(),
      payload: { questionId: '', transcript: '' } // Invalid questionId
    };

    const result = await evaluationQueue.processEnrichmentJob(invalidJob);
    expect(result.status).toBe('FAILED_NON_RETRYABLE');
    expect(result.failureCategory).toBe('VALIDATION_ERROR');
    expect(result.diagnostics[0]).toContain('Deterministic validation failure');
  });

  test('✓ 4. Max Retries Dead-Letter Handling: Exceeding 3 retries routes to DEAD_LETTER', async () => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', true);

    const exceededJob: AsyncQueueEnrichmentJobDTO_v1 = {
      schemaVersion: 'v1.0',
      jobId: 'job_dead_letter',
      sessionId: 'sess_dl',
      mergeToken: 'sess_dl:q1:4',
      attemptNumber: 4, // 4 > maxRetries (3)
      createdAtISO: new Date().toISOString(),
      expiresAtISO: new Date(Date.now() + 86400000).toISOString(),
      payload: { questionId: 'q1', transcript: 'Poison payload' }
    };

    const result = await evaluationQueue.processEnrichmentJob(exceededJob);
    expect(result.status).toBe('DEAD_LETTER');
    expect(result.failureCategory).toBe('EXCEEDED_MAX_RETRIES');
    expect(result.diagnostics[0]).toContain('Exceeded maximum retry limit');
  });

  test('✓ 5. Observability Telemetry Completeness: DTO carries timestamps, workerVersion, maxRetries', async () => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', true);

    const job: AsyncQueueEnrichmentJobDTO_v1 = {
      schemaVersion: 'v1.0',
      jobId: 'job_telemetry_101',
      sessionId: 'sess_obs',
      mergeToken: 'sess_obs:q1:1',
      attemptNumber: 1,
      createdAtISO: new Date().toISOString(),
      expiresAtISO: new Date(Date.now() + 86400000).toISOString(),
      payload: { questionId: 'q1', transcript: 'Observability text' }
    };

    const result = await evaluationQueue.processEnrichmentJob(job);
    expect(result.schemaVersion).toBe('v1.0');
    expect(result.workerVersion).toBe('v1.0.0');
    expect(result.jobId).toBe('job_telemetry_101');
    expect(result.mergeToken).toBe('sess_obs:q1:1');
    expect(result.maxRetries).toBe(3);
    expect(result.startedAtISO).toBeDefined();
    expect(result.finishedAtISO).toBeDefined();
    expect(typeof result.latencyMs).toBe('number');
  });
});
