import { MasterEvaluationReport, ProctoringReport, EnrichedReportDTO_v1, EnrichedCompetencyScorecard_v1, EnrichedStrengthItem_v1, EnrichedDevelopmentItem_v1, EnrichedHiringSignal_v1 } from '../../../types';
import { AnswerRecord } from './types';
import { computeRecommendation } from "../../../shared/scoringPolicy";
import { EVALUATION_PROMPT_VERSION } from '../../shared/evaluationConstants';
import { isFeatureFlagEnabled } from '../expert/config';

export interface AIAnalysis {
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  topImprovements?: string[];
  contradictions?: any[];
}

export class ReportGenerator {
  /**
   * Phase 11 Full 6-Layer Enriched Report Transformer.
   * Pure presentation layer transformer with feedbackSchemaVersion: 'v1.0'.
   * Purely read-only; never mutates baseline scores, transcripts, or evaluation records.
   */
  static generateEnrichedReport(report: MasterEvaluationReport): EnrichedReportDTO_v1 {
    const overallScore = report.overallScores?.trustAdjustedScore ?? report.executiveSummary?.trustScore ?? report.executiveSummary?.technicalScore ?? 0;
    const questionCount = report.questionBreakdown?.length || 0;
    const evidenceCoverage: 'HIGH' | 'MEDIUM' | 'LOW' = questionCount >= 5 ? 'HIGH' : questionCount >= 3 ? 'MEDIUM' : 'LOW';

    const getRatingLevel = (score: number): 'EXPERT' | 'STRONG' | 'COMPETENT' | 'DEVELOPING' | 'NEEDS_WORK' => {
      if (score >= 90) return 'EXPERT';
      if (score >= 75) return 'STRONG';
      if (score >= 60) return 'COMPETENT';
      if (score >= 40) return 'DEVELOPING';
      return 'NEEDS_WORK';
    };

    const matchCategory: 'STRONG MATCH' | 'GOOD MATCH' | 'POTENTIAL MATCH' | 'DEVELOPMENT NEEDED' =
      overallScore >= 85 ? 'STRONG MATCH' :
      overallScore >= 70 ? 'GOOD MATCH' :
      overallScore >= 50 ? 'POTENTIAL MATCH' : 'DEVELOPMENT NEEDED';

    const scorecard: EnrichedCompetencyScorecard_v1[] = [
      {
        competencyKey: 'knowledge',
        title: 'Technical Knowledge Depth',
        score: report.overallScores?.knowledgeScore ?? 0,
        ratingLevel: getRatingLevel(report.overallScores?.knowledgeScore ?? 0),
        evidenceCoverage,
        evidenceSummary: `Evaluated technical accuracy and concept coverage across ${questionCount} questions.`
      },
      {
        competencyKey: 'reasoning',
        title: 'Reasoning & Analytical Thinking',
        score: report.overallScores?.reasoningScore ?? 0,
        ratingLevel: getRatingLevel(report.overallScores?.reasoningScore ?? 0),
        evidenceCoverage,
        evidenceSummary: `Assessed logical structure, mechanism explanations, and edge-case awareness.`
      },
      {
        competencyKey: 'problem_solving',
        title: 'Difficulty-Weighted Performance',
        score: report.overallScores?.difficultyWeightedPerformance ?? report.overallScores?.knowledgeScore ?? 0,
        ratingLevel: getRatingLevel(report.overallScores?.difficultyWeightedPerformance ?? 0),
        evidenceCoverage,
        evidenceSummary: `Weighted performance taking problem complexity into account.`
      },
      {
        competencyKey: 'communication',
        title: 'Communication & Structuring',
        score: report.overallScores?.communicationScore ?? 0,
        ratingLevel: getRatingLevel(report.overallScores?.communicationScore ?? 0),
        evidenceCoverage,
        evidenceSummary: `Measured articulate delivery, pause rate, and explanation structure.`
      }
    ];

    const strengths: EnrichedStrengthItem_v1[] = (report.strengths || []).map((str, idx) => ({
      skillName: str.split(':')[0] || str,
      mechanismExplained: str.includes(':') ? str.split(':')[1].trim() : str,
      businessImpact: "Demonstrates practical competence and clean execution.",
      evidenceQuestionIndex: idx < (report.questionBreakdown?.length || 0) ? idx + 1 : 1
    }));

    const devAreas: EnrichedDevelopmentItem_v1[] = (report.weaknesses || report.topImprovements || []).map((weak, idx) => ({
      areaName: weak.split(':')[0] || weak,
      tradeoffMissed: weak.includes(':') ? weak.split(':')[1].trim() : weak,
      actionablePracticeFormula: `Focus practice on ${weak.split(':')[0] || weak} trade-offs and implementation edge cases.`,
      evidenceQuestionIndex: idx < (report.questionBreakdown?.length || 0) ? idx + 1 : 1
    }));

    const rec = report.executiveSummary?.recommendation || 'Consider';
    const targetProfile = (report.metadata as any)?.targetSeniorityLevel || (report.metadata as any)?.target_seniority_level || 'FRESHER';

    const getReadinessForProfile = (score: number, profile: string): string => {
      if (profile === 'COLLEGE_STUDENT') {
        if (score >= 70) return 'Exceeds Student Baseline';
        if (score >= 50) return 'Strong Learning Potential';
        return 'Building Fundamentals';
      }
      if (profile === 'SENIOR_LEAD') {
        if (score >= 85) return 'Senior Architect Ready';
        if (score >= 70) return 'Mid-to-Senior Level';
        return 'Developing; Misses Required Senior Architecture Depth';
      }
      if (profile === 'MID_LEVEL') {
        if (score >= 80) return 'Production Ready';
        if (score >= 60) return 'Competent Mid-Level';
        return 'Developing Mid-Level';
      }
      // FRESHER default
      if (score >= 75) return 'Strong Entry-Level Potential';
      if (score >= 55) return 'Competent Entry-Level';
      return 'Foundation Building';
    };

    const signal: 'STRONG CONSIDERATION' | 'CONSIDERATION' | 'CAUTION' =
      rec === 'Strong Hire' ? 'STRONG CONSIDERATION' :
      rec === 'Hire' || rec === 'Consider' ? 'CONSIDERATION' : 'CAUTION';

    const hiringSignal: EnrichedHiringSignal_v1 = {
      signal,
      readinessLevel: getReadinessForProfile(overallScore, String(targetProfile).toUpperCase()),
      recommendedNextStep: rec === 'Strong Hire' || rec === 'Hire'
        ? 'Proceed to Technical Round 2'
        : rec === 'Consider'
        ? 'Assign Practical Take-home Assessment'
        : 'Reject Application',
      rationale: report.executiveSummary?.summary || 'Evaluation completed with standardized scoring invariants.'
    };


    const evidenceChain = (report.questionBreakdown || []).map((q, idx) => ({
      questionIndex: idx + 1,
      questionText: q.questionText,
      score: q.score,
      userAnswer: q.userAnswer,
      conceptsCovered: q.mentionedConcepts || q.matchedKeyPoints || [],
      conceptsMissed: q.missingKeyPoints || [],
      technicalErrors: (q.technicalErrors || []).map(err => typeof err === 'string' ? err : err.error || ''),
      adaptiveProbe: q.followupResult ? `Follow-up reliability audit: ${q.followupResult.reliability}%` : undefined
    }));

    return {
      schemaVersion: 'v1.0',
      generatedAt: new Date().toISOString(),
      layer1_snapshot: {
        overallScore,
        matchCategory,
        summaryNarrative: report.executiveSummary?.summary || 'Evaluation report finalized.',
        strengthCount: strengths.length,
        devAreaCount: devAreas.length
      },
      layer2_scorecard: scorecard,
      layer3_strengths: strengths,
      layer4_devAreas: devAreas,
      layer5_evidenceChain: evidenceChain,
      layer6_hiringSignal: hiringSignal
    };
  }

