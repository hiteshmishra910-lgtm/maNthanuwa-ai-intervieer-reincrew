import { ReadonlyEvaluationResult } from '../../../types';
import { EvaluationStrategy } from '../dispatch/EvaluationStrategy';
import { EvaluationContext } from '../types/EvaluationContext';
import { submitAnswer } from '../../Core/api/apiService';
import { EvaluationCore } from '../dispatch/EvaluationCore';
import { applyUnifiedScoringPolicy } from '../../../shared/evaluationScoringPolicy';

export class InteractiveEvaluationStrategy implements EvaluationStrategy {
  private static instance: InteractiveEvaluationStrategy;

  private constructor() {}

  public static getInstance(): InteractiveEvaluationStrategy {
    if (!InteractiveEvaluationStrategy.instance) {
      InteractiveEvaluationStrategy.instance = new InteractiveEvaluationStrategy();
    }
    return InteractiveEvaluationStrategy.instance;
  }

  supportsRealtime(): boolean {
    return true;
  }

  async evaluateQuestion(context: EvaluationContext): Promise<ReadonlyEvaluationResult> {
    const start = performance.now();
    const config = {
      engineId: 'interactive-v2',
      version: 'v2.0',
      mode: 'Interactive',
      weightProfile: context.session.mode
    };

    let legacyEval: any;
    const provider = (import.meta.env?.VITE_AI_PROVIDER) || 'openrouter';
    const model = (import.meta.env?.VITE_EVAL_MODEL) || 'openrouter/free';

    try {
      const timeoutMs = 12000;
      // Make the actual LLM call using apiService with a 12-second deadline
      const res = await Promise.race([
        submitAnswer(
          { id: context.session.id, name: 'Candidate' } as any, // minimal candidate stub
          context.question,
          context.response,
          context.metadata?.visualMetrics,
          undefined,
          context.session.id,
          'eval'
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT: Provider API call exceeded 12s limit')), timeoutMs)
        )
      ]);
      legacyEval = res.evaluation;
    } catch (err: any) {
      const timestamp = new Date().toISOString();
      const rawErrorMessage = err?.message || String(err);

      const isQuotaExhausted = /free-models-per-day|Rate limit|429|quota/i.test(rawErrorMessage);
      const isTimeout = /timed out|TimeoutError|TIMEOUT/i.test(rawErrorMessage);
      const isNetwork = /network|fetch|offline|5\d\d|service unavailable|ECONNREFUSED|ENOTFOUND/i.test(rawErrorMessage);
      const isTruncated = /TruncatedResponse|token limit/i.test(rawErrorMessage);
      const isRecoverable = isQuotaExhausted || isTimeout || isNetwork || isTruncated;

      if (!isRecoverable) {
        console.error(`[InteractiveEvaluationStrategy] Unrecoverable programming error during evaluation:`, err);
        throw err;
      }

      console.warn(`[API Evaluation Recoverable Warning - Executing Local Heuristic Fallback] Provider: ${provider}, Model: ${model}, SessionId: ${context.session.id}, Reason: ${rawErrorMessage}`);
      
      try {
        const { ErrorLogService } = await import('../../Core/logging/errorLogService');
        ErrorLogService.logEvent('api', rawErrorMessage, {
          provider,
          model,
          evaluationMode: context.session.mode,
          sessionId: context.session.id,
          timestamp,
          rawError: rawErrorMessage,
          fallbackUsed: 'local-heuristic'
        }, 'warn', context.session.id);
      } catch (logErr) {
        console.error('[ErrorLogService Failed to log API failure]', logErr);
      }

      const fallbackReason = isTimeout ? 'TIMEOUT' : isTruncated ? 'TRUNCATED' : isQuotaExhausted ? 'RATE_LIMIT' : 'API_ERROR';

      // Fall back seamlessly to Local Heuristic Engine
      const { LocalEvaluationStrategy } = await import('./LocalEvaluationStrategy');
      const localResult = await LocalEvaluationStrategy.getInstance().evaluateQuestion(context);
      const mutableResult = { ...localResult };

      (mutableResult as any).evaluationMetadata = {
        ...((localResult as any).evaluationMetadata || {}),
        engineId: config.engineId,
        version: config.version,
        timestamp,
        mode: config.mode,
        evaluationSource: 'API_FALLBACK_LOCAL',
        fallbackReason,
        provider,
        model,
        promptVersion: 'v2.2.0',
        isApiError: false,
        rawErrorMessage
      };

      return Object.freeze(mutableResult) as ReadonlyEvaluationResult;
    }

    const latencyMs = Math.round(performance.now() - start);

    const evalResult = legacyEval as any;
    
    // Explicit metric presence tracking for graduated confidence deduction
    const hasTechnicalAccuracy = typeof evalResult.analysis?.technicalAccuracy === 'number';
    const hasReasoning = typeof evalResult.analysis?.reasoning === 'number';
    const hasClarity = typeof evalResult.analysis?.clarity === 'number';
    const hasConfidence = typeof evalResult.analysis?.confidence === 'number';

    let confidenceDeduction = 0;
    if (!hasReasoning) confidenceDeduction += 10;
    if (!hasClarity) confidenceDeduction += 10;
    if (!hasConfidence) confidenceDeduction += 10;

    const baseConfidence = typeof evalResult.evaluationConfidence === 'number' ? evalResult.evaluationConfidence : 100;
    const finalConfidence = Math.max(40, baseConfidence - confidenceDeduction);

    const technicalAccuracyScore = hasTechnicalAccuracy ? evalResult.analysis.technicalAccuracy : (evalResult.score ?? 0);

    // ─── API-LOCAL ALIGNMENT ────────────────────────────────────────────────
    const conceptUnderstandingScore = typeof evalResult.analysis?.understanding === 'number' ? evalResult.analysis.understanding : technicalAccuracyScore;
    const reasoningScore = hasReasoning ? evalResult.analysis.reasoning : technicalAccuracyScore;
    const communicationClarityScore = hasClarity ? evalResult.analysis.clarity : technicalAccuracyScore;
    const confidenceCalibrationScore = hasConfidence ? evalResult.analysis.confidence : technicalAccuracyScore;

    const relevanceScore = typeof evalResult.relevanceScore === 'number' ? evalResult.relevanceScore : (typeof evalResult.accuracy === 'number' ? evalResult.accuracy : technicalAccuracyScore);
    const questionSatisfactionScore = typeof evalResult.questionSatisfactionScore === 'number' ? evalResult.questionSatisfactionScore : (typeof evalResult.conceptCoverage === 'number' ? evalResult.conceptCoverage : technicalAccuracyScore);

    const technicalErrorsCount = Array.isArray(evalResult.analysis?.technicalErrors) ? evalResult.analysis.technicalErrors.length : 0;
    const misconceptionsScore = Math.max(0, Math.min(10, 10 - technicalErrorsCount));

    // ─── UNIFIED SCORING POLICY (API mode MUST use the same gates) ──────────
    // Detect behavioral questions for substance analysis
    const questionTextLower = (context.question.question || (context.question as any).text || '').toLowerCase();
    const isBehavioral = /tell me about|describe a time|describe a situation|have you ever|experience|background|strength|weakness|introduce/i.test(questionTextLower) ||
      (context.question as any).questionType === 'HR' || (context.question as any).questionType === 'Scenario';

    const matchedConceptCount = (evalResult.matchedKeyPoints?.length || 0) + (evalResult.mentionedConcepts?.length || 0);

    const policyResult = applyUnifiedScoringPolicy(
      {
        technicalAccuracy: technicalAccuracyScore,
        conceptUnderstanding: conceptUnderstandingScore,
        reasoning: reasoningScore,
        communication: communicationClarityScore,
        confidence: confidenceCalibrationScore,
      },
      context.response || '',
      matchedConceptCount,
      isBehavioral,
      technicalAccuracyScore,
    );

    // Map V1 result to V2 ReadonlyEvaluationResult schema
    const result: any = {
      ...legacyEval,
      // V2 Structured Dimensions — policy-adjusted
      technicalAccuracyScore: policyResult.scores.technicalAccuracy,
      conceptUnderstandingScore: policyResult.scores.conceptUnderstanding,
      reasoningScore: policyResult.scores.reasoning,
      communicationClarityScore: policyResult.scores.communication,
      confidenceCalibrationScore: policyResult.scores.confidence,
      evaluationConfidence: finalConfidence,

      // Concept Graphs and Breakdowns (fallback to minimal arrays)
      technicalAccuracyBreakdown: {
        factsScore: policyResult.scores.technicalAccuracy,
        questionSatisfactionScore,
        misconceptionsScore,
        completenessScore: evalResult.analysis?.coverage || policyResult.scores.conceptUnderstanding,
        relevanceScore
      },

      questionSatisfaction: questionSatisfactionScore >= 7 ? 'YES' : 'NO',
      explanationCompletenessPercent: (evalResult.analysis?.coverage || 0) * 10,
      relevantContentRatio: 1.0,
      conceptGraphDetails: {
        reachedDepth: [],
        missedDependencies: evalResult.missingKeyPoints || [],
        validConnections: [],
        invalidConnections: []
      },
      misconceptionsDetected: (evalResult.technicalErrors || []).map((e: any) => e.error || e.explanation || JSON.stringify(e)),
      uncertaintyDetected: evalResult.answerType === 'honest_unknown',
      selfCorrectionsCount: evalResult.selfCorrection || 0,
      unsupportedClaimsCount: 0,
      knowledgeBoundaryExceeded: false,

      developerTrace: [
        `Interactive LLM call completed in ${latencyMs}ms`,
        ...(policyResult.appliedCaps.length > 0 ? [`[UNIFIED POLICY] ${policyResult.appliedCaps.join('; ')}`] : []),
      ],
      detectorConfidences: {},
      ruleVersion: 'v2.0.0',
      knowledgeModelVersion: 'v1.0.0',

      evaluationMetadata: {
        engineId: config.engineId,
        version: config.version,
        timestamp: new Date().toISOString(),
        latencyMs,
        mode: config.mode,
        evaluationSource: 'API',
        fallbackReason: 'NONE',
        provider,
        model,
        promptVersion: 'v2.2.0'
      }
    };

    return Object.freeze(result) as ReadonlyEvaluationResult;
  }
}
