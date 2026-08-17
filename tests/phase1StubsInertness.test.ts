/**
 * phase1StubsInertness.test.ts
 * Phase 1 Verification Test Suite
 * Proves that Phase 1 component stubs compile cleanly and remain 100% inert and dormant
 * when feature flags are set to false (default baseline state).
 */

import { describe, test, expect } from 'vitest';
import { IntentEngine } from '../src/Evaluation/intelligence/IntentEngine';
import { EvidenceEngine } from '../src/Evaluation/intelligence/EvidenceEngine';
import { ReasoningEngine } from '../src/Evaluation/intelligence/ReasoningEngine';
import { DialogueContext } from '../src/Evaluation/intelligence/DialogueContext';
import { isFeatureFlagEnabled, isExpertEngineEnabled, setFeatureFlagOverride } from '../src/Evaluation/expert/config';

describe('Phase 1 Infrastructure Component Stubs Inertness Suite', () => {
  test('✓ IntentEngine returns empty array when INTENT_ENGINE_ENABLED is false', async () => {
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', false);
    expect(isFeatureFlagEnabled('INTENT_ENGINE_ENABLED')).toBe(false);
    const engine = new IntentEngine();
    const results = await engine.evaluateIntent({
      schemaVersion: 'v1.0',
      context: {} as any,
      intentBundleVersion: 'v1.0'
    });
    expect(results).toHaveLength(0);
  });

  test('✓ EvidenceEngine returns empty evidence graph when NEW_REPORTS_ENABLED is false', async () => {
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', false);
    expect(isFeatureFlagEnabled('NEW_REPORTS_ENABLED')).toBe(false);
    const engine = new EvidenceEngine();
    const graph = await engine.extractEvidence({
      schemaVersion: 'v1.0',
      context: {} as any,
      intentResults: []
    });
    expect(graph.schemaVersion).toBe('v1.0');
    expect(graph.demonstratedQuotes).toHaveLength(0);
    expect(graph.missingGaps).toHaveLength(0);
  });

  test('✓ ReasoningEngine returns null when EXPERT_ENGINE_ENABLED is false', async () => {
    setFeatureFlagOverride('EXPERT_ENGINE_ENABLED', false);
    expect(isExpertEngineEnabled()).toBe(false);
    const engine = new ReasoningEngine();
    const result = await engine.analyzeReasoning({
      schemaVersion: 'v1.0',
      candidateUtterance: 'test answer',
      questionId: 'q1'
    });
    expect(result).toBeNull();
  });

  test('✓ DialogueContext bypasses context state updates when CONVERSATION_MEMORY_ENABLED is false', () => {
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', false);
    expect(isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')).toBe(false);
    const memory = new DialogueContext('session_test_101');
    memory.updateContext('q1', 'React uses virtual DOM');
    const payload = memory.getContextPayload();
    expect(payload.schemaVersion).toBe('v1.0');
    expect(payload.rawTranscripts).toHaveLength(0);
  });
});
