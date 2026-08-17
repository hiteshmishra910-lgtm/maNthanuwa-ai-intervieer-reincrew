import { supabase } from '../../Core/database/supabaseClient';
import { EvaluationContext } from '../types/EvaluationContext';
import { ReadonlyEvaluationResult } from '../../../types';
import { EvaluationDispatcher } from '../dispatch/EvaluationDispatcher';

export interface AuditEventPayload {
  context: EvaluationContext;
  result: ReadonlyEvaluationResult;
  latencyMs: number;
  provider: string;
  model: string;
  promptVersion: string;
  cacheHit: boolean;
  retryCount: number;
  tokensIn?: number;
  tokensOut?: number;
  fallbackUsed?: boolean;
  success?: boolean;
  error?: string | null;
}

export class AuditLogger {
  private static instance: AuditLogger;

  private constructor() {
    // Automatically subscribe to the dispatcher
    EvaluationDispatcher.getInstance().onEvaluationCompleted(this.logEvaluation.bind(this));
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Generates a deterministic SHA-256 hash for the audit record.
   */
  private async computeHash(payload: AuditEventPayload): Promise<string> {
    const data = [
      payload.context.question.id,
      payload.context.response,
      payload.promptVersion,
      'v1', // rubricVersion (placeholder until we have it dynamically)
      payload.model,
      payload.context.evaluationProfile.id
    ].join('|');

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Best-effort, fire-and-forget audit logging.
   * This is explicitly asynchronous and catches all internal errors to avoid
   * blocking or crashing the evaluation flow.
   */
  public logEvaluation(payload: AuditEventPayload): void {
    // Fire and forget immediately
    this.processLogAsync(payload).catch((error) => {
      // 1. Catch the exception
      // 2. Write it to existing application/error logging service
      console.warn('[AuditLogger] Failed to persist audit log (non-critical):', error.message || error);
      
      // 3. Increment internal metric
      // (Assuming a global metrics object or telemetry service exists; falling back to console metrics here)
      if ((window as any).__telemetry) {
        (window as any).__telemetry.increment('audit_logging_failures');
      }
      
      // 4. Never retry synchronously. We swallow the error so candidates are unaffected.
    });
  }

  private async processLogAsync(payload: AuditEventPayload): Promise<void> {
    const hash = await this.computeHash(payload);

    // Slim down the evaluation result for storage
    const { 
      evaluationMetadata,
      executiveSummary, 
      ...slimResult 
    } = payload.result as any;

    const DEFAULT_PROFILE_VERSION_UUID = '00000000-0000-0000-0000-000000000001';
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawProfileId = payload.context.evaluationProfile?.id;
    const profileVersionId = (rawProfileId && uuidRegex.test(rawProfileId))
      ? rawProfileId
      : DEFAULT_PROFILE_VERSION_UUID;

    const resMeta = (payload.result as any)?.evaluationMetadata || {};
    const evalSource = resMeta.evaluationSource || (payload.fallbackUsed ? 'LOCAL' : 'API');
    const fallbackReason = resMeta.fallbackReason || (payload.fallbackUsed ? 'UNKNOWN' : 'NONE');

    const auditEntry = {
      session_id: payload.context.session.id,
      question_id: payload.context.question.id,
      provider: payload.provider,
      model: payload.model,
      prompt_version: payload.promptVersion || 'v2.2.0',
      profile_version_id: profileVersionId,
      cache_hit: payload.cacheHit,
      latency_ms: payload.latencyMs,
      retry_count: payload.retryCount,
      hash: hash,
      evaluation_result: slimResult,
      replay_metadata: {
        temperature: 0.2,
        topP: 0.9,
        provider: payload.provider,
        model: payload.model,
        promptVersion: payload.promptVersion || 'v2.2.0',
        evaluationSource: evalSource,
        fallbackReason: fallbackReason,
        systemPromptHash: 'sys-prompt-hash-123',
        seed: null
      },
      raw_input_snapshot: null
    };

    try {
      const { error: auditError } = await supabase
        .from('evaluation_audit_log')
        .insert([auditEntry]);

      if (auditError) {
        console.warn(`[AuditLogger] evaluation_audit_log insert skipped: ${auditError.message}`);
      }
    } catch (auditErr: any) {
      console.warn(`[AuditLogger] evaluation_audit_log failed: ${auditErr?.message || auditErr}`);
    }

    // Write to ai_provider_logs
    try {
      const providerEntry = {
        session_id: payload.context.session.id,
        provider_name: payload.provider,
        model_used: payload.model,
        purpose: 'eval',
        response_time_ms: payload.latencyMs,
        success: payload.success ?? true,
        error_type: payload.error || null,
        response_length: payload.tokensOut || 0,
        tokens_in: payload.tokensIn || 0,
      };

      const { error: providerError } = await supabase
        .from('ai_provider_logs')
        .insert([providerEntry]);

      if (providerError) {
        console.warn(`[AuditLogger] ai_provider_logs insert skipped: ${providerError.message}`);
      }
    } catch (provErr: any) {
      console.warn(`[AuditLogger] ai_provider_logs failed: ${provErr?.message || provErr}`);
    }
  }
}

export const auditLogger = AuditLogger.getInstance();
