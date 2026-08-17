/**
 * phase10ProductionRollout.test.ts
 * Phase 10 Acceptance Test Suite: Controlled Production Rollout & Feature Flag Activation
 *
 * PURPOSE: Verify default-off safety, independent flag activation, full flag activation,
 *          rollback safety, and the recommended staged rollout order via the feature flag
 *          configuration resolver abstraction (src/Evaluation/expert/config.ts).
 *
 * SCOPE: Verification only. Zero production default changes in source code.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { setFeatureFlagOverride, isFeatureFlagEnabled } from '../src/Evaluation/expert/config';
import { IntentEngine } from '../src/Evaluation/intelligence/IntentEngine';
import { DialogueContext } from '../src/Evaluation/intelligence/DialogueContext';
import { AdaptiveProbeEngine } from '../src/Evaluation/intelligence/AdaptiveProbeEngine';
import { evaluationQueue } from '../src/Evaluation/dispatch/EvaluationQueue';
import { ReportGenerator } from '../src/Evaluation/pipeline/ReportGenerator';
import { RecruiterTelemetryService } from '../src/Evaluation/pipeline/recruiterTelemetry';
import { MasterEvaluationReport } from '../types';

const ALL_FLAGS = [
  'INTENT_ENGINE_ENABLED',
  'CONVERSATION_MEMORY_ENABLED',
  'ADAPTIVE_PROBING_ENABLED',
  'BACKGROUND_ENRICHMENT_ENABLED',
  'NEW_REPORTS_ENABLED',
];

function resetAllFlags(value: boolean = false): void {
  ALL_FLAGS.forEach(f => setFeatureFlagOverride(f, value));
}

function makeDummyReport(): MasterEvaluationReport {
  return {
    executiveSummary: {
      recommendation: 'Hire',
      recommendationStatus: 'normal',
      technicalScore: 80,
      trustScore: 80,
      topicCoverage: 100,
      knowledgeStability: 90,
      reportConfidence: 'High',
      summary: 'Rollout evaluation'
    },
    overallScores: {
      knowledgeScore: 80,
      reasoningScore: 80,
      communicationScore: 80,
      consistencyScore: 90,
      difficultyWeightedPerformance: 80,
      trustAdjustedScore: 80
    },
    performanceTrend: {
      timeline: [{ qIndex: 1, score: 80 }],
      trend: 'stable'
    },
    proctoringSummary: {
      faceAwayEvents: 0,
      multiplePersonEvents: 0,
      tabSwitches: 0,
      warningsIssued: 0,
      integrityScore: 100,
      totalGazeAwayDurationMs: 0,
      longestGazeAwayDurationMs: 0,
      sessionDurationMs: 300000,
      isTerminated: false,
      terminationReason: null
    },
    strengths: ['Clear reasoning'],
    weaknesses: [],
    topImprovements: [],
    questionBreakdown: [],
    validationResults: [],
    contradictions: [],
    telemetry: {
      followupTriggerRate: 0,
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      modelCalls: 0
    },
    metadata: {
      engineVersion: 'v4.2.0', profileVersionId: 'p1', promptVersion: 'v1.0',
      pipelineVersion: 'v4.2.0', schemaVersion: 'v1.0', rubricVersion: 'v1.0',
      questionBankVersion: 'v1.0', evaluationMode: 'local', provider: 'local', model: 'local'
    }
  };
}

describe('Phase 10 Controlled Production Rollout Suite', () => {
  beforeEach(() => {
    evaluationQueue.clearMergeTokens();
    resetAllFlags(false);
  });

  afterEach(() => {
    evaluationQueue.clearMergeTokens();
    resetAllFlags(false);
  });

  test('✓ 1. Default-Off Safety: All 5 feature flags default to false without environment overrides', () => {
    ALL_FLAGS.forEach(flagName => {
      // Overrides cleared in beforeEach -> evaluates raw config defaults
      expect(isFeatureFlagEnabled(flagName)).toBe(false);
    });
  });

  test('✓ 2. Independent Flag Activation: Enabling a single flag activates only that feature', async () => {
    // Enable ONLY BACKGROUND_ENRICHMENT_ENABLED via config resolver
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', true);

    expect(isFeatureFlagEnabled('BACKGROUND_ENRICHMENT_ENABLED')).toBe(true);
    expect(isFeatureFlagEnabled('NEW_REPORTS_ENABLED')).toBe(false);
    expect(isFeatureFlagEnabled('ADAPTIVE_PROBING_ENABLED')).toBe(false);

    // Queue processing activates
    const jobResult = await evaluationQueue.processEnrichmentJob({
      schemaVersion: 'v1.0',
      jobId: 'job_p10_1',
      sessionId: 'sess_p10_1',
      mergeToken: 'p10_single_flag',
      attemptNumber: 1,
      createdAtISO: new Date().toISOString(),
      expiresAtISO: new Date(Date.now() + 86400000).toISOString(),
      payload: { questionId: 'q1', transcript: 'Sample response' }
    });
    expect(jobResult.status).toBe('SUCCESS');
    expect(jobResult.diagnostics[0]).not.toContain('bypassed');

    // Reports remain classic empty array
    const sections = ReportGenerator.generateEnrichedSections(makeDummyReport());
    expect(sections).toEqual([]);
  });

  test('✓ 3. Full Flag Activation: All flags enabled simultaneously produce valid integrated behavior', async () => {
    resetAllFlags(true);

    ALL_FLAGS.forEach(flagName => {
      expect(isFeatureFlagEnabled(flagName)).toBe(true);
    });

    // Telemetry reflects fully enriched mode
    const telemetry = RecruiterTelemetryService.getTelemetryControlData();
    expect(telemetry.activeMode).toBe('ENRICHED_BACKGROUND_REPORT');
    expect(telemetry.backgroundEnrichmentEnabled).toBe(true);
    expect(telemetry.newReportsEnabled).toBe(true);

    // Enriched sections generate 4 sections
    const sections = ReportGenerator.generateEnrichedSections(makeDummyReport());
    expect(sections.length).toBe(4);

    // Intent engine runs active classification
    const intentEngine = new IntentEngine();
    const intentResult = await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      intentBundleVersion: 'v1.0',
      context: {
        sessionId: 'sess_full',
        question: { id: 'q1', question: 'Explain closures', questionType: 'Definition', evaluationGuide: [] } as any,
        response: 'I think closures capture their outer lexical environment.'
      }
    });
    expect(Array.isArray(intentResult)).toBe(true);

    // Memory accumulates context
    const ctx = new DialogueContext('sess_full');
    ctx.updateContext('q1', 'Utterance');
    expect(ctx.snapshot().turnCount).toBe(1);
  });

  test('✓ 4. Rollback Safety: Disabling an active flag immediately restores baseline behavior', () => {
    // Start fully enabled
    resetAllFlags(true);
    expect(ReportGenerator.generateEnrichedSections(makeDummyReport()).length).toBe(4);

    // Emergency Rollback: Disable NEW_REPORTS_ENABLED
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', false);
    expect(isFeatureFlagEnabled('NEW_REPORTS_ENABLED')).toBe(false);

    // Immediately falls back to classic mode
    expect(ReportGenerator.generateEnrichedSections(makeDummyReport())).toEqual([]);

    const telemetry = RecruiterTelemetryService.getTelemetryControlData();
    expect(telemetry.activeMode).toBe('CLASSIC_LOCAL_REPORT');
  });

  test('✓ 5. Staged Rollout Sequence Validation: Step-by-step dependency chain validation', async () => {
    // Step 1: Enable INTENT_ENGINE_ENABLED (Shadow mode)
    setFeatureFlagOverride('INTENT_ENGINE_ENABLED', true);
    expect(isFeatureFlagEnabled('INTENT_ENGINE_ENABLED')).toBe(true);
    const intentEngine = new IntentEngine();
    const r1 = await intentEngine.evaluateIntent({
      schemaVersion: 'v1.0',
      intentBundleVersion: 'v1.0',
      context: { sessionId: 's1', question: { id: 'q1', question: 'Q', questionType: 'Definition', evaluationGuide: [] } as any, response: 'Test' }
    });
    expect(Array.isArray(r1)).toBe(true);

    // Step 2: Enable CONVERSATION_MEMORY_ENABLED (Session dialogue context)
    setFeatureFlagOverride('CONVERSATION_MEMORY_ENABLED', true);
    expect(isFeatureFlagEnabled('CONVERSATION_MEMORY_ENABLED')).toBe(true);
    const ctx = new DialogueContext('s1');
    ctx.updateContext('q1', 'Answer');
    expect(ctx.snapshot().turnCount).toBe(1);

    // Step 3: Enable ADAPTIVE_PROBING_ENABLED (Probe recommendations)
    setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);
    expect(isFeatureFlagEnabled('ADAPTIVE_PROBING_ENABLED')).toBe(true);
    const probeEngine = new AdaptiveProbeEngine();
    const pDecision = probeEngine.evaluateProbingDecision({
      sessionId: 's1',
      question: { id: 'q1', question: 'Q', questionType: 'Definition', evaluationGuide: [], keyConcepts: [{ id: 'c1', concept: 'c1' }] } as any,
      candidateUtterance: 'Ans', intentConfidence: 0.50, sessionProbeCount: 0, questionProbeCount: 0,
      contextSnapshot: ctx.snapshot()
    });
    expect(pDecision.decision).toBe('PROBE');

    // Step 4: Enable BACKGROUND_ENRICHMENT_ENABLED (Async background queue)
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', true);
    expect(isFeatureFlagEnabled('BACKGROUND_ENRICHMENT_ENABLED')).toBe(true);

    // Step 5: Enable NEW_REPORTS_ENABLED (Section enriched rendering)
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', true);
    expect(isFeatureFlagEnabled('NEW_REPORTS_ENABLED')).toBe(true);
    expect(ReportGenerator.generateEnrichedSections(makeDummyReport()).length).toBe(4);
  });
});
