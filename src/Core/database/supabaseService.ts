import {supabase} from "./supabaseClient";
import {
  Candidate,
  JobPost,
  Question,
  RoleSettings,
  EvaluationResult,
  InterviewSession,
  ProctoringReport,
  ProctorViolation,
  TimelineEvent,
  DashboardTelemetry,
  ProctoringSettings,
  DEFAULT_PROCTORING_SETTINGS,
  ensureFeedbackStructure,
  InterviewAssignment,
} from "../../../types";
import { ErrorLogService } from "../logging/errorLogService";

import { PerformanceLogger } from "../../Analytics/services/PerformanceLogger";
import { markReportGenerated } from "../utils/cleanupService";

import { JOB_TEMPLATES } from "./jobSeedRepository";
import { assertNotDemoEntity, isDemoSessionId } from "../demo/demoGuards";
import { sessionEvents } from "../events/sessionEvents";
import { normalizeScore, resolveCanonicalOverallScore } from "../utils/sessionStatusResolver";

export class SupabaseService {
  static logStatusChange: any;

  private static jobsCache: { data: JobPost[]; expiry: number } | null = null;
  private static readonly JOBS_CACHE_TTL_MS = 5 * 60 * 1000;

  // OPTIMIZATION: Cache admin dashboard sessions for 60 seconds to avoid repeated heavy view queries
  private static sessionsCache: { data: any[]; expiry: number } | null = null;
  private static readonly SESSIONS_CACHE_TTL_MS = 60 * 1000;

  static invalidateSessionData(): void {
    this.sessionsCache = null;
    this.jobsCache = null;
  }

  static async seedDefaultJobsIfMissing() {
    try {
      const { data: existingJobs, error } = await supabase
        .from("job_posts")
        .select("id, title");
      if (error) throw error;

      const existingTitles = existingJobs
        ? existingJobs.map((j) => j.title.toLowerCase())
        : [];

      for (const seed of JOB_TEMPLATES) {
        if (!existingTitles.includes(seed.title.toLowerCase())) {
          console.log(`Seeding default job post: ${seed.title}`);
          
          const isVoice = seed.assessmentType === "VOICE_INTERVIEW";
          const settings = {
            role: seed.role,
            template: isVoice ? "DEFAULT" : "APTITUDE",
            version: 1,
            difficulty: "Medium",
            preset: "Normal",
            assessmentType: seed.assessmentType,
            weights: isVoice 
              ? { concept: 50, grammar: 20, fluency: 20, camera: 10 }
              : { concept: 100, grammar: 0, fluency: 0, camera: 0 },
            proctoring: {
              maxWarnings: 3,
              sensitivity: "Medium",
              includeInScore: true,
            }
          };

          const { error: insertError } = await supabase
            .from("job_posts")
            .insert({
              title: seed.title,
              description: seed.description,
              mode: "AI",
              status: "ACTIVE",
              difficulty: "Medium",
              company: "Reicrew AI",
              questions: [], // No duplicate question lists in DB
              settings: settings,
            });

          if (insertError) {
            console.error(`Failed to seed ${seed.title}:`, insertError.message);
            ErrorLogService.logError(
              "database",
              `Failed to seed default job post ${seed.title}: ${insertError.message}`,
              insertError,
            );
          }
        }
      }
    } catch (e: any) {
      console.error("Database seeding check failed:", e);
      ErrorLogService.logError(
        "system",
        `Database seeding check failed: ${e.message || e}`,
        e,
      );
    }
  }

  // ==========================================
  // CANDIDATES
  // ==========================================
  static async upsertCandidate(candidate: {
    name: string;
    email: string;
    role?: string;
    clerk_user_id?: string;
  },
  token?: string   
) {
    return PerformanceLogger.measure("upsertCandidate", async () => {
      assertNotDemoEntity(candidate, "upsertCandidate");

      // Step 1: Check by clerk_user_id first
      const { data: existingByClerkId } = await supabase
        .from("candidates")
        .select("*")
        .eq("clerk_user_id", candidate.clerk_user_id)
        .maybeSingle();

      if (existingByClerkId) return existingByClerkId;

      // Step 2: Check by email (account may exist without clerk_user_id)
      const { data: existingByEmail } = await supabase
        .from("candidates")
        .select("*")
        .eq("email", candidate.email)
        .maybeSingle();

      if (existingByEmail) {
        // Update the existing record with the clerk_user_id
        const { data: updated } = await supabase
          .from("candidates")
          .update({ clerk_user_id: candidate.clerk_user_id })
          .eq("email", candidate.email)
          .select("*")
          .single();
        return updated;
      }

      // Step 3: Fresh insert
      const { data, error } = await supabase
        .from("candidates")
        .insert({
          name: candidate.name,
          email: candidate.email,
          applied_role: candidate.role,
          clerk_user_id: candidate.clerk_user_id,
        })
        .select("*")
        .single();

          if (error?.code === '23505') {
          const { data: existing } = await supabase
            .from("candidates")
            .select("*")
            .eq("email", candidate.email)
            .single();
          return existing;
        }

        if (error) throw error;
        return data;
    });
  }

