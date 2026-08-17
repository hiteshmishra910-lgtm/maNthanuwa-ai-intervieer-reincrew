/**
 * dispatcherRoutingSnapshot.test.ts
 * Phase 2 Acceptance Test Suite: Dispatcher Routing Snapshot Tests
 * Empirically verifies EvaluationDispatcher mode selection (LOCAL, API, HYBRID)
 * and mode routing integrity without modifying dispatcher implementation.
 */

import { describe, test, expect, vi } from 'vitest';
import { EvaluationDispatcher } from '../src/Evaluation/dispatch/EvaluationDispatcher';
import { EvaluationMode } from '../types';
import { LocalEvaluationStrategy } from '../src/Evaluation/engines/LocalEvaluationStrategy';
import { InteractiveEvaluationStrategy } from '../src/Evaluation/engines/InteractiveEvaluationStrategy';
import { BatchEvaluationStrategy } from '../src/Evaluation/engines/BatchEvaluationStrategy';

describe('Phase 2 Dispatcher Routing Snapshot Verification Suite', () => {
  const dispatcher = EvaluationDispatcher.getInstance();

  test('✓ LOCAL mode routes cleanly to LocalEvaluationStrategy instance', () => {
    const strategy = (dispatcher as any).getStrategy(EvaluationMode.LOCAL);
    expect(strategy).toBeInstanceOf(LocalEvaluationStrategy);
    expect(strategy).toBe(LocalEvaluationStrategy.getInstance());
  });

  test('✓ API mode routes cleanly to InteractiveEvaluationStrategy instance', () => {
    const strategy = (dispatcher as any).getStrategy(EvaluationMode.API);
    expect(strategy).toBeInstanceOf(InteractiveEvaluationStrategy);
    expect(strategy).toBe(InteractiveEvaluationStrategy.getInstance());
  });

  test('✓ HYBRID mode routes cleanly to BatchEvaluationStrategy instance', () => {
    const strategy = (dispatcher as any).getStrategy(EvaluationMode.HYBRID);
    expect(strategy).toBeInstanceOf(BatchEvaluationStrategy);
    expect(strategy).toBe(BatchEvaluationStrategy.getInstance());
  });

  test('✓ Unrecognized/invalid mode throws explicit error in DEV mode', () => {
    expect(() => {
      (dispatcher as any).getStrategy('INVALID_MODE_99');
    }).toThrow(/Unrecognized evaluation mode: "INVALID_MODE_99"/);
  });

  test('✓ Unrecognized mode falls back to LocalEvaluationStrategy in PROD environment', () => {
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as any).DEV = false;
      const strategy = (dispatcher as any).getStrategy('UNKNOWN_PROD_MODE');
      expect(strategy).toBeInstanceOf(LocalEvaluationStrategy);
      expect(strategy).toBe(LocalEvaluationStrategy.getInstance());
    } finally {
      (import.meta.env as any).DEV = originalDev;
    }
  });

  test('✓ EvaluationDispatcher singleton instance immutability', () => {
    const instance1 = EvaluationDispatcher.getInstance();
    const instance2 = EvaluationDispatcher.getInstance();
    expect(instance1).toBe(instance2);
  });
});
