/**
 * sharedContracts.ts (Phase 2.5 Shared Contracts & Interfaces)
 * Immutable shared contracts, DTOs, event bus interfaces, and dependency injection specs.
 * Purely structural contract milestone: Zero runtime behavioral changes.
 */

import {
  IntentInputDTO_v1,
  IntentResultDTO_v1,
  EvidenceInputDTO_v1,
  EvidenceGraphDTO_v1,
  SessionContextPayloadDTO_v1
} from './interfaces';

/* ============================================================================
 * 1. Adaptive Probing Decision Contract (schemaVersion: "v1.0")
 * ============================================================================ */

export interface ProbeDecisionDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly sessionId: string;
  readonly questionId: string;
  readonly requiresFollowUp: boolean;
  readonly missingConcepts: readonly string[];
  readonly followUpQuestionText?: string;
  readonly confidenceScore: number;
  readonly safetyBoundsExceeded: boolean;
}

/* ============================================================================
 * 2. Background Queue Enrichment Job Payload DTO (schemaVersion: "v1.0")
 * ============================================================================ */

export interface AsyncQueueEnrichmentJobDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly jobId: string;
  readonly sessionId: string;
  readonly mergeToken: string; // sessionId:questionId:attemptNumber
  readonly attemptNumber: number;
  readonly createdAtISO: string;
  readonly expiresAtISO: string;
  readonly payload: Readonly<{
    readonly questionId: string;
    readonly transcript: string;
    readonly intentResults?: readonly IntentResultDTO_v1[];
    readonly evidenceGraph?: Readonly<EvidenceGraphDTO_v1>;
  }>;
}

/* ============================================================================
 * 3. Enriched Report Section DTO Contract (schemaVersion: "v1.0") - Phase 8
 * ============================================================================ */

export interface EnrichedReportSectionDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly summaryMarkdown: string;
  readonly keyHighlights: readonly string[];
  readonly sectionScore: number;
}

/* ============================================================================
 * 4. Immutable Master Report Schema Contract (schemaVersion: "v1.0")
 * ============================================================================ */

export interface MasterReportSchema_v1 {
  readonly schemaVersion: 'v1.0';
  readonly reportId: string;
  readonly sessionId: string;
  readonly candidateId: string;
  readonly driveId: string;
  readonly scores: Readonly<{
    readonly technicalAccuracyScore: number;
    readonly contentScore: number;
    readonly reasoningScore: number;
    readonly communicationScore: number;
    readonly overallScore: number;
  }>;
  readonly verdict: 'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'LEAN_NO_HIRE' | 'NO_HIRE';
  readonly provenance: Readonly<{
    readonly driveVersion: string;
    readonly questionBundleVersion: string;
    readonly intentBundleVersion: string;
    readonly promptVersion: string;
    readonly scoringVersion: string;
    readonly evidenceVersion: string;
    readonly conversationVersion: string;
    readonly semanticModelVersion: string;
    readonly reportVersion: string;
  }>;
}

/* ============================================================================
 * 5. Shared Interview Event Bus Interface Contract (schemaVersion: "v1.0")
 * ============================================================================ */

export type InterviewEventType =
  | 'INTERVIEW_STARTED'
  | 'QUESTION_PRESENTED'
  | 'TRANSCRIPT_FINALIZED'
  | 'INTENT_EVALUATED'
  | 'EVIDENCE_EXTRACTED'
  | 'SCORE_COMPUTED'
  | 'PROBE_TRIGGERED'
  | 'SESSION_FINALIZED'
  | 'ENRICHMENT_ENQUEUED'
  | 'REPORT_RENDERED';

export interface InterviewEvent<T = unknown> {
  readonly schemaVersion: 'v1.0';
  readonly eventId: string;
  readonly type: InterviewEventType;
  readonly timestampISO: string;
  readonly sessionId: string;
  readonly payload: Readonly<T>;
}

export interface IInterviewEventBus {
  readonly schemaVersion: 'v1.0';
  publish<T>(event: InterviewEvent<T>): void;
  subscribe<T>(eventType: InterviewEventType, handler: (event: InterviewEvent<T>) => void): void;
}

/* ============================================================================
 * 6. Dependency Injection Container Interface Contract
 * ============================================================================ */

export interface IEvaluationEngineContainer {
  readonly schemaVersion: 'v1.0';
  getIntentEngine(): unknown;
  getEvidenceEngine(): unknown;
  getDialogueContext(sessionId: string): unknown;
  getSemanticProvider(): unknown;
}