  static async getCandidateByEmail(email: string) {
    return PerformanceLogger.measure("getCandidateByEmail", async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 is not found
      return data;
    });
  }

  // ==========================================
  // JOB POSTS
  // ==========================================
  static async getJobById(jobId: string) {
    return PerformanceLogger.measure("getJobById", async () => {
      const { data, error } = await supabase
        .from("job_posts")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (error) throw error;
      return data;
    });
  }

  static async getAllJobs() {
    return PerformanceLogger.measure("getAllJobs", async () => {
      if (this.jobsCache && Date.now() < this.jobsCache.expiry) {
        return this.jobsCache.data;
      }
      const { data, error } = await supabase.from("job_posts").select("*");
      if (error) throw error;
      this.jobsCache = {
        data: data as JobPost[],
        expiry: Date.now() + this.JOBS_CACHE_TTL_MS,
      };
      return data;
    });
  }

  // ==========================================
  // SESSION CREATION & LIFECYCLE
  // ==========================================
  static async createSession(
    candidateId: string,
    jobPostId?: string,
    deviceInfo?: any,
    metadata?: any,
    candidateName?: string,
    driveId?: string,
  ) {
    return PerformanceLogger.measure("createSession", async () => {
      let jobSettingsSnapshot: any = {};
      let globalEvalMode: string | null = null;
      try {
        // Parallelize independent queries — both only need IDs available at call time
        const [jobResult, modeResult] = await Promise.all([
          jobPostId
            ? supabase.from("job_posts").select("settings").eq("id", jobPostId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          SupabaseService.getSystemSettings("evaluation_mode")
        ]);
        if (jobResult.data && jobResult.data.settings) {
          jobSettingsSnapshot = jobResult.data.settings;
        }
        globalEvalMode = modeResult;
      } catch (jobErr) {
        console.warn("[createSession] Failed to fetch settings snapshot:", jobErr);
      }

      const targetDriveId = driveId || metadata?.driveId || metadata?.drive_id || null;
      const rawMode = metadata?.evaluationMode || globalEvalMode || 'API';
      const effectiveMode = (() => {
        const norm = String(rawMode || '').toUpperCase().replace(/['"]+/g, '').trim();
        if (norm === 'HYBRID') return 'HYBRID';
        if (norm === 'LOCAL') return 'LOCAL';
        return 'API';
      })();

      const payload: any = {
        candidate_id: candidateId,
        candidate_name: candidateName || metadata?.candidateName || null,
        status: "CREATED",
        configured_evaluation_mode: effectiveMode,
        configured_provider: "OpenRouter", // Hardcoded for now based on aiService
        configured_model: "openrouter/free", // Defaulting to the eval model used in aiService
        configured_prompt_version: "v3.2",
        configured_scoring_version: "v1.0",
        evaluation_engine_version: "v2.4.1",
        execution_status: "PENDING",
        interview_metadata: {
          device_info: deviceInfo || {},
          job_settings_snapshot: jobSettingsSnapshot,
          ...(targetDriveId ? { drive_id: targetDriveId } : {}),
          // `...metadata` is spread BEFORE evaluationMode, not after.
          //
          // effectiveMode already gives metadata.evaluationMode top priority, so spreading
          // metadata afterwards could only ever re-apply the same value — or, when the caller
          // passed an explicitly null/empty evaluationMode, overwrite the resolved mode with
          // that empty value and leave the session with no recorded mode at all. Since this
          // field is now the dashboards' source of truth for how a candidate was assessed, the
          // resolved value must win.
          ...metadata,
          evaluationMode: effectiveMode,
        },
      };
      if (jobPostId) payload.job_post_id = jobPostId;
      if (targetDriveId) payload.drive_id = targetDriveId;

      const { data, error } = await supabase
        .from("interview_sessions")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        ErrorLogService.logError(
          "database",
          `Create session failed: ${error.message}`,
          error,
          undefined,
          candidateName,
        );
        throw error;
      }

      return data;
    });
  }

  static async logEvaluationLifecycle(
    sessionId: string,
    actor: string,
    component: string,
    eventType: string,
    details?: any
  ) {
    try {
      const { error } = await supabase
        .from('evaluation_lifecycle_logs')
        .insert({
          session_id: sessionId,
          actor,
          component,
          event_type: eventType,
          details: details || {}
        });
      if (error) {
        console.warn('[logEvaluationLifecycle] Failed to log event:', error);
      }
    } catch (err) {
      console.warn('[logEvaluationLifecycle] Exception while logging:', err);
    }
  }

  static async getAllSessions(forceRefresh = false) {
     return PerformanceLogger.measure("getAllSessions", async () => {

      if (forceRefresh) {
        this.invalidateSessionsCache();
      }

      // OPTIMIZATION: Return cached result if still fresh (admin dashboard reloads frequently)
      if (this.sessionsCache && Date.now() < this.sessionsCache.expiry) {
        return this.sessionsCache.data;
      }
      const { data: masterRecords, error } =  await supabase
        .from("vw_candidate_master")
        .select("*")
        .or("session_status.neq.CREATED,questions_answered.gt.0")
        .order("interview_date", { ascending: false })
    

      if (error) {
        console.error("Supabase getAllSessions error:", error);
        ErrorLogService.logError(
          "database",
          `Get all sessions failed: ${error.message}`,
          error,
        );
        throw error;
      }

      if (!masterRecords || masterRecords.length === 0) return [];

      // PHASE 2: exclude candidate practice runs from recruiter-facing feeds.
      // Practice sessions are stored in interview_sessions alongside real interviews
      // (usePracticeSession.ts:115) and previously appeared in the Admin/HR candidate tables,
      // the CSV export and the analytics averages as if they were genuine submissions.
      //
      // Filtered here rather than in the query on purpose: `is_practice` is added to
      // vw_candidate_master by migration 20260729. Filtering in TypeScript means this code is
      // safe to deploy before or after that migration — while the column is absent the value is
      // undefined, which is falsy, so behaviour is exactly as it is today.
      //
      // The candidate's own history is unaffected: it uses getStudentSessions(), not this view.
      const realInterviewRecords = masterRecords.filter((r: any) => {
        if (r.is_practice === true) return false;
        if (r.session_status === 'IN_PROGRESS' && (r.questions_answered || 0) === 0) {
          const hasCompletedOrAnswered = masterRecords.some((other: any) =>
            other.session_id !== r.session_id &&
            other.candidate_email === r.candidate_email &&
            (other.session_status === 'COMPLETED' || (other.questions_answered || 0) > 0)
          );
          if (hasCompletedOrAnswered) return false;
        }
        return true;
      });

      //  Only fetch rows for the sessions we actually have, not entire tables
      const sessionIds = realInterviewRecords.map((r) => r.session_id);

      try {
        const [responsesResult, reportsResult, violationsResult] =
          await Promise.all([
            supabase
              .from("session_responses")
              .select("session_id, question_text, candidate_answer, content_score, grammar_score, fluency_score, verdict, feedback")
              .in("session_id", sessionIds),
            supabase
              .from("evaluation_reports")
              .select("session_id, evaluation_logic, final_verdict, verdict_justification")
              .in("session_id", sessionIds),
            supabase
              .from("proctoring_events")
              .select("*")
              .in("session_id", sessionIds),
          ]);

        // Log errors from individual queries instead of swallowing them.
        // A single failing query previously made ALL sessions appear to have
        // no responses, no evaluation reports, and no proctoring events.
        if (responsesResult.error) {
          console.error("[getAllSessions] session_responses query failed:", responsesResult.error.message);
        }
        if (reportsResult.error) {
          console.error("[getAllSessions] evaluation_reports query failed:", reportsResult.error.message);
        }
        if (violationsResult.error) {
          console.error("[getAllSessions] proctoring_events query failed:", violationsResult.error.message);
        }

        const responses = responsesResult.data || [];
        const reports = reportsResult.data || [];
        const violations = violationsResult.data || [];

        const responseMap = new Map<string, any[]>();
        responses?.forEach((response) => {
          const existing = responseMap.get(response.session_id) || [];
          existing.push(response);
          responseMap.set(response.session_id, existing);
        });

        const reportMap = new Map<string, any>();
        reports?.forEach((report) => reportMap.set(report.session_id, report));

        const violationMap = new Map<string, any[]>();
        violations?.forEach((violation) => {
          const existing = violationMap.get(violation.session_id) || [];
          existing.push(violation);
          violationMap.set(violation.session_id, existing);
        });

        const result =  realInterviewRecords.map((record) => {
          const sessionId = record.session_id;
          const sessionResponses = responseMap.get(sessionId) || [];
          const sessionReport = reportMap.get(sessionId) || null;
          const sessionViolations = violationMap.get(sessionId) || [];

          return {
            session_id: record.session_id,
            candidate_name: record.candidate_name,
            candidate_email: record.candidate_email,
            job_title: record.role,
            role: record.role,
            session_status: record.session_status,
            session_date: record.interview_date,
            total_score: record.overall_score,
            duration_minutes: record.duration_minutes,
            questions_asked: record.questions_asked,
            questions_answered: record.questions_answered,
            strengths: record.strengths || [],
            weaknesses: record.weaknesses || [],
            risk_score: record.risk_score,
            risk_level: record.risk_level,
            recommendation: record.recommendation,
            candidate_outcome: record.candidate_outcome,
            all_questions_and_answers: sessionResponses.map((r) => ({
              question_text: r.question_text,
              candidate_answer: r.candidate_answer,
              content_score: r.content_score,
              grammar_score: r.grammar_score,
              fluency_score: r.fluency_score,
              verdict: r.verdict,
              feedback: ensureFeedbackStructure(r.feedback),
            })),
            all_proctoring_events: sessionViolations.map((v) => ({
              type: v.event_type || v.type,
              severity: v.severity,
              message: v.detail || v.message,
              time: v.occurred_at || v.timestamp,
              snapshot_url: v.snapshot_url,
              clip_url: v.clip_url,
            })),
            evaluation_logic: sessionReport?.evaluation_logic ?? null,
            final_verdict: sessionReport?.final_verdict ?? null,
            verdict_justification: sessionReport?.verdict_justification ?? null,
            // The mode this session was CONFIGURED to run in, captured by createSession and
            // surfaced by migration 20260801. Without it the dashboards had no source for the
            // mode other than a saved evaluation report, so any session lacking a report was
            // displayed as LOCAL regardless of how it was actually set up.
            evaluation_mode: record.evaluation_mode ?? null,
            configured_evaluation_mode: record.configured_evaluation_mode ?? record.evaluation_mode ?? null,
            configured_provider: record.configured_provider ?? 'OpenRouter',
            configured_model: record.configured_model ?? 'openrouter/free',
            execution_status: record.execution_status ?? 'PENDING',
            execution_attempt_mode: record.execution_attempt_mode ?? record.evaluation_mode ?? null,
            fallback_mode: record.fallback_mode ?? null,
            final_report_source: record.final_report_source ?? null,
            failure_reason: record.failure_reason ?? null,
            is_deleted: record.is_deleted,
          };
        });
        this.sessionsCache = { data: result, expiry: Date.now() + this.SESSIONS_CACHE_TTL_MS };
        return result;
      } catch (e) {
        console.warn("Failed to manually join session data:", e);
        // Degraded path must apply the same practice filter as the primary path.
        return realInterviewRecords.map((record) => ({
          session_id: record.session_id,
          candidate_name: record.candidate_name,
          candidate_email: record.candidate_email,
          job_title: record.role,
          role: record.role,
          session_status: record.session_status,
          session_date: record.interview_date,
          total_score: record.overall_score,
          duration_minutes: record.duration_minutes,
          questions_asked: record.questions_asked,
          questions_answered: record.questions_answered,
          strengths: record.strengths || [],
          weaknesses: record.weaknesses || [],
          evaluation_mode: record.evaluation_mode ?? null,
          configured_evaluation_mode: record.configured_evaluation_mode ?? record.evaluation_mode ?? null,
          configured_provider: record.configured_provider ?? 'OpenRouter',
          configured_model: record.configured_model ?? 'openrouter/free',
          execution_status: record.execution_status ?? 'PENDING',
          execution_attempt_mode: record.execution_attempt_mode ?? record.evaluation_mode ?? null,
          fallback_mode: record.fallback_mode ?? null,
          final_report_source: record.final_report_source ?? null,
          failure_reason: record.failure_reason ?? null,
          is_deleted: record.is_deleted,
        }));
      }
    });
  }

  static invalidateSessionsCache() {
    this.invalidateSessionData();
  }

  static async updateSessionStatus(
    sessionId: string,
    newStatus: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "TERMINATED",
    reason?: string,
  ) {
    if (isDemoSessionId(sessionId)) return;

    const { data: session } = await supabase
      .from("interview_sessions")
      .select("status")
      .eq("id", sessionId)
      .maybeSingle();

    if (session) {
      const current = session.status;
      if (current === newStatus) return; // Idempotent no-op
      if (current === "COMPLETED" || current === "TERMINATED") {
        console.warn(`[updateSessionStatus] Rejected invalid transition ${current} -> ${newStatus} for session ${sessionId}`);
        return;
      }
    }

    const payload: any = {
      status: newStatus,
      ...(reason ? { termination_reason: reason } : {}),
      ...(newStatus === "TERMINATED" || newStatus === "COMPLETED" ? { completed_at: new Date().toISOString() } : {}),
    };

    const { error } = await supabase
      .from("interview_sessions")
      .update(payload)
      .eq("id", sessionId);

    if (error) throw error;

    // Post-write cache invalidation & event emission
    this.invalidateSessionData();
    sessionEvents.emit({
      sessionId,
      action: newStatus === 'COMPLETED' ? 'created' : 'updated',
    });
  }

  static async updateCandidateOutcome(
    sessionId: string,
    outcome: string,
    wasOverridden: boolean = false,
    reviewerNotes?: string,
    reviewerName?: string,
  ): Promise<boolean> {
    if (isDemoSessionId(sessionId)) return true;
    return PerformanceLogger.measure("updateCandidateOutcome", async () => {
      const reviewedAt = new Date().toISOString();
      const sessionPayload: any = {
        candidate_outcome: outcome,
      };

      const reportPayload: any = {
        candidate_outcome: outcome,
        was_overridden: wasOverridden,
        reviewer_notes: reviewerNotes || null,
        reviewer_name: reviewerName || 'Recruiter',
        reviewed_at: reviewedAt,
      };

      const [sessionRes, reportRes] = await Promise.all([
        supabase.from("interview_sessions").update(sessionPayload).eq("id", sessionId),
        supabase.from("evaluation_reports").update(reportPayload).eq("session_id", sessionId),
      ]);

      if (sessionRes.error) {
        console.error("[SupabaseService] Session outcome update failed:", sessionRes.error);
      }
      if (reportRes.error) {
        console.error("[SupabaseService] Evaluation report outcome update failed:", reportRes.error);
      }

      const success = !sessionRes.error && !reportRes.error;
      if (success) {
        this.invalidateSessionData();
        sessionEvents.emit({
          sessionId,
          action: 'evaluation-updated',
        });
      }
      return success;
    });
  }

  static async completeSession(
    sessionId: string,
    durationSeconds: number,
    status: "COMPLETED" | "TERMINATED" = "COMPLETED",
    totalQuestions?: number,
    terminationReason?: string,
  ) {
    const { data: existing } = await supabase
      .from("interview_sessions")
      .select("status")
      .eq("id", sessionId)
      .maybeSingle();

    if (existing && (existing.status === "COMPLETED" || existing.status === "TERMINATED")) {
      console.warn(
        `[completeSession] Ignored ${status} for session ${sessionId}: already ${existing.status}. ` +
        `Preserving recorded duration and question count.`
      );
      return;
    }

    const payload: any = {
      status: status,
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      ...(terminationReason ? { termination_reason: terminationReason } : {}),
    };
    if (totalQuestions !== undefined && totalQuestions !== null) {
      payload.total_questions = totalQuestions;
    }

    const { error } = await supabase
      .from("interview_sessions")
      .update(payload)
      .eq("id", sessionId);

    if (error) throw error;
    this.invalidateSessionData();
    sessionEvents.emit({
      sessionId,
      action: status === 'COMPLETED' ? 'created' : 'updated',
    });
  }

  // ==========================================
  // SESSION RESPONSES
  // ==========================================
  static async saveResponse(
    sessionId: string,
    questionIndex: number,
    result: any,
    idealAnswer: string,
    candidateName?: string,
    questionTextOverride?: string,
    candidateAnswerOverride?: string,
  ) {
    return PerformanceLogger.measure("saveResponse", async () => {
      const qText = questionTextOverride || result?.questionText || result?.question || result?.question_text || `Question ${questionIndex + 1}`;
      const cAnswer = candidateAnswerOverride || result?.userAnswer || result?.candidate_answer || result?.answer || result?.transcript || '';

      const payload = {
        session_id: sessionId,
        question_index: questionIndex,
        question_text: qText,
        candidate_answer: cAnswer,
        ideal_answer: idealAnswer,

        // Mapping EvaluationResult
        content_score: result.contentScore ?? null,
        grammar_score: result.grammarScore ?? null,
        fluency_score: result.fluencyScore ?? null,

        // Detailed breakdown scores from analysis sub-object
        coverage: result.analysis?.coverage ?? null,
        understanding: result.analysis?.understanding ?? null,
        reasoning: result.analysis?.reasoning ?? null,
        depth: result.analysis?.depth ?? null,
        clarity: result.analysis?.clarity ?? null,
        structure: result.analysis?.structure ?? null,
        confidence: result.analysis?.confidence ?? null,
        consistency: result.analysis?.consistency ?? null,
        answer_directness_score: result.analysis?.answerDirectnessScore ?? null,
        verdict: (() => {
          if (!result.verdict) return null;
          const v = String(result.verdict).toLowerCase();
          if (v.includes("excel") || v.includes("good") || v.includes("pass"))
            return "Pass";
          if (v.includes("border") || v.includes("partial"))
            return "Borderline";
          if (v.includes("fail") || v.includes("poor")) return "Fail";
          return "Borderline";
        })(),
        feedback: result.feedback ? JSON.stringify(result.feedback) : null,

        // Auditable Fields — use explainedConcepts (actually demonstrated) for detected, mentionedConcepts for identified
        expected_key_points: result.mentionedConcepts
          ? [...result.mentionedConcepts, ...(result.missingKeyPoints || [])]
          : result.matchedKeyPoints
            ? [...result.matchedKeyPoints, ...(result.missingKeyPoints || [])]
            : null,
        detected_key_points: result.explainedConcepts?.length
          ? result.explainedConcepts
          : result.matchedKeyPoints || null,
        missing_key_points: result.missingKeyPoints || null,

        deduction_reason: result.expressionAnalysis || null,
      };

      const offlineKey = `offline_response_${sessionId}_${questionIndex}`;
      try {
        localStorage.setItem(offlineKey, JSON.stringify(payload));
      } catch (storageErr) {
        console.warn("[SupabaseService] Offline buffer storage write failed:", storageErr);
      }

      try {
        const { error } = await supabase
          .from("session_responses")
          .upsert(payload, { onConflict: 'session_id,question_index' });

        if (error) throw error;
        // Intentional: the answer is already durably saved to the database at this point. Failing
        // to clear the offline copy is harmless — the next flush re-sends it and the upsert is
        // idempotent — so it must not turn a successful save into an error.
        try { localStorage.removeItem(offlineKey); } catch { /* offline copy left in place */ }
      } catch (error: any) {
        console.error("[SupabaseService] Network error saving response, buffered to local storage:", error);
        ErrorLogService.logError(
          "database",
          `Save response failed for index ${questionIndex}, buffered locally: ${error.message || error}`,
          error,
          sessionId,
          candidateName,
        );

        if (typeof window !== 'undefined') {
          // PHASE 4: re-arm on failure. This listener was registered with { once: true }, so if
          // the retry ran and failed — back online but the server still unreachable, or the
          // token expired — the listener was already gone and the answer was never retried
          // again. Only remove the listener once the write has actually succeeded.
          const retrySync = async () => {
            try {
              const raw = localStorage.getItem(offlineKey);
              if (!raw) {
                window.removeEventListener('online', retrySync);
                return;
              }
              const data = JSON.parse(raw);
              const { error: retryErr } = await supabase.from("session_responses").upsert(data, { onConflict: 'session_id,question_index' });
              if (!retryErr) {
                localStorage.removeItem(offlineKey);
                window.removeEventListener('online', retrySync);
              }
            } catch (_) { /* stay armed for the next 'online' event */ }
          };
          window.addEventListener('online', retrySync);
        }
      }
    });
  }

  static async saveAptitudeResponses(sessionId: string, questionBreakdown: any[]) {
    if (!sessionId || !Array.isArray(questionBreakdown) || questionBreakdown.length === 0) return;
    return PerformanceLogger.measure("saveAptitudeResponses", async () => {
      const records = questionBreakdown.map((q: any, idx: number) => ({
        session_id: sessionId,
        question_index: idx,
        question_text: q.questionText || q.question || `Question ${idx + 1}`,
        candidate_answer: q.userAnswer || 'Unattempted',
        ideal_answer: q.correctAnswer || '',
        content_score: typeof q.score === 'number' ? q.score : (q.score === 10 ? 10 : 0),
        verdict: q.score === 10 ? 'Pass' : 'Fail',
        feedback: typeof q.feedback === 'string' ? JSON.stringify({ observation: q.feedback }) : null,
      }));

      try {
        const { error } = await supabase
          .from("session_responses")
          .upsert(records, { onConflict: 'session_id,question_index' });
        if (error) console.warn("[SupabaseService] saveAptitudeResponses error:", error.message);
      } catch (err: any) {
        console.warn("[SupabaseService] saveAptitudeResponses exception:", err.message || err);
      }
    });
  }

  /**
   * PHASE 4: recover candidate answers stranded in the offline buffer.
   *
   * saveResponse() writes every answer to localStorage under `offline_response_<session>_<idx>`
   * before attempting the network write, and clears it on success. If the write failed the only
   * recovery was a single 'online' listener living in that closure — so an answer was lost for
   * good if the tab was closed while offline, the browser was killed, or the one retry failed.
   * Nothing ever read those keys back.
   *
   * This sweeps every buffered answer and re-attempts it. Safe to call repeatedly and at any
   * time: the write is an upsert on (session_id, question_index), so re-sending an answer that
   * did land is a no-op rather than a duplicate row.
   *
   * @returns count of buffered answers successfully flushed.
   */
  static async flushOfflineResponses(): Promise<number> {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 0;

    let keys: string[] = [];
    try {
      keys = Object.keys(localStorage).filter((k) => k.startsWith('offline_response_'));
    } catch (err) {
      console.warn('[SupabaseService] Could not read offline buffer:', err);
      return 0;
    }
    if (keys.length === 0) return 0;

    console.log(`[SupabaseService] Recovering ${keys.length} buffered answer(s) from a previous session.`);
    let flushed = 0;

    for (const key of keys) {
      let payload: any;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        payload = JSON.parse(raw);
      } catch {
        // Corrupt entry cannot be recovered and would otherwise be retried forever.
        try { localStorage.removeItem(key); } catch { /* ignore */ }
        continue;
      }

      if (!payload.question_text || payload.question_text.trim() === '') {
        console.warn(`[SupabaseService] Dropping corrupt offline entry ${key}: missing question_text`);
        try { localStorage.removeItem(key); } catch { /* ignore */ }
        continue;
      }

      try {
        const { error } = await supabase
          .from('session_responses')
          .upsert(payload, { onConflict: 'session_id,question_index' });

        if (error) throw error;
        localStorage.removeItem(key);
        flushed++;
      } catch (err: any) {
        // Leave it buffered — still offline, or RLS rejected it because this browser is now a
        // different user. Either way, dropping the answer would be worse than keeping it.
        console.warn(`[SupabaseService] Could not flush ${key}, leaving buffered:`, err?.message || err);
      }
    }

    if (flushed > 0) {
      console.log(`[SupabaseService] Recovered ${flushed} previously unsaved answer(s).`);
    }
    return flushed;
  }

  // ==========================================
  // PROCTORING
  // ==========================================
  static async insertProctoringEvents(events: any[]) {
    if (events.length === 0) return;
    const { error } = await supabase.from("proctoring_events").insert(events);
    if (error) {
      console.error("Supabase insertProctoringEvents Error:", error);
      throw error;
    }
  }

  static async updateProctoringEventMedia(
    sessionId: string,
    eventType: string,
    occurredAt: string,
    snapshotUrl?: string | null,
    clipUrl?: string | null
  ) {
    if (!sessionId || (!snapshotUrl && !clipUrl)) return;
    const updatePayload: any = {};
    if (snapshotUrl) updatePayload.snapshot_url = snapshotUrl;
    if (clipUrl) updatePayload.clip_url = clipUrl;

    const { error } = await supabase
      .from("proctoring_events")
      .update(updatePayload)
      .eq("session_id", sessionId)
      .eq("event_type", eventType)
      .eq("occurred_at", occurredAt);

    if (error) {
      console.warn("[updateProctoringEventMedia] Failed to update media:", error.message);
    }
  }

  static async saveProctoringReport(
    sessionId: string,
    report: any,
    telemetry: DashboardTelemetry,
    candidateName?: string,
    flushedEventIds: string[] = [],
  ) {

    return PerformanceLogger.measure("saveProctoringReport", async () => {
    const flushedSet = new Set(flushedEventIds);
    const events: any[] = [];

    // Convert Violations to Events
    if (report.violations && report.violations.length > 0) {
      report.violations.forEach((v: ProctorViolation) => {
        if (!flushedSet.has(v.id)) {
          events.push({
            session_id: sessionId,
            candidate_name: candidateName || null,
            event_type: v.type,
            severity:
              v.severity > 5 ? "High" : v.severity > 2 ? "Medium" : "Low",
            risk_points: v.severity > 5 ? 15 : v.severity > 2 ? 5 : 1,
            message: v.message,
            snapshot_url: v.snapshot_url,
            clip_url: v.clip_url,
            occurred_at: new Date(v.timestamp).toISOString(),
          });
        }
      });
    }

    // Convert Timeline to Events
    if (report.timeline && report.timeline.length > 0) {
      report.timeline.forEach((t: TimelineEvent) => {
        if (t.id && !flushedSet.has(t.id)) {
          events.push({
            session_id: sessionId,
            candidate_name: candidateName || null,
            event_type: t.event,
            severity:
              t.severity > 5 ? "High" : t.severity > 2 ? "Medium" : "Low",
            risk_points: t.severity > 5 ? 10 : t.severity > 2 ? 5 : 1,
            message: t.detail || t.event,
            occurred_at: new Date(t.timestamp).toISOString(),
          });
        }
      });
    }

    if (events.length > 0) {
      // Insert in chunks of 100
      for (let i = 0; i < events.length; i += 100) {
        const chunk = events.slice(i, i + 100);
        const { error } = await supabase
          .from("proctoring_events")
          .insert(chunk);
        if (error) {
          console.error("Supabase Save Proctoring Report Chunk Error:", error);
          throw error;
        }
      }
    }

    return sessionId;
    });
  }

  // ==========================================
  // EVALUATION REPORTS
  // ==========================================
  static async saveEvaluationReport(
    sessionId: string,
    report: any,
    candidateName?: string,
  ) {
    return PerformanceLogger.measure("saveEvaluationReport", async () => {
      // Enforce strict Enum matching for the Postgres CHECK constraint
      const allowedRecommendations = [
        "Strong Hire",
        "Hire",
        "Consider",
        "Reject",
      ];
      let sanitizedRecommendation = "Consider";

      const rec =
        report.executiveSummary?.recommendation || report.hiringRecommendation;
      if (rec) {
        const normalized = rec.trim();
        const match = allowedRecommendations.find(
          (r) => r.toLowerCase() === normalized.toLowerCase(),
        );
        if (match) {
          sanitizedRecommendation = match;
        } else if (normalized.toLowerCase().includes("strong")) {
          sanitizedRecommendation = "Strong Hire";
        } else if (
          normalized.toLowerCase().includes("reject") ||
          normalized.toLowerCase().includes("fail")
        ) {
          sanitizedRecommendation = "Reject";
        } else if (normalized.toLowerCase().includes("hire")) {
          sanitizedRecommendation = "Hire";
        }
      }

      const integrity = report.proctoringSummary?.integrityScore ?? 100;
      const riskScore = 100 - integrity;
      const riskLevel =
        riskScore > 60
          ? "Critical"
          : riskScore > 40
            ? "High"
            : riskScore > 15
              ? "Medium"
              : "Low";
      const riskReason = report.contradictions
        ? report.contradictions.map((c: any) => c.explanation)
        : [];

      let payloadReport = report;
      const MAX_REPORT_SIZE_BYTES = 450 * 1024;
      
      const originalSize = new Blob([JSON.stringify(payloadReport)]).size;
      
      if (originalSize > MAX_REPORT_SIZE_BYTES) {
        payloadReport = {
          ...payloadReport,
          questionBreakdown: Array.isArray(payloadReport.questionBreakdown)
            ? payloadReport.questionBreakdown.map((q: any) => ({
                ...q,
                userAnswer: null
              }))
            : payloadReport.questionBreakdown
        };

        const compressedSize = new Blob([JSON.stringify(payloadReport)]).size;
        
        console.warn(
          `[SupabaseService] Evaluation report compressed for session ${sessionId}. ` +
          `Original: ${(originalSize / 1024).toFixed(1)} KB, ` +
          `Compressed: ${(compressedSize / 1024).toFixed(1)} KB. Candidate: ${candidateName}`
        );

        if (compressedSize > MAX_REPORT_SIZE_BYTES) {
          throw new Error(
            `Evaluation report still exceeds ${MAX_REPORT_SIZE_BYTES} bytes after compression. ` +
            `Original: ${(originalSize / 1024).toFixed(1)} KB, ` +
            `Compressed: ${(compressedSize / 1024).toFixed(1)} KB`
          );
        }
      }

      // Skip inserting evaluation report for 0-answer / unattempted sessions
      if (Array.isArray(report?.questionBreakdown) && report.questionBreakdown.length === 0) {
        console.log(`[SupabaseService] Skipping evaluation report save for unattempted session ${sessionId}`);
        this.invalidateSessionsCache();
        return;
      }

      const canonicalScore = resolveCanonicalOverallScore(report);

      const { error } = await supabase
      .from("evaluation_reports")
      .upsert(
        {
          session_id: sessionId,
          candidate_name: candidateName || null,
          total_score: canonicalScore,
          technical_score: report.executiveSummary?.technicalScore ?? null,
          communication_score: report.overallScores?.communicationScore ?? null,
          confidence_score: report.overallScores?.consistencyScore ?? null,
          proctoring_score: integrity,
          final_verdict:
            report.executiveSummary?.summary ?? report.finalVerdict ?? "",
          hiring_recommendation: sanitizedRecommendation,
          strengths: report.strengths || [],
          failures: report.weaknesses || [],
          verdict_justification:
            report.executiveSummary?.summary ??
            report.verdictJustification ??
            "",
          evaluation_logic: payloadReport, // The conditionally compressed report
          risk_score: riskScore,
          risk_level: riskLevel,
          risk_reason: riskReason,
          proctoring_summary: report.proctoringSummary || {},
          evaluation_weights_snapshot: {},
          evaluation_version: report.metadata?.evaluationVersion ?? "11.0",
          evaluation_model:
            report.metadata?.modelUsed ?? "gemini-2.5-flash-lite",
          evaluation_prompt_version: "11.0",
          evaluated_at: new Date().toISOString(),
          candidate_outcome: "PENDING",

          // New columns
          trust_score: report.executiveSummary?.trustScore ?? null,
          topic_coverage: report.executiveSummary?.topicCoverage ?? null,
          knowledge_stability:
            report.executiveSummary?.knowledgeStability ?? null,
          reasoning_score: report.overallScores?.reasoningScore ?? null,
          consistency_score: report.overallScores?.consistencyScore ?? null,
          difficulty_weighted_performance:
            report.overallScores?.difficultyWeightedPerformance ?? null,
          report_confidence: report.executiveSummary?.reportConfidence ?? null,
          recommendation_status:
            report.executiveSummary?.recommendationStatus ?? null,
          score_calculation_version:
            report.metadata?.scoreCalculationVersion ?? null,
        },
        { onConflict: "session_id" },
      );

      if (error) {
        console.error(
          "Supabase Evaluation Report Error Details:",
          error.message,
          error.details,
          error.hint,
        );
        ErrorLogService.logError(
          "database",
          `Save evaluation report failed: ${error.message}`,
          error,
          sessionId,
          candidateName,
        );
        throw error;
      }

      // ✅ OPTIMIZATION: Run session update + contradictions + validations in parallel
      const parallelOps: Promise<any>[] = [];

      // Op 1: Sync total_score + overall_score + status to interview_sessions
      parallelOps.push(
        Promise.resolve(
          supabase
            .from("interview_sessions")
            .update({
              total_score: canonicalScore,
              overall_score: canonicalScore,
              status: 'COMPLETED'
            })
            .eq("id", sessionId)
        ).then(({ error }) => {
            if (error) console.error("Error updating interview_sessions score:", error.message);
          })
      );

      // Op 2: Save contradictions
      if (report.contradictions && report.contradictions.length > 0) {
        const contradictionPayloads = report.contradictions.map((c: any) => ({
          session_id: sessionId,
          candidate_name: candidateName || null,
          q_index1: Number(c.qIndex1),
          q_index2: Number(c.qIndex2),
          explanation: c.explanation,
          severity: c.severity || "medium",
          status: c.status || "possible",
          confidence: Number(c.confidence ?? 80),
        }));
        parallelOps.push(
          Promise.resolve(
            supabase.from("contradictions").delete().eq("session_id", sessionId)
          )
            .then(() => supabase.from("contradictions").insert(contradictionPayloads))
            .then(({ error: contrErr }) => {
              if (contrErr) console.error("Error saving contradictions:", contrErr.message);
            }).catch(e => console.error("Contradictions save exception:", e))
        );
      }

      // Op 3: Save validation results
      if (report.validationResults && report.validationResults.length > 0) {
        const validationPayloads = report.validationResults.map((vr: any) => ({
          session_id: sessionId,
          candidate_name: candidateName || null,
          parent_question: vr.parentQuestion,
          parent_score: Number(vr.parentScore),
          followup_question: vr.followupQuestion,
          followup_score: Number(vr.followupScore),
          reliability: Number(vr.reliability),
        }));
        parallelOps.push(
          Promise.resolve(
            supabase.from("validation_results").delete().eq("session_id", sessionId)
          )
            .then(() => supabase.from("validation_results").insert(validationPayloads))
            .then(({ error: valErr }) => {
              if (valErr) console.error("Error saving validation results:", valErr.message);
            }).catch(e => console.error("Validation results save exception:", e))
        );
      }
      try {
        await markReportGenerated(sessionId);
      } catch (e) {
        console.warn("[Cleanup] markReportGenerated failed silently:", e);
      }
    });
  }

  static async getEvaluationReport(sessionId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from("evaluation_reports")
        .select("evaluation_logic")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (error || !data) return null;
      return data.evaluation_logic || null;
    } catch (err) {
      console.warn(`[SupabaseService] getEvaluationReport failed for session ${sessionId}:`, err);
      return null;
    }
  }

  // ==========================================
  // STORAGE UPLOADS
  // ==========================================
  static async uploadFile(
    bucket: string,
    path: string,
    file: Blob,
    mimeType: string,
  ) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      ErrorLogService.logError(
        "database",
        `Upload file to bucket "${bucket}" failed: ${error.message}`,
        error,
      );
      throw error;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  }

  // ==========================================
  // SYSTEM SETTINGS & METRICS
  // ==========================================
  static async getSystemSettings(key: string): Promise<any | null> {
    try {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.value || null;
    } catch (e) {
      console.error(`Failed to get system settings for key ${key}:`, e);
      return null;
    }
  }

  static async saveSystemSettings(
    key: string,
    value: any,
    updatedBy: string = "Super Admin",
  ): Promise<boolean> {
    try {
      if (!supabase) return false;
      const { error } = await supabase.from("system_settings").upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        },
        { onConflict: "key" },
      );
      if (error) throw error;
      return true;
    } catch (e) {
      console.error(`Failed to save system settings for key ${key}:`, e);
      return false;
    }
  }

  static async getSystemSettingsMetadata(
    key: string,
  ): Promise<{ updated_at: string; updated_by: string } | null> {
    try {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from("system_settings")
        .select("updated_at, updated_by")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  static async incrementSystemUsageStats(
    promptTokens: number,
    completionTokens: number,
  ): Promise<boolean> {
    try {
      if (!supabase) return false;
      const { error } = await supabase.rpc("increment_usage_stats", {
        p_prompt_tokens: promptTokens,
        p_completion_tokens: completionTokens,
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Failed to increment system usage stats:", e);
      return false;
    }
  }

  static async getSystemUsageStats(): Promise<{
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_calls: number;
  } | null> {
    try {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from("system_usage_stats")
        .select("*")
        .eq("key", "openrouter_usage")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          total_calls: 0,
        };
      }
      return {
        prompt_tokens: Number(data.prompt_tokens || 0),
        completion_tokens: Number(data.completion_tokens || 0),
        total_tokens: Number(data.total_tokens || 0),
        total_calls: Number(data.total_calls || 0),
      };
    } catch (e) {
      console.error("Failed to get system usage stats:", e);
      return null;
    }
  }

  static async softDeleteSession(sessionId: string): Promise<boolean> {
    try {
      if (!supabase) return false;
      const { error } = await supabase
        .from("interview_sessions")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error(`Failed to soft delete session ${sessionId}:`, e);
      SupabaseService.invalidateSessionsCache();
      return false;
    }
  }

  static async restoreSession(sessionId: string): Promise<boolean> {
    try {
      if (!supabase) return false;
      const { error } = await supabase
        .from("interview_sessions")
        .update({
          is_deleted: false,
          deleted_at: null,
        })
        .eq("id", sessionId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error(`Failed to restore session ${sessionId}:`, e);
      SupabaseService.invalidateSessionsCache();
      return false;
    }
  }

  static async hardDeleteSession(sessionId: string): Promise<boolean> {
    try {
      if (!supabase) return false;
      const { error } = await supabase
        .from("interview_sessions")
        .delete()
        .eq("id", sessionId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error(`Failed to hard delete session ${sessionId}:`, e);
      SupabaseService.invalidateSessionsCache();
      return false;
    }
  }

  static async initializeSystemSettings(): Promise<boolean> {
    try {
      if (!supabase) return false;
      
      const settings = await SupabaseService.getSystemSettings("proctoring_settings");
      if (!settings) {
        console.log("Seeding default proctoring settings in system_settings table...");
        await SupabaseService.saveSystemSettings(
          "proctoring_settings",
          DEFAULT_PROCTORING_SETTINGS,
          "System Initializer",
        );
      }

      const mode = await SupabaseService.getSystemSettings("evaluation_mode");
      if (!mode) {
        console.log("Seeding default evaluation mode in system_settings table...");
        await SupabaseService.saveSystemSettings(
          "evaluation_mode",
          "API",
          "System Initializer"
        );
      }
      return true;
    } catch (e) {
      console.error("Failed to initialize system settings:", e);
      return false;
    }
  }

  static async getSession(sessionId: string) {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async getSessionResponses(sessionId: string) {
    const { data, error } = await supabase
      .from('session_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async getProctoringReport(sessionId: string) {
    const { data, error } = await supabase
      .from('proctoring_reports')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async updateSessionMetadata(sessionId: string, patch: any) {
    const { data: current } = await supabase
      .from('interview_sessions')
      .select('interview_metadata')
      .eq('id', sessionId)
      .maybeSingle();
        
    const currentMeta = current?.interview_metadata || {};
    const updatedMeta = {
      ...currentMeta,
      ...patch,
      runtime: {
        ...(currentMeta.runtime || {}),
        ...(patch.runtime || {})
      }
    };

    const { error } = await supabase
      .from('interview_sessions')
      .update({ interview_metadata: updatedMeta })
      .eq('id', sessionId);
        
    if (error) {
      console.error("[supabaseService] updateSessionMetadata error:", error);
      throw error;
    }
  }

  static async updateSession(sessionId: string, payload: any) {
    try {
      const { error } = await supabase
        .from("interview_sessions")
        .update(payload)
        .eq("id", sessionId);

      if (error) {
        console.error("[supabaseService] updateSession error:", error);
        throw error;
      }
    } catch (error) {
      console.error("[supabaseService] Exception in updateSession:", error);
      throw error;
    }
  }

  static async generatePairingToken(sessionId: string): Promise<string> {
    if (!supabase) throw new Error('Supabase not initialized');

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    const randomValues = new Uint8Array(8);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      token += chars[randomValues[i] % chars.length];
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase.from('proctoring_pairing_tokens').insert({
      session_id: sessionId,
      token,
      expires_at: expiresAt,
    });

    if (error) {
      if (error.code === '23505') {
        return SupabaseService.generatePairingToken(sessionId);
      }
      throw error;
    }

    console.log(`[PairingToken] Generated token ${token} for session ${sessionId}, expires ${expiresAt}`);
    return token;
  }

  static async getSessionFromToken(token: string): Promise<{
    sessionId: string;
    candidateName: string;
  } | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('proctoring_pairing_tokens')
      .select('session_id, consumed_at, expires_at')
      .eq('token', token.toUpperCase().trim())
      .maybeSingle();

    if (error || !data) return null;

    if (data.consumed_at) {
      console.warn(`[PairingToken] Token ${token} already consumed`);
      return null;
    }

    if (new Date(data.expires_at) < new Date()) {
      console.warn(`[PairingToken] Token ${token} expired`);
      return null;
    }

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, candidates!inner(name)')
      .eq('id', data.session_id)
      .maybeSingle();

    if (sessionError || !session) return null;

    return {
      sessionId: session.id,
      candidateName: (session as any).candidates?.name ?? 'Candidate',
    };
  }

  static async consumePairingToken(token: string, connectionId: string): Promise<boolean> {
    if (!supabase) return false;

    const { data, error } = await supabase
      .from('proctoring_pairing_tokens')
      .update({
        consumed_at: new Date().toISOString(),
        connection_id: connectionId,
      })
      .eq('token', token.toUpperCase().trim())
      .is('consumed_at', null)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      console.warn(`[PairingToken] Failed to consume token ${token}:`, error);
      return false;
    }

    console.log(`[PairingToken] Token ${token} consumed by connection ${connectionId}`);
    return true;
  }

  // ==========================================
  // STUDENT PORTAL
  // ==========================================
  static async getCandidateByClerkId(clerkUserId: string) {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  static async getStudentSessions(candidateId: string) {
    const { data: masterRecords, error } = await supabase
      .from("vw_candidate_master")
      .select("*")
      .eq("candidate_id", candidateId)
      .neq("session_status", "CREATED")
      .order("interview_date", { ascending: false });

    if (error) {
      console.error("Supabase getStudentSessions error:", error);
      throw error;
    }

    if (!masterRecords || masterRecords.length === 0) return [];

    const sessionIds = masterRecords.map((r) => r.session_id);

    try {
      const [responsesResult, reportsResult, violationsResult] =
        await Promise.all([
          supabase
            .from("session_responses")
            .select("session_id, question_text, candidate_answer, content_score, grammar_score, fluency_score, verdict, feedback")
            .in("session_id", sessionIds),
          supabase
            .from("evaluation_reports")
            .select("session_id, evaluation_logic, final_verdict, verdict_justification")
            .in("session_id", sessionIds),
          supabase
            .from("proctoring_events")
            .select("*")
            .in("session_id", sessionIds),
        ]);

      // Log errors instead of silently dropping all enrichment data.
      if (responsesResult.error) {
        console.error("[getStudentSessions] session_responses query failed:", responsesResult.error.message);
      }
      if (reportsResult.error) {
        console.error("[getStudentSessions] evaluation_reports query failed:", reportsResult.error.message);
      }
      if (violationsResult.error) {
        console.error("[getStudentSessions] proctoring_events query failed:", violationsResult.error.message);
      }

      const responses = responsesResult.data || [];
      const reports = reportsResult.data || [];
      const violations = violationsResult.data || [];

      const responseMap = new Map<string, any[]>();
      responses.forEach((response) => {
        const existing = responseMap.get(response.session_id) || [];
        existing.push(response);
        responseMap.set(response.session_id, existing);
      });

      const reportMap = new Map<string, any>();
      reports?.forEach((report) => reportMap.set(report.session_id, report));

      const violationMap = new Map<string, any[]>();
      violations?.forEach((violation) => {
        const existing = violationMap.get(violation.session_id) || [];
        existing.push(violation);
        violationMap.set(violation.session_id, existing);
      });

      return masterRecords.map((record) => {
        const sessionId = record.session_id;
        const sessionResponses = responseMap.get(sessionId) || [];
        const sessionReport = reportMap.get(sessionId) || null;
        const sessionViolations = violationMap.get(sessionId) || [];

        return {
          session_id: record.session_id,
          id: record.session_id,
          candidate_name: record.candidate_name,
          candidate_email: record.candidate_email,
          job_title: record.role,
          role: record.role,
          session_status: record.session_status,
          // Provide both property names: `session_date` (used by admin/HR) and
          // `interview_date` (used by CandidateDashboard.tsx:417).  Before this fix
          // the enriched path only set `session_date`, so the candidate overview tab
          // rendered "Invalid Date" for every interview.
          session_date: record.interview_date,
          interview_date: record.interview_date,
          // Likewise, the candidate dashboard reads `s.overall_score` (line 129) but
          // the enriched object only had `total_score`. The average-score stat card
          // showed 0% because `overall_score` was undefined for every session.
          total_score: record.overall_score,
          overall_score: record.overall_score,
          duration_minutes: record.duration_minutes,
          questions_asked: record.questions_asked,
          questions_answered: record.questions_answered,
          strengths: record.strengths || [],
          weaknesses: record.weaknesses || [],
          risk_score: record.risk_score,
          risk_level: record.risk_level,
          recommendation: record.recommendation,
          candidate_outcome: record.candidate_outcome,
          all_questions_and_answers: sessionResponses.map((r) => ({
            question_text: r.question_text,
            candidate_answer: r.candidate_answer,
            content_score: r.content_score,
            grammar_score: r.grammar_score,
            fluency_score: r.fluency_score,
            verdict: r.verdict,
            feedback: ensureFeedbackStructure(r.feedback),
          })),
          all_proctoring_events: sessionViolations.map((v) => ({
            type: v.event_type || v.type,
            severity: v.severity,
            message: v.detail || v.message,
            time: v.occurred_at || v.timestamp,
            snapshot_url: v.snapshot_url,
            clip_url: v.clip_url,
          })),
          evaluation_logic: sessionReport?.evaluation_logic ?? null,
          execution_status: record.execution_status ?? null,
          final_verdict: sessionReport?.final_verdict ?? null,
          verdict_justification: sessionReport?.verdict_justification ?? null,
          evaluation_mode: record.evaluation_mode ?? null,
          is_deleted: record.is_deleted,
        };
      });
    } catch (e) {
      console.warn("Failed to enrich student sessions:", e);
      return masterRecords;
    }
  }

  static async getUpcomingSessions(candidateId: string) {
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("*, job_posts!inner(title, company)")
      .eq("candidate_id", candidateId)
      .in("status", ["CREATED"])
      .is("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase getUpcomingSessions error:", error);
      throw error;
    }

    return data || [];
  }
  
  static async createAssignment(params: {
    jobPostId?: string;
    driveId?: string;
    candidateEmail: string;
    collegeId?: string;
    deadline?: string | null;
    maxAttempts?: number;
    assignedBy: string;
    notes?: string;
    companyName?: string;
  }): Promise<any> {
    return PerformanceLogger.measure('createAssignment', async () => {
      const email = params.candidateEmail.toLowerCase().trim();
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      let candidateId = existing?.id;

      if (!candidateId) {
        const { data: newCandidate, error: createErr } = await supabase
          .from('candidates')
          .insert({
            name: email.split('@')[0],
            email: email,
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        candidateId = newCandidate.id;
      }

      const targetDriveId = params.driveId || params.jobPostId;
      if (!targetDriveId) {
        throw new Error("Target driveId or jobPostId required to create assignment");
      }

      // -- DUPLICATE CHECK --
      // Prevent duplicate assignments for the same candidate + drive.
      const existingAssignment = await SupabaseService.findAssignmentByCandidateAndDrive(candidateId, targetDriveId);
      if (existingAssignment) {
        throw new Error(
          `This candidate is already assigned to this drive (status: ${existingAssignment.status}).`
        );
      }

      const { data, error } = await supabase
        .from('candidate_assignments')
        .insert({
          drive_id: targetDriveId,
          candidate_id: candidateId,
          college_email: email,
          college_id: params.collegeId || null,
          assigned_by: params.assignedBy,
          deadline: params.deadline || null,
          max_attempts: params.maxAttempts ?? 1,
          notes: params.notes || null,
          company_name: params.companyName || null,
          status: 'INVITED',
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    });
  }

  /**
   * Check whether a candidate already has an assignment for a given drive.
   * Returns the existing assignment (any status) or null if none exists.
   * Used by createAssignment() and assignCandidatesToDrive() to surface
   * duplicate-friendly errors instead of relying on the UNIQUE constraint alone.
   */
  static async findAssignmentByCandidateAndDrive(candidateId: string, driveId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('candidate_assignments')
      .select('id, status')
      .eq('candidate_id', candidateId)
      .eq('drive_id', driveId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async getAssignmentById(id: string): Promise<InterviewAssignment | null> {
    return PerformanceLogger.measure('getAssignmentById', async () => {
      const { data, error } = await supabase
        .from('candidate_assignments')
        .select('*, interview_drives(title)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        drive_id: data.drive_id,
        candidate_email: data.college_email || '',
        candidate_id: data.candidate_id,
        assigned_by: data.assigned_by || '',
        status: data.status,
        deadline: data.deadline,
        max_attempts: data.max_attempts,
        attempts_used: data.attempts_used,
        session_id: data.session_id,
        notes: data.notes,
        assigned_at: data.assigned_at,
        updated_at: data.updated_at,
        job_title: data.interview_drives?.title,
      } as InterviewAssignment;
    });
  }

  static async getAssignmentsByEmail(email: string): Promise<InterviewAssignment[]> {
    return PerformanceLogger.measure('getAssignmentsByEmail', async () => {
      const { data, error } = await supabase
        .from('candidate_assignments')
        .select('*, interview_drives(title)')
        .eq('college_email', email.toLowerCase().trim())
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        drive_id: a.drive_id,
        candidate_email: a.college_email || '',
        candidate_id: a.candidate_id,
        assigned_by: a.assigned_by || '',
        status: a.status,
        deadline: a.deadline,
        max_attempts: a.max_attempts,
        attempts_used: a.attempts_used,
        session_id: a.session_id,
        notes: a.notes,
        company_name: a.company_name,
        assigned_at: a.assigned_at,
        updated_at: a.updated_at,
        job_title: a.interview_drives?.title,
        candidate_name: a.candidate_name,
      })) as InterviewAssignment[];
    });
  }

  static async getAllAssignments(): Promise<InterviewAssignment[]> {
    return PerformanceLogger.measure('getAllAssignments', async () => {
      const { data, error } = await supabase
        .from('candidate_assignments')
        .select('*, interview_drives(title)')
        .order('assigned_at', { ascending: false });

      if (error) {
        // Fallback: try vw_assignment_tracking if candidate_assignments fails
        const { data: fallback, error: fallbackErr } = await supabase
          .from('vw_assignment_tracking')
          .select('*')
          .order('created_at', { ascending: false });
        if (fallbackErr) throw fallbackErr;
        return (fallback || []).map((a: any) => ({
          id: a.id,
          drive_id: a.drive_id,
          candidate_email: a.college_email || '',
          candidate_id: a.candidate_id,
          assigned_by: a.assigned_by || '',
          status: a.status,
          deadline: a.deadline,
          max_attempts: a.max_attempts,
          attempts_used: a.attempts_used,
          session_id: a.session_id,
          notes: a.notes,
          company_name: a.company_name,
          assigned_at: a.assigned_at,
          updated_at: a.updated_at,
          job_title: a.interview_drives?.title,
          candidate_name: a.candidate_name,
        })) as InterviewAssignment[];
      }
      
      return (data || []).map((a: any) => ({
        id: a.id,
        drive_id: a.drive_id,
        candidate_email: a.college_email || '',
        candidate_id: a.candidate_id,
        assigned_by: a.assigned_by || '',
        status: a.status,
        deadline: a.deadline,
        max_attempts: a.max_attempts,
        attempts_used: a.attempts_used,
        session_id: a.session_id,
        notes: a.notes,
        assigned_at: a.assigned_at,
        updated_at: a.updated_at,
        job_title: a.interview_drives?.title,
      })) as InterviewAssignment[];
    });
  }

  static async deleteAssignment(assignmentId: string): Promise<void> {
    const { error } = await supabase
      .from('candidate_assignments')
      .delete()
      .eq('id', assignmentId);
    if (error) throw error;
  }
  // ==========================================
  // JOIN FLOW & DRIVE ACCESS
  // ==========================================
  static async verifyAccessKey(accessKey: string) {
  return PerformanceLogger.measure('verifyAccessKey', async () => {
    const normalizedKey = accessKey.toUpperCase().trim();

    // Step 1: Look up the key itself
    const { data: keyRecord, error: keyError } = await supabase
      .from('drive_access_keys')
      .select('*')
      .eq('access_key', normalizedKey)
      .eq('is_active', true)
      .maybeSingle();

    if (keyError) throw keyError;
    if (!keyRecord) {
      console.warn('[JoinFlow] Access key not found or inactive:', normalizedKey);
      return null;
    }

    // Step 2: Check usage limit (max_uses = 0 means unlimited)
    if (keyRecord.max_uses > 0 && keyRecord.current_uses >= keyRecord.max_uses) {
      console.warn('[JoinFlow] Access key usage limit reached:', normalizedKey);
      return null;
    }

    // Step 3: Fetch drive + linked job_post in one query
    const { data: drive, error: driveError } = await supabase
      .from('interview_drives')
      .select(`
        id,
        title,
        description,
        status,
        evaluation_profile,
        evaluation_mode,
        role,
        proctoring_settings,
        job_post_id,
        job_posts (
          id,
          title,
          questions,
          settings,
          difficulty,
          question_count
        )
      `)
      .eq('id', keyRecord.drive_id)
      .maybeSingle();

    if (driveError) throw driveError;
    if (!drive) return null;

    // State Access Matrix Verification:
    // ACTIVE -> Always valid
    // SCHEDULED -> Allowed conditionally if within time window
    // DRAFT, COMPLETED, ARCHIVED, CANCELLED -> Forbidden
    if (drive.status === 'SCHEDULED') {
      const now = new Date();
      const scheduledAt = (drive as any).scheduled_at ? new Date((drive as any).scheduled_at) : null;
      const scheduledEnd = (drive as any).scheduled_end ? new Date((drive as any).scheduled_end) : null;
      
      if (scheduledAt && now < scheduledAt) {
        console.warn('[JoinFlow] Scheduled drive has not started yet:', (drive as any).scheduled_at);
        return null;
      }
      if (scheduledEnd && now > scheduledEnd) {
        console.warn('[JoinFlow] Scheduled drive window has expired:', (drive as any).scheduled_end);
        return null;
      }
    } else if (drive.status !== 'ACTIVE') {
      console.warn('[JoinFlow] Access key rejected — drive is in non-active status:', drive.status);
      return null;
    }

    // Use drive.role directly (set when HR created the drive).
    // Fall back to job_post settings.role for old drives created before this column existed.
    const jobPost = (drive as any).job_posts;
    const role = (drive as any).role || jobPost?.settings?.role || 'CSE';
    const evaluationMode = (drive as any).evaluation_mode || 'LOCAL';

    console.log('[JoinFlow] Drive verified:', drive.title, '| Role:', role, '| Mode:', evaluationMode);
    console.log('[verifyAccessKey] returning:', { role, evaluationMode, title: drive.title });
    return {
      ...drive,
      role,
      evaluation_mode: evaluationMode,
      job_post_id: drive.job_post_id,
      access_key: normalizedKey,
      access_key_id: keyRecord.id,
    };
  });
}
  static async incrementAccessKeyUsage(accessKeyId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_access_key_usage', {
      p_key_id: accessKeyId,
    });

    if (error && error.code === 'PGRST202') {
      console.warn('[SupabaseService] RPC increment_access_key_usage not found. Falling back to manual update.');
      const { data: current } = await supabase
        .from('drive_access_keys')
        .select('current_uses')
        .eq('id', accessKeyId)
        .single();

      if (!current) return;

      await supabase
        .from('drive_access_keys')
        .update({ current_uses: current.current_uses + 1 })
        .eq('id', accessKeyId);
    } else if (error) {
      throw error;
    }
  }

  static async getDriveInformation(driveId: string) {
    return PerformanceLogger.measure('getDriveInformation', async () => {
      const { data, error } = await supabase
        .from('interview_drives')
        .select('id, title, description, status, evaluation_profile, proctoring_settings')
        .eq('id', driveId)
        .maybeSingle();

      if (error) throw error;
      return data;
    });
  }

  /**
   * PHASE 15: assignments visible to one candidate, for their dashboard.
   *
   * Reads `candidate_assignments` — the canonical table. The competing `interview_assignments`
   * table that some read paths still reference does not exist in production, which is tracked
   * separately; this method deliberately does not touch it.
   *
   * Ordered soonest-deadline-first so the candidate sees what is most urgent, with
   * null deadlines last.
   */
  static async getAssignmentsForCandidate(candidateId: string) {
    if (!candidateId) return [];
    return PerformanceLogger.measure('getAssignmentsForCandidate', async () => {
      const { data, error } = await supabase
        .from('candidate_assignments').select('id, drive_id, status, deadline, max_attempts, attempts_used, company_name, assigned_at, session_id, interview_drives(title, status)')
        .select('id, drive_id, status, deadline, max_attempts, attempts_used, company_name, assigned_at, session_id, interview_drives(title, status)')
        .eq('candidate_id', candidateId)
        .order('deadline', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('[SupabaseService] getAssignmentsForCandidate failed:', error.message);
        // Return empty rather than throwing: a dashboard panel must not take down the page.
        return [];
      }
      return data || [];
    });
  }

  static async getAccessKeyForDrive(driveId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('drive_access_keys')
      .select('access_key')
      .eq('drive_id', driveId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (data?.access_key) return data.access_key;

    // Fallback: Auto-generate an access key if missing for this drive
    const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const randomSuffix = Array.from({ length: 6 }, () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]).join("");
    const newKey = `DRV-${randomSuffix}`;

    const { data: inserted, error: insertErr } = await supabase
      .from('drive_access_keys')
      .insert({
        drive_id: driveId,
        access_key: newKey,
        max_uses: 0,
        current_uses: 0,
        is_active: true
      })
      .select('access_key')
      .maybeSingle();

    if (insertErr) {
      console.error('[SupabaseService] Failed to auto-generate access key:', insertErr);
      return null;
    }
    return inserted?.access_key || newKey;
  }

  static async getCandidateAssignment(email: string, driveId: string) {
    return PerformanceLogger.measure('getCandidateAssignment', async () => {
      const { data, error } = await supabase
        .from('candidate_assignments')
        .select('*')
        .eq('college_email', email.toLowerCase().trim())
        .eq('drive_id', driveId)
        .in('status', ['INVITED', 'VERIFIED', 'IN_PROGRESS'])
        .maybeSingle();

      if (error) throw error;
      return data;
    });
  }

  static async validateAssignment(email: string, driveId: string, candidateId?: string, collegeId?: string): Promise<{
    valid: boolean;
    assignment?: any;
    reason?: string;
  }> {
    return PerformanceLogger.measure('validateAssignment', async () => {
      const normalizedEmail = email.toLowerCase().trim();
      const { data, error } = await supabase
        .from('candidate_assignments')
        .select('*')
        .eq('college_email', normalizedEmail)
        .eq('drive_id', driveId)
        .in('status', ['INVITED', 'VERIFIED', 'IN_PROGRESS'])
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Auto-create assignment record if candidate joins via active drive access key
        const { data: newAssignment, error: createErr } = await supabase
          .from('candidate_assignments')
          .insert({
            drive_id: driveId,
            candidate_id: candidateId || null,
            college_id: collegeId || null,
            college_email: normalizedEmail,
            status: 'INVITED',
          })
          .select()
          .single();

        if (createErr) {
          console.error('[SupabaseService] Failed to auto-create candidate assignment:', createErr);
          return { valid: false, reason: 'No active assignment found for this drive. Please contact HR.' };
        }
        return { valid: true, assignment: newAssignment };
      }

      if (data.deadline && new Date(data.deadline) < new Date()) {
        await supabase.from('candidate_assignments').update({ status: 'ABSENT' }).eq('id', data.id);
        return { valid: false, reason: 'Interview deadline has passed' };
      }

      if (data.attempts_used >= data.max_attempts) {
        await supabase.from('candidate_assignments').update({ status: 'ABSENT' }).eq('id', data.id);
        return { valid: false, reason: 'Maximum attempts reached' };
      }

      return { valid: true, assignment: data };
    });
  }

  static async incrementAttempt(assignmentId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_assignment_attempt', {
      p_assignment_id: assignmentId,
      p_new_status: 'IN_PROGRESS',
    });

    if (error && error.code === 'PGRST202') {
      console.warn('[SupabaseService] RPC increment_assignment_attempt not found. Falling back to manual update.');
      const { data: current, error: fetchErr } = await supabase
        .from('candidate_assignments')
        .select('attempts_used')
        .eq('id', assignmentId)
        .single();

      if (fetchErr || !current) return;

      await supabase
        .from('candidate_assignments')
        .update({ attempts_used: current.attempts_used + 1, status: 'IN_PROGRESS' })
        .eq('id', assignmentId);
    } else if (error) {
      throw error;
    }
  }

  static async linkSessionToAssignment(assignmentId: string, sessionId: string): Promise<void> {
    await supabase.from('candidate_assignments').update({ session_id: sessionId }).eq('id', assignmentId);
  }

  static async completeAssignment(assignmentId: string): Promise<void> {
    await supabase
      .from('candidate_assignments')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', assignmentId);
  }

  static async updateAssignmentStatus(assignmentId: string, status: string): Promise<void> {
    await supabase.from('candidate_assignments').update({ status }).eq('id', assignmentId);
  }

  static async markIdentityVerified(assignmentId: string, idProofUrl?: string, idProofType?: string): Promise<void> {
    await supabase
      .from('candidate_assignments')
      .update({
        status: 'VERIFIED',
        verified_at: new Date().toISOString(),
        ...(idProofUrl ? { id_proof_url: idProofUrl } : {}),
        ...(idProofType ? { id_proof_type: idProofType } : {}),
      })
      .eq('id', assignmentId);
  }

  // ==========================================
  // ID PROOF UPLOAD (Cloudinary, low-res)
  // ==========================================
  static async uploadIdProof(file: File, candidateEmail: string, driveId: string): Promise<string> {
  // Step 1: get signature from edge function
  const sigRes = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-id-proof-upload`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: candidateEmail, drive_id: driveId }),
    }
  );

  if (!sigRes.ok) {
    const err = await sigRes.json();
    throw new Error(err.error || "Failed to get upload signature");
  }

  const { cloud_name, api_key, timestamp, signature, folder, public_id } = await sigRes.json();

  // Step 2: upload directly to Cloudinary with the signature
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", api_key);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("public_id", public_id);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }

  const data = await uploadRes.json();
  return data.secure_url.replace("/upload/", "/upload/w_800,q_auto:low/");
}
}