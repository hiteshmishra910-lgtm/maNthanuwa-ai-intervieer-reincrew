import { EvaluationMode, ReadonlyEvaluationResult } from '../../../types';
import { EvaluationStrategy, IEvaluationDispatcher } from './EvaluationStrategy';
import { InteractiveEvaluationStrategy } from '../engines/InteractiveEvaluationStrategy';
import { LocalEvaluationStrategy } from '../engines/LocalEvaluationStrategy';
import { BatchEvaluationStrategy } from '../engines/BatchEvaluationStrategy';
import { EvaluationContext } from '../types/EvaluationContext';
import { evaluationQueue } from './EvaluationQueue';
import { ReportGenerator, AIAnalysis } from '../pipeline/ReportGenerator';
import { MasterEvaluationReport, InterviewCompletionResult, InterviewCompletionState } from '../../../types';
import { SupabaseService } from '../../Core/database/supabaseService';
import { EVALUATION_PROMPT_VERSION } from '../../shared/evaluationConstants';

export class EvaluationDispatcher implements IEvaluationDispatcher {
  private static instance: EvaluationDispatcher;

  private listeners: ((payload: any) => void)[] = [];

  public static getInstance(): EvaluationDispatcher {
    if (!EvaluationDispatcher.instance) {
      EvaluationDispatcher.instance = new EvaluationDispatcher();
    }
    return EvaluationDispatcher.instance;
  }

  public onEvaluationCompleted(listener: (payload: any) => void) {
    this.listeners.push(listener);
  }

  private emitEvaluationCompleted(payload: any) {
    this.listeners.forEach(listener => {
      try {
        listener(payload);
      } catch (e) {
        console.error('[EvaluationDispatcher] Error in listener:', e);
      }
    });
  }

  private getStrategy(mode: string): EvaluationStrategy {
    switch (mode) {
      case EvaluationMode.LOCAL:
        return LocalEvaluationStrategy.getInstance();
      case EvaluationMode.HYBRID:
        return BatchEvaluationStrategy.getInstance();
      case EvaluationMode.API:
        return InteractiveEvaluationStrategy.getInstance();
      default:
        if (import.meta.env.DEV) {
          throw new Error(`[EvaluationDispatcher] Unrecognized evaluation mode: "${mode}". Valid modes are LOCAL, HYBRID, API.`);
        }
        console.error(`[EvaluationDispatcher] Unrecognized evaluation mode: "${mode}". Falling back to LOCAL evaluation mode.`);
        try {
          import('../../Core/logging/errorLogService').then(({ ErrorLogService }) => {
            ErrorLogService.logEvent('evaluation', `Unrecognized evaluation mode: "${mode}". Falling back to LOCAL.`, { mode }, 'error');
          });
        } catch (e) {
          // Ignore log error
        }
        return LocalEvaluationStrategy.getInstance();
    }
  }

  async evaluateQuestion(context: EvaluationContext): Promise<ReadonlyEvaluationResult> {
    const strategy = this.getStrategy(context.session.mode);
    const start = performance.now();
    
    const result = await strategy.evaluateQuestion(context);
    
    const latencyMs = Math.round(performance.now() - start);

    // Extract actual executed model/provider from evaluator result metadata if present
    const resMetadata = (result as any)?.evaluationMetadata || {};
    const actualProvider = resMetadata.provider || (context.session.mode === EvaluationMode.LOCAL ? 'local-heuristic' : 'openrouter');
    const actualModel = resMetadata.model || (context.session.mode === EvaluationMode.LOCAL ? 'core-heuristics' : ((import.meta.env?.VITE_EVAL_MODEL) || 'openrouter/free'));

    // Emit fire-and-forget event with actual execution provenance
    this.emitEvaluationCompleted({
      context,
      result,
      latencyMs,
      provider: actualProvider,
      model: actualModel,
      promptVersion: EVALUATION_PROMPT_VERSION,
      cacheHit: false,
      retryCount: 0
    });

    return result;
  }

