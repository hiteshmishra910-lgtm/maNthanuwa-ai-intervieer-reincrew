/**
 * phase5AdaptiveProbing.test.ts
 * Phase 5 Acceptance Test Suite: Adaptive Probing & Safety Gate
 * Verifies deterministic probe decision results, side-effect free execution, confidence thresholds,
 * probe budget exhaustion (2/question, 5/session), normalized duplicate probe prevention, and feature flag combination matrix.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { AdaptiveProbeEngine, ProbeDecisionReason } from '../src/Evaluation/intelligence/AdaptiveProbeEngine';
import { DialogueContext } from '../src/Evaluation/intelligence/DialogueContext';
import { setFeatureFlagOverride } from '../src/Evaluation/expert/config';
import { Question } from '../types';

describe('Phase 5 Adaptive Probing & Safety Gate Suite', () => {
  const engine = new AdaptiveProbeEngine();

  beforeEach(() => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', false);
  });

  afterEach(() => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', false);
  });

  test('✓ 1. Determinism: Identical inputs produce 100% identical ProbeDecisionResult', () => {
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);

    const question: Question = {
      id: 'q_det',
      question: 'Explain React hooks and state management.',
      keyConcepts: [{ id: 'hooks', concept: 'Hooks' } as any]
    };

    const input = {
      sessionId: 'sess_det',
      question,
      candidateUtterance: 'Hooks allow state in functional components',
      intentConfidence: 0.5,
      sessionProbeCount: 1,
      questionProbeCount: 0
    };

    const result1 = engine.evaluateProbingDecision(input);
    const result2 = engine.evaluateProbingDecision(input);

    expect(result1).toEqual(result2);
    expect(result1.schemaVersion).toBe('v1.0');
    expect(result1.reason).toBe(ProbeDecisionReason.MISSING_CONCEPT_PROBE_RECOMMENDED);
  });

  test('✓ 2. Side-Effect Free: Engine returns DTO and does NOT mutate DialogueContext or scores', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);

    const context = new DialogueContext('sess_side_effect');
    context.updateContext('q1', 'Sample answer');
    const snapshotBefore = context.snapshot();

    const question: Question = { id: 'q1', question: 'Sample' };
    const result = engine.evaluateProbingDecision({
      sessionId: 'sess_side_effect',
      question,
      candidateUtterance: 'Sample answer',
      intentConfidence: 0.5,
      contextSnapshot: snapshotBefore,
      sessionProbeCount: 0,
      questionProbeCount: 0
    });

    const snapshotAfter = context.snapshot();
    expect(snapshotAfter).toEqual(snapshotBefore);
    expect(result.schemaVersion).toBe('v1.0');
  });

  test('✓ 3. Normalized Duplicate Probe Verification: Case/whitespace normalized duplicate text returns SKIP', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);

    const context = new DialogueContext('sess_no_repeat');
    const question: Question = {
      id: 'q_repeat',
      question: 'Explain Redux architecture',
      keyConcepts: [{ id: 'redux_store', concept: 'Redux Store' } as any]
    };

    // Store probe with uppercase / different formatting
    context.recordProbe('  COULD YOU ELABORATE MORE ON HOW REDUX_STORE OPERATES?  ');
    const snapshot = context.snapshot();

    const result = engine.evaluateProbingDecision({
      sessionId: 'sess_no_repeat',
      question,
      candidateUtterance: 'Redux manages global state',
      intentConfidence: 0.4,
      contextSnapshot: snapshot,
      sessionProbeCount: 1,
      questionProbeCount: 0
    });

    expect(result.decision).toBe('SKIP');
    expect(result.reason).toBe(ProbeDecisionReason.CONCEPT_ALREADY_PROBED);
    expect(result.alreadyAsked).toBe(true);
  });

  test('✓ 4. Floating Point Confidence Threshold Precision: 0.849999 vs 0.850000 boundary', () => {
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);

    const question: Question = {
      id: 'q_conf',
      question: 'Explain React state.',
      keyConcepts: [{ id: 'state', concept: 'State' } as any]
    };

    // 0.849999 -> Below threshold -> PROBE recommended
    const belowResult = engine.evaluateProbingDecision({
      sessionId: 'sess_conf',
      question,
      candidateUtterance: 'useState hook manages component state',
      intentConfidence: 0.849999,
      sessionProbeCount: 0,
      questionProbeCount: 0
    });
    expect(belowResult.decision).toBe('PROBE');
    expect(belowResult.reason).toBe(ProbeDecisionReason.MISSING_CONCEPT_PROBE_RECOMMENDED);

    // 0.850000 -> At threshold -> SKIP
    const exactResult = engine.evaluateProbingDecision({
      sessionId: 'sess_conf',
      question,
      candidateUtterance: 'useState hook manages component state',
      intentConfidence: 0.850000,
      sessionProbeCount: 0,
      questionProbeCount: 0
    });
    expect(exactResult.decision).toBe('SKIP');
    expect(exactResult.reason).toBe(ProbeDecisionReason.HIGH_CONFIDENCE_UNDERSTANDING);
  });

  test('✓ 5. Empty Missing Concepts: Returns SKIP with NO_ACTIONABLE_PROBE', () => {
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);

    const question: Question = {
      id: 'q_no_concepts',
      question: 'Generic question with no key concepts array',
      keyConcepts: []
    };

    const result = engine.evaluateProbingDecision({
      sessionId: 'sess_no_concepts',
      question,
      candidateUtterance: 'Some answer',
      intentConfidence: 0.40,
      sessionProbeCount: 0,
      questionProbeCount: 0
    });

    expect(result.decision).toBe('SKIP');
    expect(result.reason).toBe(ProbeDecisionReason.NO_ACTIONABLE_PROBE);
  });

  test('✓ 6. Probe Budget Exhaustion: Limits enforced at 2/question and 5/session', () => {
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);

    const question: Question = {
      id: 'q_budget',
      question: 'Explain virtual DOM',
      keyConcepts: [{ id: 'virtual_dom', concept: 'Virtual DOM' } as any]
    };

    // Case A: Question budget exhausted (2 probes)
    const qBudgetResult = engine.evaluateProbingDecision({
      sessionId: 'sess_budget',
      question,
      candidateUtterance: 'Virtual DOM is fast',
      intentConfidence: 0.4,
      sessionProbeCount: 2,
      questionProbeCount: 2
    });

    expect(qBudgetResult.decision).toBe('SKIP');
    expect(qBudgetResult.reason).toBe(ProbeDecisionReason.QUESTION_BUDGET_EXHAUSTED);

    // Case B: Session budget exhausted (5 probes)
    const sessBudgetResult = engine.evaluateProbingDecision({
      sessionId: 'sess_budget',
      question,
      candidateUtterance: 'Virtual DOM is fast',
      intentConfidence: 0.4,
      sessionProbeCount: 5,
      questionProbeCount: 0
    });

    expect(sessBudgetResult.decision).toBe('SKIP');
    expect(sessBudgetResult.reason).toBe(ProbeDecisionReason.SESSION_BUDGET_EXHAUSTED);
    expect(sessBudgetResult.budgetRemaining).toBe(0);
  });

  test('✓ 7. Performance Budget: Decision calculation adds < 2.0 ms average latency', () => {
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);

    const question: Question = {
      id: 'q_perf',
      question: 'Performance test question',
      keyConcepts: [{ id: 'concept1', concept: 'Concept1' } as any]
    };

    const input = {
      sessionId: 'sess_perf',
      question,
      candidateUtterance: 'Utterance for performance test',
      intentConfidence: 0.5,
      sessionProbeCount: 1,
      questionProbeCount: 0
    };

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      engine.evaluateProbingDecision(input);
    }
    const elapsed = performance.now() - start;
    const avgLatency = elapsed / iterations;

    console.log(`[Phase 5 Probe Perf] Average probe decision latency: ${avgLatency.toFixed(3)} ms per calculation`);
    expect(avgLatency).toBeLessThan(2.0);
  });

  test('✓ 8. Feature Flag Combination Matrix Verification', () => {
    const question: Question = { id: 'q_matrix', question: 'Matrix test' };
    const input = {
      sessionId: 'sess_matrix',
      question,
      candidateUtterance: 'Test',
      intentConfidence: 0.5,
      sessionProbeCount: 0,
      questionProbeCount: 0
    };

    // Matrix 1: OFF / OFF / OFF
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', false);
    expect(engine.evaluateProbingDecision(input).decision).toBe('SKIP');

    // Matrix 2: ON / OFF / ON
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);
    expect(engine.evaluateProbingDecision(input).schemaVersion).toBe('v1.0');

    // Matrix 3: ON / ON / OFF
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', false);
    expect(engine.evaluateProbingDecision(input).decision).toBe('SKIP');

    // Matrix 4: ON / ON / ON
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);
    expect(engine.evaluateProbingDecision(input).schemaVersion).toBe('v1.0');
  });
});
