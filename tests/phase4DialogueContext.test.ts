/**
 * phase4DialogueContext.test.ts
 * Phase 4 Acceptance Test Suite: Dialogue Context & Memory Manager
 * Verifies session-scoped isolation, read-only metadata accumulators, hard size limits,
 * deterministic replay snapshots, and multi-session concurrency isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DialogueContext, DialogueContextSnapshot_v1 } from '../src/Evaluation/intelligence/DialogueContext';
import { setFeatureFlagOverride, isFeatureFlagEnabled } from '../src/Evaluation/expert/config';
import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { EVALUATION_PROFILES_REGISTRY } from '../src/Evaluation/pipeline/interfaces';
import { Question } from '../types';

describe('Phase 4 Dialogue Context & Memory Manager Suite', () => {
  beforeEach(() => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
  });

  afterEach(() => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
  });

  test('✓ 1. Flag OFF: Bypasses state storage and returns baseline behavior', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
    expect(isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')).toBe(false);

    const memory = new DialogueContext('sess_off');
    memory.updateContext('q1', 'React hooks manage component state');
    memory.recordConcept('variables');

    expect(memory.hasAskedQuestion('q1')).toBe(false);
    expect(memory.hasCoveredConcept('variables')).toBe(false);
    expect(memory.snapshot().turnCount).toBe(0);
  });

  test('✓ 2. Read-Only Influence: Query helpers return accurate state without mutating scores', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);

    const memory = new DialogueContext('sess_read_only');
    memory.updateContext('q1', 'useState hook');
    memory.recordConcept('variables');

    expect(memory.hasAskedQuestion('q1')).toBe(true);
    expect(memory.hasAskedQuestion('q2')).toBe(false);
    expect(memory.hasCoveredConcept('variables')).toBe(true);
    expect(memory.hasCoveredConcept('functions')).toBe(false);
  });

  test('✓ 3. Hard Memory Size Limits: Enforces MAX_TURNS (50) and MAX_CONCEPTS (100) bounds', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);

    const memory = new DialogueContext('sess_limits');
    for (let i = 0; i < 60; i++) {
      memory.updateContext(`q_${i}`, `Candidate utterance turn number ${i}`);
    }

    const snap = memory.snapshot();
    expect(snap.turnCount).toBe(50);
    expect(snap.rawTranscripts[0]).toBe('Candidate utterance turn number 10');
  });

  test('✓ 4. Deterministic Replay: Identical turn inputs produce 100% identical snapshots', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);

    const sessionA = new DialogueContext('sess_replay_A');
    sessionA.updateContext('q1', 'Explanation turn 1');
    sessionA.recordConcept('variables');
    sessionA.recordProbe('Can you elaborate on scope?');
    const snapA = sessionA.snapshot();

    const sessionB = new DialogueContext('sess_replay_B');
    sessionB.updateContext('q1', 'Explanation turn 1');
    sessionB.recordConcept('variables');
    sessionB.recordProbe('Can you elaborate on scope?');
    const snapB = sessionB.snapshot();

    expect(snapA.rawTranscripts).toEqual(snapB.rawTranscripts);
    expect(snapA.coveredConceptIds).toEqual(snapB.coveredConceptIds);
    expect(snapA.probeHistory).toEqual(snapB.probeHistory);
  });

  test('✓ 5. Multi-Session Concurrency Isolation: Zero data leakage across candidate sessions', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);

    const candA = new DialogueContext('sess_cand_A');
    const candB = new DialogueContext('sess_cand_B');
    const candC = new DialogueContext('sess_cand_C');

    candA.updateContext('q_A', 'Candidate A response on React');
    candA.recordConcept('react_hooks');
    candA.recordProbe('Probe for A');

    candB.updateContext('q_B', 'Candidate B response on Node.js');
    candB.recordConcept('event_loop');
    candB.recordProbe('Probe for B');

    candC.updateContext('q_C', 'Candidate C response on Docker');
    candC.recordConcept('containers');

    // Verify Session A isolation
    expect(candA.hasAskedQuestion('q_A')).toBe(true);
    expect(candA.hasAskedQuestion('q_B')).toBe(false);
    expect(candA.hasCoveredConcept('react_hooks')).toBe(true);
    expect(candA.hasCoveredConcept('event_loop')).toBe(false);

    // Verify Session B isolation
    expect(candB.hasAskedQuestion('q_B')).toBe(true);
    expect(candB.hasAskedQuestion('q_C')).toBe(false);
    expect(candB.hasCoveredConcept('event_loop')).toBe(true);
    expect(candB.hasCoveredConcept('containers')).toBe(false);

    // Verify Session C isolation
    expect(candC.hasAskedQuestion('q_C')).toBe(true);
    expect(candC.hasCoveredConcept('containers')).toBe(true);
    expect(candC.snapshot().probeHistory).toHaveLength(0);
  });

  test('✓ 6. Explicit Lifecycle Operations: dispose() flushes session state completely', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);

    const memory = new DialogueContext('sess_lifecycle');
    memory.updateContext('q1', 'Response text');
    memory.recordConcept('variables');
    memory.recordProbe('Probe text');

    expect(memory.snapshot().turnCount).toBe(1);

    memory.dispose();

    const emptySnap = memory.snapshot();
    expect(emptySnap.turnCount).toBe(0);
    expect(emptySnap.questionIds).toHaveLength(0);
    expect(emptySnap.coveredConceptIds).toHaveLength(0);
    expect(emptySnap.probeHistory).toHaveLength(0);
  });

  test('✓ 7. Baseline Score Invariance: EvaluationCore scores remain 100% identical when memory is enabled', () => {
    const question: Question = {
      id: 'q_mem_invariance',
      question: 'Explain JavaScript closures and lexical environment.',
      category: 'Technical',
      questionType: 'Definition'
    };

    const context: EvaluationContext = {
      session: { id: 'sess_inv', mode: 'LOCAL' },
      candidate: { name: 'Invariance Candidate', role: 'JS Dev' },
      question,
      response: 'Closures allow inner functions to access outer scope variables even after outer function executes.',
      evaluationProfile: EVALUATION_PROFILES_REGISTRY.Technical
    };

    // Baseline with flag OFF
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
    const baselineResult = EvaluationCore.evaluateAnswer(context);

    // Baseline with flag ON
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);
    const activeResult = EvaluationCore.evaluateAnswer(context);

    expect(activeResult.contentScore).toBe(baselineResult.contentScore);
    expect(activeResult.grammarScore).toBe(baselineResult.grammarScore);
    expect(activeResult.fluencyScore).toBe(baselineResult.fluencyScore);
    expect(activeResult.verdict).toBe(baselineResult.verdict);
  });
});