  async evaluateInterview(context: EvaluationContext): Promise<readonly ReadonlyEvaluationResult[]> {
    const strategy = this.getStrategy(context.session.mode);
    
    // If the strategy implements evaluateInterview (e.g. Batch might want to process the whole array), use it
    if (strategy.evaluateInterview) {
        return strategy.evaluateInterview(context);
    }

    return [];
  }

  /**
   * PASS 2 / FINDING 2A — build a session-level analysis from the per-turn LLM evaluations.
   *
   * In API mode every answer is already evaluated by the LLM, which returns concepts, missing
   * key points and technical errors per turn. That detail was being discarded at report time.
   * This aggregates it so the recruiter sees what the model actually found rather than a
   * template.
   *
   * Returns undefined when the history carries no usable qualitative signal, which lets
   * ReportGenerator fall back to its concept-derived text rather than emit an empty summary.
   */
  private buildApiAnalysis(history: any[]): AIAnalysis | undefined {
    if (!Array.isArray(history) || history.length === 0) return undefined;

    const uniq = (values: string[]) =>
      Array.from(new Set(values.map(v => String(v).trim()).filter(Boolean)));

    const demonstrated = uniq(
      history.flatMap(h => h?.evaluation?.explainedConcepts || h?.evaluation?.mentionedConcepts || [])
    );
    const gaps = uniq(history.flatMap(h => h?.evaluation?.missingKeyPoints || []));
    const errors = uniq(
      history
        .flatMap(h => h?.evaluation?.analysis?.technicalErrors ?? h?.evaluation?.technicalErrors ?? [])
        .map((e: any) => (typeof e === 'string' ? e : e?.error || e?.explanation || ''))
    );

    // Nothing qualitative to report — let the caller use its own fallback.
    if (demonstrated.length === 0 && gaps.length === 0 && errors.length === 0) return undefined;

    const scored = history
      .map(h => h?.evaluation?.contentScore)
      .filter((s: any) => typeof s === 'number');
    const avg = scored.length ? scored.reduce((a: number, b: number) => a + b, 0) / scored.length : 0;

    const summaryParts: string[] = [];
    summaryParts.push(
      demonstrated.length > 0
        ? `Across ${history.length} question(s) the candidate demonstrated ${demonstrated.slice(0, 4).join(', ')}.`
        : `Across ${history.length} question(s) the candidate did not demonstrate the expected concepts.`
    );
    if (errors.length > 0) {
      summaryParts.push(`Specific technical inaccuracies were identified: ${errors.slice(0, 3).join('; ')}.`);
    }
    if (gaps.length > 0) {
      summaryParts.push(`Key points left uncovered include ${gaps.slice(0, 4).join(', ')}.`);
    }
    summaryParts.push(`Mean per-answer technical accuracy was ${(avg * 10).toFixed(0)}%.`);

    return {
      summary: summaryParts.join(' '),
      // Only claim a strength where the candidate actually explained something. An empty array
      // lets ReportGenerator apply its own wording rather than asserting a strength that the
      // evidence does not support.
      strengths: demonstrated.slice(0, 3).map(c => `Explained ${c} with supporting detail.`),
      weaknesses: [
        ...errors.slice(0, 2).map(e => `Technical inaccuracy: ${e}`),
        ...gaps.slice(0, 3).map(g => `Did not address ${g}.`),
      ],
      topImprovements: gaps.slice(0, 3).map(g => `Study ${g}, then explain it aloud with a worked example.`),
    };
  }  // The dispatcher takes ownership of legacy orchestrator duties for now
  async finalizeInterview(sessionId: string, history: any[], proctoringReport: any, mode: string): Promise<InterviewCompletionResult> {
    try {
      // 1. Log Initiation
      await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', 'EVALUATION_STARTED', { mode });

      if (mode === EvaluationMode.HYBRID) {
          console.log(`[EvalDispatcher] HYBRID mode — setting execution_status to HYBRID_RUNNING, enqueueing for background processing`);
          // Transition: PENDING -> HYBRID_RUNNING
          await SupabaseService.updateSession(sessionId, { execution_status: 'HYBRID_RUNNING', execution_attempt_mode: mode });
          await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', 'HYBRID_RUNNING');

          // Compute initial heuristic report so session has baseline evaluation_report
          const report = ReportGenerator.computeFinalReport(history, proctoringReport, {
              evaluationMode: mode,
              model: "core-heuristics",
              provider: "local-heuristic",
          });
          report.reportType = 'heuristic';
          report.evaluationStatus = 'QUEUED';

          // Enqueue for background processing
          await evaluationQueue.enqueue({
            sessionId,
            history,
            proctoringReport,
            mode
          });
          
          await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', 'REPORT_GENERATED', { type: 'heuristic_queued' });
          
          return {
            completionState: InterviewCompletionState.QUEUED,
            report: report,
            jobId: `job_${Date.now()}_${sessionId.substring(0,8)}`,
            startedAt: new Date().toISOString()
          };
      } else {
          // Determine attempt
          const isLocal = mode === EvaluationMode.LOCAL;
          const attemptStatus = isLocal ? 'LOCAL_RUNNING' : 'API_RUNNING';
          const attemptMode = mode;

          await SupabaseService.updateSession(sessionId, { 
            execution_status: attemptStatus, 
            execution_attempt_mode: attemptMode 
          });

          await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', attemptStatus);

          const actualModel = isLocal 
            ? "core-heuristics" 
            : ((import.meta.env?.VITE_EVAL_MODEL) || "openrouter/free");
          const actualProvider = isLocal 
            ? "local-heuristic" 
            : "openrouter";

          // PASS 2 / FINDING 2A
          let aiAnalysisPayload = undefined;
          let finalReportSource = isLocal ? 'LOCAL' : 'API';
          let fallbackMode = null;
          let failureReason = null;
          
          if (!isLocal) {
            try {
              aiAnalysisPayload = this.buildApiAnalysis(history);
            } catch (err: any) {
              console.warn('[EvaluationDispatcher] API summary aggregation exception:', err);
            }

            // TURN RECOVERY: If any individual question failed during live interaction,
            // attempt a single retry now so no turn is left un-evaluated.
            const failedIndices = history
              .map((h, idx) => ({ h, idx }))
              .filter(({ h }) => h.evaluation?.evaluationMetadata?.evaluationSource === 'API_FAILED' || h.evaluation?.isApiError);

            if (failedIndices.length > 0 && failedIndices.length < history.length) {
              console.log(`[EvaluationDispatcher] Attempting retry for ${failedIndices.length} failed question turns...`);
              for (const { h, idx } of failedIndices) {
                try {
                  const retryRes = await InteractiveEvaluationStrategy.getInstance().evaluateQuestion({
                    session: { id: sessionId, mode: 'API' } as any,
                    candidate: { name: 'Candidate', email: '', role: '' } as any,
                    evaluationProfile: { mode: 'API' } as any,
                    question: h.questionData || { id: `q_${idx}`, question: h.question, ideal_answer: h.ideal_answer },
                    response: h.answer || h.transcript || ''
                  });
                  if (!(retryRes as any).isApiError) {
                    h.evaluation = retryRes;
                    console.log(`[EvaluationDispatcher] ✓ Successfully recovered failed turn #${idx + 1}`);
                  }
                } catch (retryErr) {
                  console.warn(`[EvaluationDispatcher] Turn #${idx + 1} retry failed:`, retryErr);
                }
              }
            }

            const apiFailedTurns = history.filter(h => h.evaluation?.evaluationMetadata?.evaluationSource === 'API_FAILED' || h.evaluation?.isApiError);
            const apiSuccessTurns = history.filter(h => h.evaluation?.evaluationMetadata?.evaluationSource === 'API' && !h.evaluation?.isApiError);

            if (apiFailedTurns.length > 0) {
              console.log(`[EvaluationDispatcher] ${apiFailedTurns.length} API turn(s) failed out of ${history.length}. Attempting Local Heuristic Fallback...`);
              
              let localFallbackSucceeded = true;
              try {
                // Perform local heuristic evaluation on failed turns
                history.forEach((h, idx) => {
                  if (h.evaluation?.evaluationMetadata?.evaluationSource === 'API_FAILED' || h.evaluation?.isApiError || !h.evaluation) {
                    const ansLen = (h.answer || h.transcript || '').trim().length;
                    const contentScore = ansLen > 50 ? 7 : (ansLen > 10 ? 5 : 2);
                    h.evaluation = {
                      contentScore,
                      grammarScore: 8,
                      fluencyScore: 8,
                      verdict: contentScore >= 6 ? 'Pass' : 'Borderline',
                      feedback: 'Evaluated via Local Heuristic Fallback following API rate limit/failure.',
                      evaluationMetadata: { evaluationSource: 'LOCAL_FALLBACK' }
                    };
                  }
                });
              } catch (fallbackErr: any) {
                console.error('[EvaluationDispatcher] Local heuristic fallback failed:', fallbackErr);
                localFallbackSucceeded = false;
              }

              if (localFallbackSucceeded) {
                finalReportSource = 'API_FALLBACK';
                fallbackMode = 'LOCAL_HEURISTIC';
                failureReason = 'RATE_LIMIT';
                
                const provenance = {
                  requestedMode: mode,
                  effectiveMode: 'API_FALLBACK' as const,
                  fallbackUsed: true,
                  fallbackReason: 'RATE_LIMIT',
                  apiTurnsAttempted: history.length,
                  apiTurnsSucceeded: apiSuccessTurns.length,
                  apiTurnsFailed: apiFailedTurns.length,
                  localTurnsEvaluated: apiFailedTurns.length
                };

                await SupabaseService.updateSession(sessionId, { 
                  execution_status: 'API_FALLBACK',
                  final_report_source: 'API_FALLBACK',
                  execution_attempt_mode: 'API_FALLBACK',
                  failure_reason: null
                });
                await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', 'API_FALLBACK', provenance);
              } else {
                finalReportSource = 'NONE';
                failureReason = 'Local heuristic fallback failed after API error';
                await SupabaseService.updateSession(sessionId, { 
                  execution_status: 'EVALUATION_FAILED',
                  final_report_source: 'NONE',
                  failure_reason: failureReason
                });
                await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', 'EVALUATION_FAILED', { reason: failureReason });
                
                return {
                  completionState: InterviewCompletionState.FAILED,
                  report: null as any,
                  startedAt: new Date().toISOString()
                };
              }
            }
          }

          const effectiveEvalMode = finalReportSource === 'API_FALLBACK' ? 'API_FALLBACK' : mode;

          const report = ReportGenerator.computeFinalReport(history, proctoringReport, {
              evaluationMode: effectiveEvalMode,
              model: actualModel,
              provider: actualProvider,
              promptVersion: EVALUATION_PROMPT_VERSION,
          }, aiAnalysisPayload);

          // Transition: REPORT_SAVED
          const now = new Date().toISOString();
          const targetStatus = finalReportSource === 'API_FALLBACK'
            ? 'API_FALLBACK' 
            : (finalReportSource === 'NONE' ? 'EVALUATION_FAILED' : 'REPORT_SAVED');

          await SupabaseService.updateSession(sessionId, { 
            execution_status: targetStatus,
            execution_attempt_mode: effectiveEvalMode,
            fallback_mode: fallbackMode,
            final_report_source: finalReportSource,
            failure_reason: failureReason,
            completed_at: now
          });
          await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', targetStatus, { finalReportSource, fallbackMode });

          return {
            completionState: InterviewCompletionState.COMPLETED,
            report: report,
            startedAt: new Date().toISOString()
          };
      }
    } catch (err: any) {
      // Transition: FAILED
      await SupabaseService.updateSession(sessionId, { 
        execution_status: 'FAILED',
        failure_reason: err.message
      });
      await SupabaseService.logEvaluationLifecycle(sessionId, 'EvaluationDispatcher', 'ReportGenerator', 'FAILED', { error: err.message });
      throw err;
    }
  }
}
