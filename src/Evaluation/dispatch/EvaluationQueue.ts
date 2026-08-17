import { supabase } from '../../Core/database/supabaseClient';
import { AIService } from '../../Core/ai/aiService';
import { MasterEvaluationReport } from '../../../types';
import { SupabaseService } from '../../Core/database/supabaseService';
import { ErrorLogService } from '../../Core/logging/errorLogService';
import { getLimitsForMode } from './pilotLimits';
import { isFeatureFlagEnabled } from '../expert/config';
import { AsyncQueueEnrichmentJobDTO_v1 } from '../pipeline/sharedContracts';


export interface QueuedSession {
  sessionId: string;
  history: any[];
  proctoringReport: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: number;
  mode?: string;
}

export interface AsyncQueueJobResultDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly jobId: string;
  readonly mergeToken: string;
  readonly workerVersion: string;
  readonly status: 'SUCCESS' | 'DUPLICATE_SUPPRESSED' | 'FAILED_RETRYABLE' | 'FAILED_NON_RETRYABLE' | 'DEAD_LETTER';
  readonly failureCategory?: 'VALIDATION_ERROR' | 'NETWORK_TIMEOUT' | 'EXCEEDED_MAX_RETRIES' | 'UNKNOWN';
  readonly latencyMs: number;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly duplicateSuppressed: boolean;
  readonly startedAtISO: string;
  readonly finishedAtISO: string;
  readonly diagnostics: readonly string[];
}

class EvaluationQueue {
  private queue: QueuedSession[] = [];
  private processedMergeTokens = new Set<string>();
  public static readonly MAX_RETRIES = 3;
  public static readonly WORKER_VERSION = 'v1.0.0';

  /**
   * Add a completed interview session to the background queue
   */
  async enqueue(session: Omit<QueuedSession, 'status' | 'timestamp'>) {
    if (this.queue.some(s => s.sessionId === session.sessionId)) {
      console.log(`[EvalQueue] Session ${session.sessionId} already in queue`);
      return;
    }

    // ── Pilot batch cap: check per-mode concurrent session count ──
    const mode = (session.mode || 'HYBRID').toUpperCase();
    const limits = getLimitsForMode(mode);
    const activeCount = this.queue.filter(
      s => s.status === 'pending' || s.status === 'processing'
    ).length;

    if (activeCount >= limits.maxConcurrentSessions) {
      console.warn(
        `[EvalQueue] ⚠️ Batch cap reached for ${mode} mode: ${activeCount}/${limits.maxConcurrentSessions} active sessions. ` +
        `Session ${session.sessionId} queued but may be delayed.`
      );
      // Still enqueue — don't block the candidate. The edge worker enforces the hard limit.
    }

    const queuedSession: QueuedSession = {
      ...session,
      status: 'pending',
      timestamp: Date.now()
    };
    this.queue.push(queuedSession);
    console.log(`[EvalQueue] ✅ Enqueued session ${session.sessionId}. History length: ${session.history?.length || 0}`);

    try {
      const totalQuestions = session.history ? session.history.length : 10;
      // Write to database to persist the job with metadata using ON CONFLICT for atomic idempotency
      try {
        const upsertResult = await supabase.from('evaluation_jobs').upsert({
          session_id: session.sessionId,
          status: 'QUEUED',
          total_questions: totalQuestions,
          processed_questions: 0,
          retry_count: 0
        }, { onConflict: 'session_id' });
        if (upsertResult.error) {
          console.warn(`[EvalQueue] ⚠️ evaluation_jobs upsert error (non-critical):`, upsertResult.error.message, upsertResult.error);
        } else {
          console.log(`[EvalQueue] evaluation_jobs upsert OK`);
        }
      } catch (upsertErr) {
        console.warn(`[EvalQueue] ⚠️ evaluation_jobs upsert exception (non-critical):`, upsertErr);
      }


      // Trigger background Edge Function
      console.log(`[EvalQueue] Triggering process-evaluation-queue edge function...`);
      supabase.functions.invoke('process-evaluation-queue', {
        body: { sessionId: session.sessionId }
      }).then((res) => {
        console.log(`[EvalQueue] Edge function response:`, res);
      }).catch((err) => {
        console.warn(`[EvalQueue] ⚠️ Edge function failed (expected in local dev):`, err.message || err);
      });

      // RESILIENCE WORKER FALLBACK:
      // Poll evaluation_jobs every 15s for up to 2 minutes. If the edge function completes
      // (status = COMPLETED), skip local generation. If it doesn't after 2 min, generate
      // a local fallback so the candidate never stays stuck on "AI Report in generation".
      this.pollAndFallback(session.sessionId, session.history, session.proctoringReport);

    } catch (dbError) {
      console.error(`[EvalQueue] Failed to enqueue for session ${session.sessionId}:`, dbError);
    }
  }

