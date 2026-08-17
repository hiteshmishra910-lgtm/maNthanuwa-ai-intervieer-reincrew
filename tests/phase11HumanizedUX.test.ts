import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../src/Evaluation/pipeline/ReportGenerator';
import { AdaptiveProbeEngine, ProbeDecisionReason } from '../src/Evaluation/intelligence/AdaptiveProbeEngine';
import { setFeatureFlagOverride } from '../src/Evaluation/expert/config';
import { MasterEvaluationReport } from '../types';


describe('Phase 11: Humanized Feedback Presentation Layer & System Alignment', () => {
  const sampleReport: MasterEvaluationReport = {
    executiveSummary: {
      recommendation: 'Hire',
      recommendationStatus: 'normal',
      technicalScore: 82,
      trustScore: 80,
      readinessScore: 85,
      interviewPerformanceScore: 82,
      candidateLevel: 'Advanced',
      growthPotential: 80,
      improvementOpportunity: 18,
      confidenceGap: 0.5,
      answerReliabilityScore: 95,
      topicCoverage: 90,
      knowledgeStability: 88,
      reportConfidence: 'High',
      summary: 'Candidate demonstrated strong technical skills and problem-solving ability.'
    },
    overallScores: {
      knowledgeScore: 85,
      reasoningScore: 80,
      communicationScore: 78,
      consistencyScore: 90,
      difficultyWeightedPerformance: 82,
      trustAdjustedScore: 80,
      readinessScore: 85,
      interviewPerformanceScore: 82,
      growthPotential: 80,
      improvementOpportunity: 18,
      confidenceGap: 0.5,
      answerReliabilityScore: 95
    },
    strengths: ['async_await: Deep understanding of microtask queue scheduling.'],
    weaknesses: ['caching: Missed cache stampede mitigation strategy.'],
    topImprovements: ['Review distributed lock expiry algorithms.'],
    validationResults: [],
    contradictions: [],
    performanceTrend: {
      timeline: [
        { qIndex: 1, score: 80 },
        { qIndex: 2, score: 85 },
        { qIndex: 3, score: 80 },
        { qIndex: 4, score: 85 },
        { qIndex: 5, score: 80 }
      ],
      trend: 'stable'
    },
    proctoringSummary: {
      faceAwayEvents: 0,
      multiplePersonEvents: 0,
      tabSwitches: 0,
      warningsIssued: 0,
      integrityScore: 98,
      totalGazeAwayDurationMs: 0,
      longestGazeAwayDurationMs: 0,
      sessionDurationMs: 1200000,
      isTerminated: false,
      terminationReason: null
    },
    questionBreakdown: [
      {
        questionText: 'Explain how async/await works in JavaScript.',
        difficulty: 'medium',
        score: 8.5,
        userAnswer: 'Async await is syntactic sugar over Promises that runs on the microtask queue of the event loop.',
        feedback: {
          observation: 'Clear explanation of microtask queue interaction.',
          demonstrated: ['async_await', 'event_loop'],
          gaps: [],
          nextSteps: []
        },
        mentionedConcepts: ['async_await', 'event_loop'],
        explainedConcepts: ['async_await'],
        matchedKeyPoints: ['Promise wrapper', 'Microtask queue'],
        missingKeyPoints: [],
        technicalErrors: [],
        transcriptionQualityScore: 98,
        analysis: { coverage: 9, understanding: 9, reasoning: 8, communication: 8 }
      },
      {
        questionText: 'How do index structures optimize SQL query performance?',
        difficulty: 'hard',
        score: 8.0,
        userAnswer: 'B-Tree indexes reduce search time complexity from O(N) to O(log N).',
        feedback: {
          observation: 'Understands B-Tree log N time complexity.',
          demonstrated: ['indexing'],
          gaps: ['write penalty'],
          nextSteps: []
        },
        mentionedConcepts: ['indexing'],
        explainedConcepts: ['indexing'],
        matchedKeyPoints: ['B-Tree search'],
        missingKeyPoints: ['Index write penalty'],
        technicalErrors: [],
        transcriptionQualityScore: 95,
        analysis: { coverage: 8, understanding: 8, reasoning: 8, communication: 8 }
      },
      {
        questionText: 'What is dependency injection?',
        difficulty: 'medium',
        score: 8.0,
        userAnswer: 'Dependency injection passes dependent objects to a client rather than creating them internally.',
        feedback: {
          observation: 'Solid architectural explanation.',
          demonstrated: ['dependency_injection'],
          gaps: [],
          nextSteps: []
        },
        mentionedConcepts: ['dependency_injection'],
        explainedConcepts: ['dependency_injection'],
        matchedKeyPoints: ['Inversion of Control'],
        missingKeyPoints: [],
        technicalErrors: [],
        transcriptionQualityScore: 96,
        analysis: { coverage: 8, understanding: 8, reasoning: 8, communication: 8 }
      },
      {
        questionText: 'How does garbage collection work in V8?',
        difficulty: 'hard',
        score: 8.0,
        userAnswer: 'V8 uses Scavenge for young generation and Mark-Sweep-Compact for old generation.',
        feedback: {
          observation: 'Accurate memory management explanation.',
          demonstrated: ['gc'],
          gaps: [],
          nextSteps: []
        },
        mentionedConcepts: ['gc'],
        explainedConcepts: ['gc'],
        matchedKeyPoints: ['Generational GC'],
        missingKeyPoints: [],
        technicalErrors: [],
        transcriptionQualityScore: 97,
        analysis: { coverage: 8, understanding: 8, reasoning: 8, communication: 8 }
      },
      {
        questionText: 'Explain how closures capture scope in JavaScript.',
        difficulty: 'medium',
        score: 8.0,
        userAnswer: 'Closures maintain references to variables in their outer lexical scope environment.',
        feedback: {
          observation: 'Accurate lexical scope explanation.',
          demonstrated: ['closure'],
          gaps: [],
          nextSteps: []
        },
        mentionedConcepts: ['closure'],
        explainedConcepts: ['closure'],
        matchedKeyPoints: ['Lexical environment'],
        missingKeyPoints: [],
        technicalErrors: [],
        transcriptionQualityScore: 99,
        analysis: { coverage: 8, understanding: 8, reasoning: 8, communication: 8 }
      }
    ],
    telemetry: {
      followupTriggerRate: 0,
      modelCalls: 1
    },
    metadata: {
      engineVersion: 'v4.2.0',
      profileVersionId: 'test-profile',
      promptVersion: 'v2.2.0',
      pipelineVersion: 'v4.2.0',
      schemaVersion: 'v1.0',
      rubricVersion: 'v1.0',
      questionBankVersion: 'v1.0',
      evaluationMode: 'local',
      provider: 'local-heuristic',
      model: 'core-heuristics'
    }
  };

  describe('Component 1: Presentation Layer DTO Transformation & Immutability', () => {
    it('generates an EnrichedReportDTO_v1 with 6 progressive disclosure layers', () => {
      const enriched = ReportGenerator.generateEnrichedReport(sampleReport);

      expect(enriched.schemaVersion).toBe('v1.0');
      expect(enriched.layer1_snapshot.overallScore).toBe(80);
      expect(enriched.layer1_snapshot.matchCategory).toBe('GOOD MATCH');
      expect(enriched.layer2_scorecard.length).toBe(4);
      expect(enriched.layer2_scorecard[0].evidenceCoverage).toBe('HIGH');
      expect(enriched.layer3_strengths.length).toBeGreaterThan(0);
      expect(enriched.layer4_devAreas.length).toBeGreaterThan(0);
      expect(enriched.layer5_evidenceChain.length).toBe(5);
      expect(enriched.layer6_hiringSignal.signal).toBe('CONSIDERATION');
      expect(enriched.layer6_hiringSignal.recommendedNextStep).toBe('Proceed to Technical Round 2');
    });

    it('guarantees 100% byte-level immutability of baseline scores and transcripts', () => {
      const initialSnapshot = JSON.parse(JSON.stringify(sampleReport));

      // Invoke presentation transformer
      ReportGenerator.generateEnrichedReport(sampleReport);
      ReportGenerator.generateEnrichedSections(sampleReport);

      const postSnapshot = JSON.parse(JSON.stringify(sampleReport));
      expect(postSnapshot).toEqual(initialSnapshot);
    });
  });

  describe('Component 2: Adaptive Probing & Anti-Cheating Criteria', () => {
    it('maps concept keys to deterministic curated probes in LOCAL mode', () => {
      const probe1 = AdaptiveProbeEngine.getCuratedProbe('session123', 'async_await');
      const probe2 = AdaptiveProbeEngine.getCuratedProbe('session123', 'async_await');
      const probeDifferent = AdaptiveProbeEngine.getCuratedProbe('session456', 'caching');

      expect(probe1).toBe(probe2); // Deterministic for same sessionId:conceptId
      expect(typeof probe1).toBe('string');
      expect(typeof probeDifferent).toBe('string');
    });

    it('triggers anti-cheating probes as an evidence-gathering mechanism when technical terms lack mechanical details', () => {
      setFeatureFlagOverride('ADAPTIVE_PROBING_ENABLED', true);
      const engine = new AdaptiveProbeEngine();


      const result = engine.evaluateProbingDecision({
        sessionId: 'session_test_1',
        question: { id: 'q1', question: 'Explain event loop', keyConcepts: [{ id: 'event_loop', concept: 'event_loop', importance: 'high' }] },


        candidateUtterance: 'I know event loop and microtasks very well.', // Technical terms without mechanical explanation
        intentConfidence: 0.5,
        sessionProbeCount: 0,
        questionProbeCount: 0
      });

      expect(result.decision).toBe('PROBE');
      expect(result.isAntiCheatingProbe).toBe(true);
      expect(result.triggerRule).toBe('ANTI_CHEATING_MECHANICAL_PROBE');
      expect(result.diagnostics.some(d => d.includes('Anti-cheating probe triggered as evidence-gathering mechanism'))).toBe(true);
    });

    it('returns SKIP with API_PROBE_UNAVAILABLE when API probe generation fails', () => {
      const result = AdaptiveProbeEngine.createApiProbeUnavailableResult(4);

      expect(result.decision).toBe('SKIP');
      expect(result.reason).toBe(ProbeDecisionReason.API_PROBE_UNAVAILABLE);
      expect(result.triggerRule).toBe('API_PROBE_UNAVAILABLE');
    });
  });
});
