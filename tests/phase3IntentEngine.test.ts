/**
 * phase3IntentEngine.test.ts
 * Phase 3 Acceptance Test Suite: Local Intent Engine & Score Deviation Gate
 * Verifies Shadow Mode dual evaluation, multi-dimensional score deviation gate (<= 2.0%),
 * explainable diagnostic logging, and container-based invocation performance (< 15.0 ms).
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { EngineContainer } from '../src/Evaluation/intelligence/EngineContainer';
import { IntentEngine } from '../src/Evaluation/intelligence/IntentEngine';
import { setFeatureFlagOverride, isFeatureFlagEnabled } from '../src/Evaluation/expert/config';
import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { EVALUATION_PROFILES_REGISTRY } from '../src/Evaluation/pipeline/interfaces';
import { Question } from '../types';

describe('Phase 3 Local Intent Engine & Score Deviation Gate Suite', () => {
  const container = EngineContainer.getInstance();
  const intentEngine = container.getIntentEngine() as IntentEngine;

  beforeEach(() => {
    intentEngine.clearDiagnosticLogs();
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
  });

  afterEach(() => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
  });

  test('✓ 1. Flag Disabled: Returns empty array and 100% identical baseline behavior', async () => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
    expect(isFeatureFlagEnabled('INTENT_ENGINE_ENABLED')).toBe(false);

    const results = await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      context: {
        question: { id: 'q1', title: 'React Hooks', category: 'React' },
        response: 'useState manages local component state'
      },
      intentBundleVersion: 'v1.0'
    });

    expect(results).toHaveLength(0);
    expect(intentEngine.getDiagnosticLogs()).toHaveLength(0);
  });

  test('✓ 2. Shadow Mode First: Computes intents & logs telemetry without modifying scores', async () => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);
    expect(isFeatureFlagEnabled('INTENT_ENGINE_ENABLED')).toBe(true);

    const results = await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      context: {
        question: { id: 'q1', title: 'React Hooks', category: 'React', keyConcepts: ['variables'] },
        response: 'useState hook manages component state in functional components'
      },
      intentBundleVersion: 'v1.0'
    });

    expect(results).toHaveLength(1);
    expect(results[0].schemaVersion).toBe('v1.0');

    const logs = intentEngine.getDiagnosticLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].shadowModeActive).toBe(true);
    expect(logs[0].scoreDelta).toBe(0.0);
    expect(logs[0].subScoreDeltas.technicalAccuracyDelta).toBe(0.0);
    expect(logs[0].subScoreDeltas.reasoningDelta).toBe(0.0);
  });

  test('✓ 3. Multi-Dimensional Score Deviation Gate: Overall & sub-scores stay within ±2.0% variance', async () => {
    const question: Question = {
      id: 'q_dev_test',
      question: 'Explain React state management using hooks and Redux.',
      category: 'Technical',
      questionType: 'Definition',
      evaluationGuide: ['useState hook', 'Redux store'],
      knowledgeModel: [
        {
          conceptId: 'variables',
          expected: { definition: true, mechanism: true, purpose: true, useCase: true, limitations: true },
          relationships: [],
          commonMistakes: []
        }
      ]
    };

    const context: EvaluationContext = {
      session: { id: 'sess_dev_101', mode: 'LOCAL' },
      candidate: { name: 'Test Candidate', role: 'Frontend Engineer' },
      question,
      response: 'React state can be managed locally using useState and useEffect hooks, or globally using Redux store.',
      evaluationProfile: EVALUATION_PROFILES_REGISTRY.Technical
    };

    // Run baseline evaluation
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
    const baselineResult = EvaluationCore.evaluateAnswer(context);

    // Run shadow mode intent evaluation
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);
    const shadowResult = EvaluationCore.evaluateAnswer(context);

    expect(typeof baselineResult.contentScore).toBe('number');
    expect(typeof shadowResult.contentScore).toBe('number');

    const contentDelta = Math.abs(shadowResult.contentScore - baselineResult.contentScore);
    const grammarDelta = Math.abs(shadowResult.grammarScore - baselineResult.grammarScore);
    const fluencyDelta = Math.abs(shadowResult.fluencyScore - baselineResult.fluencyScore);

    expect(contentDelta).toBeLessThanOrEqual(2.0);
    expect(grammarDelta).toBeLessThanOrEqual(2.0);
    expect(fluencyDelta).toBeLessThanOrEqual(2.0);
    expect(shadowResult.verdict).toBe(baselineResult.verdict);
  });

  test('✓ 4. Deterministic Edge Case Intent Matching', async () => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);

    // Edge Case A: Empty transcript
    const emptyResults = await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      context: { question: { id: 'q1' }, response: '   ' },
      intentBundleVersion: 'v1.0'
    });
    expect(emptyResults).toHaveLength(0);

    // Edge Case B: One-word response
    const singleWordResults = await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      context: { question: { id: 'q1', category: 'React' }, response: 'hooks' },
      intentBundleVersion: 'v1.0'
    });
    expect(singleWordResults).toHaveLength(1);

    // Edge Case C: Long technical explanation
    const longResponse = 'React hooks allow using state and lifecycle methods without writing ES6 classes. ' +
      'useState provides a tuple containing the current state value and a setter function.';
    const longResults = await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      context: { question: { id: 'q1', keyConcepts: ['variables'] }, response: longResponse },
      intentBundleVersion: 'v1.0'
    });
    expect(longResults).toHaveLength(1);
  });

  test('✓ 5. Explainable Diagnostic Evidence Logging', async () => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);

    await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      context: {
        question: { id: 'q_explain', title: 'Virtual DOM', keyConcepts: ['variables'] },
        response: 'Virtual DOM enables fast reconciliation by comparing lightweight in-memory representation'
      },
      intentBundleVersion: 'v1.0'
    });

    const logs = intentEngine.getDiagnosticLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].shadowModeActive).toBe(true);
  });

  test('✓ 6. Performance Budget: Average evaluation latency under reference environment remains < 15.0 ms', () => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);

    const question: Question = {
      id: 'q_perf',
      question: 'Explain performance optimization in React applications.',
      category: 'Technical',
      questionType: 'Definition'
    };

    const context: EvaluationContext = {
      session: { id: 'sess_perf', mode: 'LOCAL' },
      candidate: { name: 'Perf Candidate', role: 'Senior Engineer' },
      question,
      response: 'React performance can be optimized using React.memo, useCallback, and avoiding unnecessary re-renders.',
      evaluationProfile: EVALUATION_PROFILES_REGISTRY.Technical
    };

    // Warmup JIT loop (5 runs)
    for (let i = 0; i < 5; i++) {
      EvaluationCore.evaluateAnswer(context);
    }

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      EvaluationCore.evaluateAnswer(context);
    }
    const elapsed = performance.now() - start;
    const avgLatency = elapsed / iterations;

    console.log(`[Phase 3 Perf Benchmark] Average evaluation latency: ${avgLatency.toFixed(3)} ms per evaluation`);
    expect(avgLatency).toBeLessThan(15.0);
  });
});