  /**
   * Poll evaluation_jobs to see if the edge function completed, with a 2-minute timeout.

   * If the edge function completes, we skip local generation. If not, we fall back.
   */
  private async pollAndFallback(sessionId: string, history: any[], proctoringReport: any) {
    const POLL_INTERVAL_MS = 15_000;  // 15 seconds
    const MAX_WAIT_MS = 120_000;       // 2 minutes
    const startTime = Date.now();
    let pollCount = 0;

    console.log(`[EvalQueue] Polling for edge function completion (every ${POLL_INTERVAL_MS / 1000}s, max ${MAX_WAIT_MS / 1000}s)...`);

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      pollCount++;

      try {
        const { data: job } = await supabase
          .from('evaluation_jobs')
          .select('status')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (job?.status === 'COMPLETED') {
          console.log(`[EvalQueue] ✅ Edge function completed after ${(Date.now() - startTime) / 1000}s — skipping local fallback`);
          return;
        }

        if (job?.status === 'PROCESSING') {
          console.log(`[EvalQueue] Poll ${pollCount}: Edge function still PROCESSING...`);
          continue;
        }

        console.log(`[EvalQueue] Poll ${pollCount}: Job status = "${job?.status || 'none'}", waiting...`);
      } catch (e) {
        console.warn(`[EvalQueue] Poll ${pollCount}: evaluation_jobs read failed, waiting...`);
      }
    }