  /**
   * Presentation-layer Phase 8 Section Enriched Rendering.
   * Activated when VITE_NEW_REPORTS_ENABLED is true.
   * Operates on top of completed MasterEvaluationReport without recalculating raw scores or altering candidate transcripts.
   */
  static generateEnrichedSections(report: MasterEvaluationReport): any[] {
    if (!isFeatureFlagEnabled('NEW_REPORTS_ENABLED')) {
      return [];
    }

    const rep = report as any;
    const trustScore = rep.executiveSummary?.trustScore ?? rep.overallScores?.trustAdjustedScore ?? rep.trustAdjustedScore ?? 0;
    const rec = rep.executiveSummary?.recommendation ?? rep.recommendation ?? 'N/A';
    const techScore = rep.executiveSummary?.technicalScore ?? rep.overallScores?.knowledgeScore ?? rep.overallScore ?? 0;
    const commScore = rep.overallScores?.communicationScore ?? rep.breakdown?.communicationScore ?? 0;
    const integrityScore = rep.proctoringSummary?.integrityScore ?? rep.integrityScore ?? 100;
    const questionCount = rep.questionBreakdown?.length || 0;

    return [
      {
        schemaVersion: 'v1.0',
        sectionId: 'sec_exec_summary',
        sectionTitle: 'Executive Summary & Hiring Recommendation',
        summaryMarkdown: `Candidate achieved an overall trust-adjusted score of **${trustScore}%** with a recommendation of **${rec}**.`,
        keyHighlights: rep.strengths || [],
        sectionScore: trustScore
      },
      {
        schemaVersion: 'v1.0',
        sectionId: 'sec_technical_competency',
        sectionTitle: 'Technical Competency & Knowledge Depth',
        summaryMarkdown: `Evaluated technical accuracy across ${questionCount} questions attempted.`,
        keyHighlights: rep.weaknesses || [],
        sectionScore: techScore
      },
      {
        schemaVersion: 'v1.0',
        sectionId: 'sec_communication',
        sectionTitle: 'Communication Clarity & Reasoning',
        summaryMarkdown: `Communication clarity score: **${commScore}%**.`,
        keyHighlights: rep.topImprovements || [],
        sectionScore: commScore
      },
      {
        schemaVersion: 'v1.0',
        sectionId: 'sec_proctoring_integrity',
        sectionTitle: 'Proctoring & Trust Integrity',
        summaryMarkdown: `Proctoring integrity score: **${integrityScore}%**.`,
        keyHighlights: [`Integrity score: ${integrityScore}%`],
        sectionScore: integrityScore
      }
    ];
  }


