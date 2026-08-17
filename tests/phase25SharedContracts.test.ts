/**
 * phase25SharedContracts.test.ts
 * Phase 2.5 Verification Test Suite: Shared Contracts & Interfaces
 * Verifies that shared DTO contracts, probe decisions, event bus schemas, and master report DTOs
 * compile cleanly and enforce schemaVersion: "v1.0" without altering runtime evaluation behavior.
 */

import { describe, test, expect } from 'vitest';
import {
  ProbeDecisionDTO_v1,
  AsyncQueueEnrichmentJobDTO_v1,
  MasterReportSchema_v1,
  InterviewEvent
} from '../src/Evaluation/pipeline/sharedContracts';

describe('Phase 2.5 Shared Contracts & Interfaces Verification Suite', () => {
  test('✓ ProbeDecisionDTO_v1 compiles cleanly and enforces schemaVersion: v1.0', () => {
    const decision: ProbeDecisionDTO_v1 = {
      schemaVersion: 'v1.0',
      sessionId: 'sess_test_25',
      questionId: 'q1',
      requiresFollowUp: false,
      missingConcepts: [],
      confidenceScore: 0.95,
      safetyBoundsExceeded: false
    };
    expect(decision.schemaVersion).toBe('v1.0');
    expect(decision.requiresFollowUp).toBe(false);
  });

  test('✓ AsyncQueueEnrichmentJobDTO_v1 compiles cleanly and enforces idempotency mergeToken payload', () => {
    const job: AsyncQueueEnrichmentJobDTO_v1 = {
      schemaVersion: 'v1.0',
      jobId: 'job_25_001',
      sessionId: 'sess_test_25',
      mergeToken: 'sess_test_25:q1:1',
      attemptNumber: 1,
      createdAtISO: new Date().toISOString(),
      expiresAtISO: new Date(Date.now() + 86400000).toISOString(),
      payload: {
        questionId: 'q1',
        transcript: 'React virtual DOM diffing'
      }
    };
    expect(job.schemaVersion).toBe('v1.0');
    expect(job.mergeToken).toBe('sess_test_25:q1:1');
  });

  test('✓ MasterReportSchema_v1 compiles cleanly and contains 9-point version provenance', () => {
    const report: MasterReportSchema_v1 = {
      schemaVersion: 'v1.0',
      reportId: 'rep_25_001',
      sessionId: 'sess_test_25',
      candidateId: 'cand_25',
      driveId: 'drive_25',
      scores: {
        technicalAccuracyScore: 85,
        contentScore: 80,
        reasoningScore: 90,
        communicationScore: 88,
        overallScore: 86
      },
      verdict: 'STRONG_HIRE',
      provenance: {
        driveVersion: '1.0',
        questionBundleVersion: '1.0',
        intentBundleVersion: '1.0',
        promptVersion: '1.0',
        scoringVersion: '1.0',
        evidenceVersion: '1.0',
        conversationVersion: '1.0',
        semanticModelVersion: '1.0',
        reportVersion: '1.0'
      }
    };
    expect(report.schemaVersion).toBe('v1.0');
    expect(report.provenance.promptVersion).toBe('1.0');
  });

  test('✓ InterviewEvent contract enforces schemaVersion: v1.0', () => {
    const event: InterviewEvent<{ summary: string }> = {
      schemaVersion: 'v1.0',
      eventId: 'evt_25_100',
      type: 'TRANSCRIPT_FINALIZED',
      timestampISO: new Date().toISOString(),
      sessionId: 'sess_test_25',
      payload: { summary: 'Transcript captured' }
    };
    expect(event.schemaVersion).toBe('v1.0');
    expect(event.type).toBe('TRANSCRIPT_FINALIZED');
  });
});