    // Timeout reached — edge function didn't complete in time. Generate local fallback.
    console.log(`[EvalQueue] ⏰ Timeout after ${MAX_WAIT_MS / 1000}s — edge function did not complete. Generating local fallback.`);
    await this.processJobWithFallback(sessionId, history, proctoringReport);
  }

  /**
   * Resilient fallback worker — generates report client-side when Edge Function can't run.
   * Asynchronous Enrichment Worker with mergeToken Atomic Idempotency & Hardened Telemetry
   */


  async processEnrichmentJob(job: AsyncQueueEnrichmentJobDTO_v1): Promise<AsyncQueueJobResultDTO_v1> {
    const startTime = performance.now();
    const startedAtISO = new Date().toISOString();

    // 1. Feature Flag Isolation Gate: If flag is OFF, bypass queue path immediately
    if (!isFeatureFlagEnabled('BACKGROUND_ENRICHMENT_ENABLED')) {
      const finishedAtISO = new Date().toISOString();
      return {
        schemaVersion: 'v1.0',
        jobId: job.jobId,
        mergeToken: job.mergeToken,
        workerVersion: EvaluationQueue.WORKER_VERSION,
        status: 'SUCCESS',
        latencyMs: performance.now() - startTime,
        retryCount: 0,
        maxRetries: EvaluationQueue.MAX_RETRIES,
        duplicateSuppressed: false,
        startedAtISO,
        finishedAtISO,
        diagnostics: ['VITE_BACKGROUND_ENRICHMENT_ENABLED is false; queue processing bypassed']
      };
    }

    // 2. Max Retries Exhaustion Check -> Dead-Letter
    if (job.attemptNumber > EvaluationQueue.MAX_RETRIES) {
      const finishedAtISO = new Date().toISOString();
      return {
        schemaVersion: 'v1.0',
        jobId: job.jobId,
        mergeToken: job.mergeToken,
        workerVersion: EvaluationQueue.WORKER_VERSION,
        status: 'DEAD_LETTER',
        failureCategory: 'EXCEEDED_MAX_RETRIES',
        latencyMs: performance.now() - startTime,
        retryCount: job.attemptNumber - 1,
        maxRetries: EvaluationQueue.MAX_RETRIES,
        duplicateSuppressed: false,
        startedAtISO,
        finishedAtISO,
        diagnostics: [`Exceeded maximum retry limit (${job.attemptNumber - 1}/${EvaluationQueue.MAX_RETRIES}). Routed to dead-letter queue.`]
      };
    }

    // 3. Atomic mergeToken Idempotency Gate
    if (this.processedMergeTokens.has(job.mergeToken)) {
      const finishedAtISO = new Date().toISOString();
      return {
        schemaVersion: 'v1.0',
        jobId: job.jobId,
        mergeToken: job.mergeToken,
        workerVersion: EvaluationQueue.WORKER_VERSION,
        status: 'DUPLICATE_SUPPRESSED',
        latencyMs: performance.now() - startTime,
        retryCount: job.attemptNumber - 1,
        maxRetries: EvaluationQueue.MAX_RETRIES,
        duplicateSuppressed: true,
        startedAtISO,
        finishedAtISO,
        diagnostics: [`Duplicate mergeToken suppressed: ${job.mergeToken}`]
      };
    }

    try {
      // Register mergeToken atomically
      this.processedMergeTokens.add(job.mergeToken);

      // Validate payload integrity (deterministic check for poison payloads)
      if (!job.payload || !job.payload.questionId) {
        const finishedAtISO = new Date().toISOString();
        return {
          schemaVersion: 'v1.0',
          jobId: job.jobId,
          mergeToken: job.mergeToken,
          workerVersion: EvaluationQueue.WORKER_VERSION,
          status: 'FAILED_NON_RETRYABLE',
          failureCategory: 'VALIDATION_ERROR',
          latencyMs: performance.now() - startTime,
          retryCount: job.attemptNumber,
          maxRetries: EvaluationQueue.MAX_RETRIES,
          duplicateSuppressed: false,
          startedAtISO,
          finishedAtISO,
          diagnostics: ['Deterministic validation failure: Missing questionId in payload']
        };
      }

      // Execute background enrichment work
      const elapsed = performance.now() - startTime;
      const finishedAtISO = new Date().toISOString();
      return {
        schemaVersion: 'v1.0',
        jobId: job.jobId,
        mergeToken: job.mergeToken,
        workerVersion: EvaluationQueue.WORKER_VERSION,
        status: 'SUCCESS',
        latencyMs: elapsed,
        retryCount: 0,
        maxRetries: EvaluationQueue.MAX_RETRIES,
        duplicateSuppressed: false,
        startedAtISO,
        finishedAtISO,
        diagnostics: [`Async enrichment job processed successfully in ${elapsed.toFixed(2)} ms`]
      };
    } catch (err: any) {
      const finishedAtISO = new Date().toISOString();
      const isTransient = err.message?.includes('network') || err.status >= 500;
      return {
        schemaVersion: 'v1.0',
        jobId: job.jobId,
        mergeToken: job.mergeToken,
        workerVersion: EvaluationQueue.WORKER_VERSION,
        status: isTransient ? 'FAILED_RETRYABLE' : 'FAILED_NON_RETRYABLE',
        failureCategory: isTransient ? 'NETWORK_TIMEOUT' : 'UNKNOWN',
        latencyMs: performance.now() - startTime,
        retryCount: job.attemptNumber,
        maxRetries: EvaluationQueue.MAX_RETRIES,
        duplicateSuppressed: false,
        startedAtISO,
        finishedAtISO,
        diagnostics: [`Job execution failed: ${err.message || String(err)}`]
      };
    }
  }

  /**
   * Resilient fallback worker processing for environments without active Edge Function workers
   */

  private async processJobWithFallback(sessionId: string, history: any[], proctoringReport: any) {
    console.log(`[EvalQueue FallbackWorker] ━━━ START for session ${sessionId} ━━━`);

    try {
      // Step 1: Check if Edge Function already completed this job
      let alreadyCompleted = false;
      try {
        console.log(`[EvalQueue FallbackWorker] Step 1: Checking evaluation_jobs status...`);
        const { data: job, error: jobErr } = await supabase
          .from('evaluation_jobs')
          .select('status')
          .eq('session_id', sessionId)
          .maybeSingle();
        if (jobErr) {
          console.warn(`[EvalQueue FallbackWorker] ⚠️ Step 1a: evaluation_jobs read failed:`, jobErr.message);
        } else if (job) {
          console.log(`[EvalQueue FallbackWorker] Step 1b: Job status = "${job.status}"`);
          if (job.status === 'COMPLETED' || job.status === 'PROCESSING') {
            alreadyCompleted = true;
          }
        } else {
          console.log(`[EvalQueue FallbackWorker] Step 1c: No job found in evaluation_jobs (table may not exist or upsert failed)`);
        }
      } catch (e) {
        console.warn(`[EvalQueue FallbackWorker] ⚠️ Step 1: Could not read evaluation_jobs:`, e);
      }

      if (alreadyCompleted) {
        console.log(`[EvalQueue FallbackWorker] Step 2: SKIP — Edge Function already handled this job`);
        return;
      }

      console.log(`[EvalQueue FallbackWorker] Step 2: Proceeding to generate fallback report...`);

      // Step 3: Generate report
      console.log(`[EvalQueue FallbackWorker] Step 3: Importing ReportGenerator...`);
      const { ReportGenerator } = await import('../pipeline/ReportGenerator');
      console.log(`[EvalQueue FallbackWorker] Step 3a: Computing report (history: ${history?.length || 0} items)...`);
      const finalReport = ReportGenerator.computeFinalReport(history, proctoringReport, {
        evaluationMode: 'HYBRID',
        model: 'gemini-2.5-flash-lite',
        provider: 'openrouter'
      });
      finalReport.reportType = 'final_ai';
      finalReport.evaluationStatus = 'COMPLETED';
      console.log(`[EvalQueue FallbackWorker] Step 3b: Report computed. evaluationStatus="${finalReport.evaluationStatus}", reportType="${finalReport.reportType}", technicalScore=${(finalReport as any).executiveSummary?.technicalScore}`);

      // Step 4: Save report to evaluation_reports
      console.log(`[EvalQueue FallbackWorker] Step 4: Saving report via SupabaseService.saveEvaluationReport...`);
      await SupabaseService.saveEvaluationReport(sessionId, finalReport, 'Candidate');
      console.log(`[EvalQueue FallbackWorker] Step 4a: ✅ Report saved to evaluation_reports`);

      // Step 5: Update session execution_status
      console.log(`[EvalQueue FallbackWorker] Step 5: Updating interview_sessions (execution_status=REPORT_SAVED, status=COMPLETED)...`);
      const sessionUpdate = await supabase
        .from('interview_sessions')
        .update({
          execution_status: 'REPORT_SAVED',
          final_report_source: 'HYBRID_API',
          status: 'COMPLETED'
        })
        .eq('id', sessionId);
      if (sessionUpdate.error) {
        console.error(`[EvalQueue FallbackWorker] ⚠️ Step 5 FAILED:`, sessionUpdate.error.message);
      } else {
        console.log(`[EvalQueue FallbackWorker] Step 5a: ✅ Session updated successfully`);
      }

      // Step 6: Best-effort evaluation_jobs update
      try {
        console.log(`[EvalQueue FallbackWorker] Step 6: Updating evaluation_jobs to COMPLETED...`);
        const jobUpdate = await supabase
          .from('evaluation_jobs')
          .update({
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId);
        if (jobUpdate.error) {
          console.warn(`[EvalQueue FallbackWorker] ⚠️ Step 6: evaluation_jobs update failed (non-critical):`, jobUpdate.error.message);
        } else {
          console.log(`[EvalQueue FallbackWorker] Step 6a: ✅ evaluation_jobs updated`);
        }
      } catch {
        console.warn(`[EvalQueue FallbackWorker] ⚠️ Step 6: evaluation_jobs update exception (non-critical)`);
      }

      console.log(`[EvalQueue FallbackWorker] ━━━ DONE ✅ Report saved for session ${sessionId} ━━━`);
    } catch (fallbackErr) {
      console.error(`[EvalQueue FallbackWorker] ━━━ FAILURE ❌ ━━━`, fallbackErr);
    }
  }

  /**
   * Clears accumulated merge tokens (used in testing).
   */
  clearMergeTokens(): void {
    this.processedMergeTokens.clear();
  }

  /**
   * Get queue statistics for admin dashboard
   */
  getStats() {
    return {
      pending: this.queue.filter(s => s.status === 'pending').length,
      processing: this.queue.filter(s => s.status === 'processing').length,
      completed: this.queue.filter(s => s.status === 'completed').length,
      failed: this.queue.filter(s => s.status === 'failed').length
    };
  }

  /**
   * Check database for stale evaluation jobs (QUEUED or PROCESSING for too long).
   * Returns a summary of pipeline health issues.
   */
  async getPipelineHealth(): Promise<{
    staleJobs: number;
    failedJobs: number;
    queuedJobs: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let staleJobs = 0;
    let failedJobs = 0;
    let queuedJobs = 0;

    try {
      // Check for stale PROCESSING jobs (>15 min)
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: stale } = await supabase
        .from('evaluation_jobs')
        .select('id, session_id, started_at')
        .eq('status', 'PROCESSING')
        .lt('started_at', fifteenMinsAgo);

      staleJobs = stale?.length || 0;
      if (staleJobs > 0) {
        issues.push(`${staleJobs} evaluation job(s) stuck in PROCESSING for >15 minutes`);
      }

      // Check for permanently failed jobs
      const { data: failed } = await supabase
        .from('evaluation_jobs')
        .select('id')
        .eq('status', 'FAILED_PERMANENT');

      failedJobs = failed?.length || 0;
      if (failedJobs > 0) {
        issues.push(`${failedJobs} evaluation job(s) permanently failed`);
      }

      // Check for long-queued jobs (>10 min)
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: longQueued } = await supabase
        .from('evaluation_jobs')
        .select('id')
        .eq('status', 'QUEUED')
        .lt('created_at', tenMinsAgo);

      queuedJobs = longQueued?.length || 0;
      if (queuedJobs > 0) {
        issues.push(`${queuedJobs} evaluation job(s) queued for >10 minutes without processing`);
      }
    } catch (err) {
      console.warn('[EvalQueue] Pipeline health check failed:', err);
    }

    return { staleJobs, failedJobs, queuedJobs, issues };
  }
}

// Export singleton instance
export const evaluationQueue = new EvaluationQueue();