  static computeFinalReport(
    history: AnswerRecord[],
    proctoring: ProctoringReport | undefined | null,
    metadataOverrides: Partial<MasterEvaluationReport['metadata']> = {},
    aiAnalysis?: AIAnalysis
  ): MasterEvaluationReport {
    const validHistory = history.filter(h => h.evaluation);
    const count = validHistory.length || 1;

    // Aggregate sub-scores generated by ScoreAggregator
    let totalContentScore = 0;
    let totalKnowledge = 0;
    let totalReasoning = 0;
    let totalCommunication = 0;
    let totalConfidenceGap = 0;

    // PASS 2 / FINDING 1D — aggregate accumulators default to 0, not 5.
    validHistory.forEach(h => {
      const evalData = h.evaluation!;
      totalContentScore += (evalData.contentScore ?? 0) * 10;
      totalKnowledge += (evalData.conceptUnderstandingScore ?? evalData.knowledgeScore ?? evalData.contentScore ?? 0) * 10;
      totalReasoning += (evalData.reasoningScore ?? evalData.problemSolvingScore ?? evalData.contentScore ?? 0) * 10;
      totalCommunication += (evalData.communicationClarityScore ?? evalData.communicationScore ?? 0) * 10;
      totalConfidenceGap += (evalData.confidenceGap ?? 0);
    });

    const accuracy = Math.round(totalContentScore / count);
    const avgKnowledge = Math.round(totalKnowledge / count);
    const avgReasoning = Math.round(totalReasoning / count);
    const avgCommunication = Math.round(totalCommunication / count);
    const avgConfidenceGap = totalConfidenceGap / count;

    const integrityScore = proctoring ? (proctoring.integrityScore ?? 100) : 100;
    const trustAdjustedScore = Math.round(accuracy * (integrityScore / 100));

    const recommendation = computeRecommendation(trustAdjustedScore, integrityScore);

    // Topic Coverage
    const expectedTopics = new Set(history.map(h => h.topic || 'General'));
    const coveredTopics = new Set(validHistory.map(h => h.topic || 'General'));
    const topicCoverage = Math.round((coveredTopics.size / (expectedTopics.size || 1)) * 100);

    // Consistency Score
    let contradictionPenalty = 0;
    aiAnalysis?.contradictions?.forEach(c => {
      if (c.severity === 'high') contradictionPenalty += 4;
      else if (c.severity === 'medium') contradictionPenalty += 2;
      else if (c.severity === 'low') contradictionPenalty += 1;
    });
    contradictionPenalty = Math.min(8, contradictionPenalty);
    const consistencyScore = Math.max(0, 100 - contradictionPenalty * 12.5);

    // Knowledge Stability
    const primaryScores = validHistory
      .filter(h => !h.isFollowUp && h.evaluation)
      .map(h => h.evaluation!.contentScore ?? 5);

    let stdDev = 0;
    if (primaryScores.length > 0) {
      const mean = primaryScores.reduce((a, b) => a + b, 0) / primaryScores.length;
      const variance = primaryScores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / primaryScores.length;
      stdDev = Math.sqrt(variance);
    }
    const knowledgeStability = Math.max(0, Math.min(100, Math.round(100 - stdDev * 15)));

    const summaryText = aiAnalysis?.summary || (validHistory.length > 0 ? "Candidate completed the interview evaluation." : "No evaluation records found.");
    const strengthsList = aiAnalysis?.strengths || [];
    const weaknessesList = aiAnalysis?.weaknesses || [];
    const missedConceptsSet = new Set<string>();

    validHistory.forEach(h => {
      (h.evaluation?.missingKeyPoints || []).forEach(kp => missedConceptsSet.add(kp));
    });

    const masterReport: MasterEvaluationReport = {
      executiveSummary: {
        recommendation,
        recommendationStatus: 'normal',
        technicalScore: accuracy,
        trustScore: trustAdjustedScore,
        readinessScore: avgKnowledge,
        interviewPerformanceScore: accuracy,
        candidateLevel: accuracy >= 80 ? 'Advanced' : accuracy >= 60 ? 'Strong' : 'Developing',
        growthPotential: avgReasoning,
        improvementOpportunity: 100 - accuracy,
        confidenceGap: avgConfidenceGap,
        answerReliabilityScore: integrityScore,
        topicCoverage: topicCoverage,
        knowledgeStability: knowledgeStability,
        reportConfidence: 'High',
        summary: summaryText
      },
      overallScores: {
        knowledgeScore: avgKnowledge,
        reasoningScore: avgReasoning,
        communicationScore: avgCommunication,
        consistencyScore: consistencyScore,
        difficultyWeightedPerformance: accuracy,
        trustAdjustedScore,
        readinessScore: avgKnowledge,
        interviewPerformanceScore: accuracy,
        growthPotential: avgReasoning,
        improvementOpportunity: 100 - accuracy,
        confidenceGap: avgConfidenceGap,
        answerReliabilityScore: integrityScore
      },
      strengths: strengthsList.length > 0 ? strengthsList : ["Attempted responses consistently."],
      weaknesses: weaknessesList.length > 0 ? weaknessesList : ["Exhibited minor area-specific gaps."],
      topImprovements: aiAnalysis?.topImprovements?.length ? aiAnalysis.topImprovements : Array.from(missedConceptsSet).slice(0, 3).map(c => `Review core fundamentals of ${c}.`),
      validationResults: [],
      contradictions: aiAnalysis?.contradictions || [],
      performanceTrend: {
        timeline: validHistory.map((h, i) => ({ qIndex: i + 1, score: (h.evaluation?.contentScore ?? 5) * 10 })),
        trend: 'stable'
      },
      proctoringSummary: proctoring ? {
        faceAwayEvents: proctoring.gazeAwayEvents ?? 0,
        multiplePersonEvents: proctoring.multipleFaceEvents ?? 0,
        tabSwitches: proctoring.tabSwitchEvents ?? 0,
        warningsIssued: proctoring.violations?.length ?? 0,
        integrityScore: proctoring.integrityScore ?? 100,
        totalGazeAwayDurationMs: proctoring.totalGazeAwayDurationMs ?? 0,
        longestGazeAwayDurationMs: proctoring.healthSummary?.longestGazeAwayDurationMs ?? 0,
        sessionDurationMs: (proctoring as any).sessionDurationMs ?? 0,
        isTerminated: (proctoring as any).isTerminated ?? false,
        terminationReason: (proctoring as any).terminationReason ?? null
      } : {
        faceAwayEvents: 0,
        multiplePersonEvents: 0,
        tabSwitches: 0,
        warningsIssued: 0,
        integrityScore: 100,
        totalGazeAwayDurationMs: 0,
        longestGazeAwayDurationMs: 0,
        sessionDurationMs: 0,
        isTerminated: false,
        terminationReason: null
      },
      questionBreakdown: history.map((item, idx) => {
        const evalData: any = item.evaluation || {};
        const rawTechnicalErrors =
          evalData.analysis?.technicalErrors ?? evalData.technicalErrors ?? [];
        const technicalErrors = (Array.isArray(rawTechnicalErrors) ? rawTechnicalErrors : [])
          .map((err: any) => {
            if (typeof err === 'string') return err;
            if (err && typeof err === 'object') {
              return err.error || err.explanation || err.message || '';
            }
            return '';
          })
          .filter((s: string) => s.trim().length > 0);

        const isApiError = !!(evalData.isApiError || evalData.status === 'API_UNAVAILABLE');
        const evalErrMsg = isApiError ? (evalData.userMessage || 'AI evaluation is temporarily unavailable.') : undefined;

        return {
          questionText: item.questionText || (item as any).question || (item as any).text || `Question ${idx + 1}`,
          difficulty: 'medium',
          isFollowUp: !!item.isFollowUp,
          evaluationError: evalErrMsg,
          score: evalData.contentScore ?? 5,
          userAnswer: item.transcript || (item as any).answer || "",
          feedback: {
            observation: evalData.feedback?.observation || (isApiError ? "AI evaluation is temporarily unavailable." : "Evaluated locally."),
            demonstrated: evalData.feedback?.demonstrated || [],
            gaps: evalData.feedback?.gaps || [],
            nextSteps: evalData.feedback?.nextSteps || []
          },
          questionAlignment: evalData.questionAlignment,
          mentionedConcepts: evalData.mentionedConcepts || [],
          explainedConcepts: evalData.explainedConcepts || [],
          matchedKeyPoints: evalData.matchedKeyPoints || [],
          missingKeyPoints: evalData.missingKeyPoints || [],
          technicalErrors,
          knowledgeScore: isApiError ? 0 : (evalData.conceptUnderstandingScore ?? evalData.knowledgeScore ?? evalData.contentScore ?? 0),
          problemSolvingScore: isApiError ? 0 : (evalData.reasoningScore ?? evalData.problemSolvingScore ?? evalData.contentScore ?? 0),
          learningPotentialScore: isApiError ? 0 : (evalData.confidenceCalibrationScore ?? evalData.learningPotentialScore ?? evalData.contentScore ?? 0),
          confidenceGap: evalData.confidenceGap ?? 0,
          analysis: {
            coverage: isApiError ? 0 : (evalData.contentScore ?? 0),
            understanding: isApiError ? 0 : (evalData.conceptUnderstandingScore ?? evalData.knowledgeScore ?? evalData.contentScore ?? 0),
            reasoning: isApiError ? 0 : (evalData.reasoningScore ?? evalData.problemSolvingScore ?? evalData.contentScore ?? 0),
            communication: isApiError ? 0 : (evalData.communicationClarityScore ?? evalData.communicationScore ?? 0)
          },
          transcriptionQualityScore: 100
        };
      }),
      telemetry: {
        followupTriggerRate: Math.round((history.filter(h => h.isFollowUp).length / Math.max(1, history.filter(h => !h.isFollowUp).length)) * 100),
        tokenUsage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        modelCalls: 0
      },
      metadata: {
        engineVersion: "v4.2.0",
        profileVersionId: "unknown-legacy",
        promptVersion: EVALUATION_PROMPT_VERSION,
        pipelineVersion: "v4.2.0",
        schemaVersion: "v1.0",
        rubricVersion: "v1.0",
        questionBankVersion: "v1.0",
        evaluationMode: "local",
        provider: "local-heuristic",
        model: "core-heuristics",
        ...metadataOverrides
      }
    };

    return masterReport;
  }
}
