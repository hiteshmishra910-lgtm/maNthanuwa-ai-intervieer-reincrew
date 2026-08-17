/**
 * DialogueContext.ts (Phase 4 Dialogue Context & Memory Manager)
 * Implements session-scoped, read-only dialogue context memory management
 * behind CONVERSATION_MEMORY_ENABLED feature flag.
 * Renamed from ConversationMemory per ADR-001.
 * Default behavior: Strictly session-scoped memory accumulator with zero score mutation capability.
 */

import { SessionContextPayloadDTO_v1, IDialogueContext } from '../pipeline/interfaces';
import { isFeatureFlagEnabled } from '../expert/config';

export interface DialogueContextSnapshot_v1 {
  readonly schemaVersion: 'v1.0';
  readonly sessionId: string;
  readonly turnCount: number;
  readonly rawTranscripts: readonly string[];
  readonly questionIds: readonly string[];
  readonly coveredConceptIds: readonly string[];
  readonly probeHistory: readonly string[];
  readonly mentionedTechnologies: readonly string[];
  readonly createdAtISO: string;
}

export class DialogueContext implements IDialogueContext {
  public readonly version = 'v1' as const;
  public readonly stabilityTier = 'Internal' as const;

  private static readonly MAX_TURNS = 50;
  private static readonly MAX_PROBES = 20;
  private static readonly MAX_CONCEPTS = 100;

  private rawTranscripts: string[] = [];
  private questionIds: string[] = [];
  private coveredConceptIds: string[] = [];
  private probeHistory: string[] = [];
  private mentionedTechnologies: string[] = [];

  constructor(public readonly sessionId: string) {}

  /**
   * Appends candidate turn and metadata to session context.
   * Enforces hard memory boundaries (MAX_TURNS, MAX_CONCEPTS).
   */
  public updateContext(questionId: string, candidateUtterance: string): void {
    if (!isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')) {
      return;
    }

    if (this.rawTranscripts.length >= DialogueContext.MAX_TURNS) {
      this.rawTranscripts.shift();
    }
    this.rawTranscripts.push(candidateUtterance);

    if (!this.questionIds.includes(questionId)) {
      this.questionIds.push(questionId);
    }
  }

  /**
   * Records concept ID as covered in session memory.
   */
  public recordConcept(conceptId: string): void {
    if (!isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')) {
      return;
    }
    if (!this.coveredConceptIds.includes(conceptId)) {
      if (this.coveredConceptIds.length >= DialogueContext.MAX_CONCEPTS) {
        this.coveredConceptIds.shift();
      }
      this.coveredConceptIds.push(conceptId);
    }
  }

  /**
   * Records follow-up probe text in probe history.
   */
  public recordProbe(probeText: string): void {
    if (!isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')) {
      return;
    }
    if (this.probeHistory.length >= DialogueContext.MAX_PROBES) {
      this.probeHistory.shift();
    }
    this.probeHistory.push(probeText);
  }

  /**
   * Answers query: Has concept already been covered in this session?
   */
  public hasCoveredConcept(conceptId: string): boolean {
    if (!isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')) {
      return false;
    }
    return this.coveredConceptIds.includes(conceptId);
  }

  /**
   * Answers query: Has question already been presented in this session?
   */
  public hasAskedQuestion(questionId: string): boolean {
    if (!isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')) {
      return false;
    }
    return this.questionIds.includes(questionId);
  }

  /**
   * Produces an immutable, deterministic snapshot of session memory.
   */
  public snapshot(): DialogueContextSnapshot_v1 {
    return {
      schemaVersion: 'v1.0',
      sessionId: this.sessionId,
      turnCount: this.rawTranscripts.length,
      rawTranscripts: [...this.rawTranscripts],
      questionIds: [...this.questionIds],
      coveredConceptIds: [...this.coveredConceptIds],
      probeHistory: [...this.probeHistory],
      mentionedTechnologies: [...this.mentionedTechnologies],
      createdAtISO: 'DETERMINISTIC_SNAPSHOT_TIMESTAMP'
    };
  }

  /**
   * Returns snapshot payload conforming to SessionContextPayloadDTO_v1.
   */
  public getContextPayload(): SessionContextPayloadDTO_v1 {
    return {
      schemaVersion: 'v1.0',
      sessionId: this.sessionId,
      rawTranscripts: [...this.rawTranscripts],
      mentionedTechnologies: [...this.mentionedTechnologies],
      claimedExperience: [],
      previousExplanations: [],
      unansweredProbes: []
    };
  }

  /**
   * Flushes in-memory session state.
   * Invoked on session termination.
   */
  public clearSessionMemory(): void {
    this.rawTranscripts = [];
    this.questionIds = [];
    this.coveredConceptIds = [];
    this.probeHistory = [];
    this.mentionedTechnologies = [];
  }

  /**
   * Explicit disposal alias for lifecycle cleanup.
   */
  public dispose(): void {
    this.clearSessionMemory();
  }
}
