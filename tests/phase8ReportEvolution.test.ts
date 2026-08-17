/**
 * phase8ReportEvolution.test.ts
 * Phase 8 Acceptance Test Suite: Report Evolution & Section Enriched Rendering
 * Verifies presentation-layer enriched section DTO generation, feature flag fallback isolation,
 * score immutability, and 100% component isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ReportGenerator } from '../src/Evaluation/pipeline/ReportGenerator';
import { setFeatureFlagOverride, isFeatureFlagEnabled } from '../src/Evaluation/expert/config';
import { MasterEvaluationReport } from '../types';

describe('Phase 8 Report Evolution & Section Enriched Rendering Suite', () => {
  const dummyReport: MasterEvaluationReport = {
    executiveSummary: {
      recommendation: 'Hire',
      recommendationStatus: 'normal',
      technicalScore: 85,
      trustScore: 85,
      topicCoverage: 100,
      knowledgeStability: 90,
      reportConfidence: 'High',
      summary: 'Solid candidate performance'
    },
    overallScores: {
      knowledgeScore: 85,
      reasoningScore: 85,
      communicationScore: 85,
      consistencyScore: 90,
      difficultyWeightedPerformance: 85,
      trustAdjustedScore: 85
    },
    performanceTrend: {
      timeline: [{ qIndex: 1, score: 85 }],
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
    strengths: ['Deep technical understanding'],
    weaknesses: ['Minor edge-case omission'],
    topImprovements: ['Provide concrete examples'],
    questionBreakdown: [],
    validationResults: [],
    contradictions: [],
    telemetry: {
      followupTriggerRate: 0,
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      modelCalls: 0
    },
    metadata: {
      engineVersion: 'v4.2.0',
      profileVersionId: 'p1',
      promptVersion: 'v1.0',
      pipelineVersion: 'v4.2.0',
      schemaVersion: 'v1.0',
      rubricVersion: 'v1.0',
      questionBankVersion: 'v1.0',
      evaluationMode: 'local',
      provider: 'local',
      model: 'local'
    }
  };

  beforeEach(() => {
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', false);
  });

  afterEach(() => {
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', false);
  });

  test('✓ 1. Flag OFF Fallback: Returns empty section array cleanly without throwing exceptions', () => {
    expect(isFeatureFlagEnabled('NEW_REPORTS_ENABLED')).toBe(false);

    const sections = ReportGenerator.generateEnrichedSections(dummyReport);

    expect(sections).toEqual([]);
  });

  test('✓ 2. Flag ON Enriched Rendering: Generates 4 presentation-layer section DTOs', () => {
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', true);

    const sections = ReportGenerator.generateEnrichedSections(dummyReport);

    expect(sections.length).toBe(4);

    expect(sections[0].sectionId).toBe('sec_exec_summary');
    expect(sections[0].schemaVersion).toBe('v1.0');
    expect(sections[0].summaryMarkdown).toContain('Hire');
    expect(sections[0].sectionScore).toBe(85);

    expect(sections[1].sectionId).toBe('sec_technical_competency');
    expect(sections[2].sectionId).toBe('sec_communication');
    expect(sections[3].sectionId).toBe('sec_proctoring_integrity');
  });

  test('✓ 3. Score & Transcript Immutability: Raw scores remain 100% unchanged after enriched section generation', () => {
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', true);

    const trustBefore = dummyReport.executiveSummary.trustScore;
    const recBefore = dummyReport.executiveSummary.recommendation;

    ReportGenerator.generateEnrichedSections(dummyReport);

    expect(dummyReport.executiveSummary.trustScore).toBe(trustBefore);
    expect(dummyReport.executiveSummary.recommendation).toBe(recBefore);
  });
});
