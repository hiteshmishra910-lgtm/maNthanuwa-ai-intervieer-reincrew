import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clerk-token",
};

// ── Pilot per-mode batch limits (mirror of src/Evaluation/dispatch/pilotLimits.ts) ──
// These must stay in sync with the frontend config. Update both when changing.
const MODE_BATCH_LIMITS: Record<string, number> = {
  LOCAL: 10,  // LOCAL doesn't use queue, but kept for symmetry
  HYBRID: 5,
  API: 3,
};
const GLOBAL_MAX_BATCH = 10; // absolute ceiling per invocation

interface EvaluationJobQueueItem {
  id: string;
  session_id: string;
  status: string;
  attempts: number;
  created_at: string | null;
  last_attempt_at?: string | null;
  mode?: string; // evaluation mode from linked session
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

    // 1. Atomic stale PROCESSING job recovery (single SQL UPDATE query)
    const { data: recoveredStale, error: staleErr } = await supabaseAdmin
      .from("evaluation_jobs")
      .update({
        status: "FAILED_RETRYABLE",
        last_error: "Job processing timed out (stale worker recovery)",
        next_retry_at: now.toISOString()
      })
      .eq("status", "PROCESSING")
      .lt("started_at", fifteenMinsAgo)
      .select("id");

    if (staleErr) {
      console.warn(`[QueueWorker Warning] Stale job recovery query failed: ${staleErr.message}`);
    } else if (recoveredStale && recoveredStale.length > 0) {
      console.log(`[QueueWorker] Atomically recovered ${recoveredStale.length} stale PROCESSING jobs.`);
    }

    // 2. Fetch candidates for processing: QUEUED or FAILED_RETRYABLE with next_retry_at <= now
    const [queuedRes, retryRes] = await Promise.all([
      supabaseAdmin
        .from("evaluation_jobs")
        .select("id, session_id, status, attempts, created_at, last_attempt_at")
        .eq("status", "QUEUED")
        .lt("attempts", 3)
        .order("created_at", { ascending: true })
        .limit(10),
      supabaseAdmin
        .from("evaluation_jobs")
        .select("id, session_id, status, attempts, created_at, last_attempt_at")
        .eq("status", "FAILED_RETRYABLE")
        .lte("next_retry_at", now.toISOString())
        .lt("attempts", 3)
        .order("created_at", { ascending: true })
        .limit(10),
    ]);

    if (queuedRes.error) throw new Error(`Failed to query QUEUED evaluation_jobs: ${queuedRes.error.message}`);
    if (retryRes.error) throw new Error(`Failed to query FAILED_RETRYABLE evaluation_jobs: ${retryRes.error.message}`);

    // 3. Deduplicate by job ID, sort oldest first, and slice batch limit to 10
    const jobMap = new Map<string, EvaluationJobQueueItem>();
    const rawJobs: EvaluationJobQueueItem[] = [...(queuedRes.data || []), ...(retryRes.data || [])];
    rawJobs.forEach((job) => jobMap.set(job.id, job));

    const pendingJobs = Array.from(jobMap.values())
      .sort((a, b) => {
        const timeA = new Date(a.last_attempt_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_attempt_at || b.created_at || 0).getTime();
        return timeA - timeB;
      })
      .slice(0, GLOBAL_MAX_BATCH);

    if (pendingJobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs found", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── Fetch evaluation mode for each job from linked session ──
    const sessionIds = pendingJobs.map(j => j.session_id);
    const { data: sessions } = await supabaseAdmin
      .from("interview_sessions")
      .select("id, execution_attempt_mode")
      .in("id", sessionIds);

    const modeBySession = new Map<string, string>();
    (sessions || []).forEach((s: any) => {
      modeBySession.set(s.id, (s.execution_attempt_mode || "HYBRID").toUpperCase());
    });

    // Tag jobs with their mode
    pendingJobs.forEach(j => {
      j.mode = modeBySession.get(j.session_id) || "HYBRID";
    });

    // ── Apply per-mode batch limits ──
    const modeCount: Record<string, number> = {};
    const filteredJobs = pendingJobs.filter(j => {
      const mode = j.mode || "HYBRID";
      const limit = MODE_BATCH_LIMITS[mode] ?? MODE_BATCH_LIMITS["HYBRID"];
      modeCount[mode] = (modeCount[mode] || 0) + 1;
      return modeCount[mode] <= limit;
    });

    const droppedCount = pendingJobs.length - filteredJobs.length;
    if (droppedCount > 0) {
      console.log(`[QueueWorker] Dropped ${droppedCount} jobs due to per-mode batch limits: ${JSON.stringify(modeCount)}`);
    }

    console.log(`[QueueWorker] Found ${filteredJobs.length} pending jobs to process (after per-mode limits)`);
    let processedCount = 0;

    for (const job of filteredJobs) {
      const currentAttempts = (job.attempts || 0) + 1;

      // 4. ATOMIC CLAIMING: update status to PROCESSING only if status equals expected status
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from("evaluation_jobs")
        .update({
          status: "PROCESSING",
          started_at: now.toISOString(),
          attempts: currentAttempts,
          last_attempt_at: now.toISOString()
        })
        .eq("id", job.id)
        .eq("status", job.status)
        .select();

      if (claimErr || !claimed || claimed.length === 0) {
        console.log(`[QueueWorker] Job ${job.id} already claimed by another worker. Skipping.`);
        continue;
      }

      console.log(`[QueueWorker] Atomically claimed job ${job.id} (Session: ${job.session_id}, Attempt: ${currentAttempts})`);

      // 5. Trigger evaluation edge function for session with full authentication headers
      try {
        const evalResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-hybrid-job`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ sessionId: job.session_id, attemptNumber: currentAttempts })
        });

        if (evalResponse.ok) {
          console.log(`[QueueWorker] Job ${job.id} completed successfully.`);
          processedCount++;
        } else {
          const errText = await evalResponse.text();
          console.error(`[QueueWorker Error] evaluate-hybrid-job failed for ${job.session_id}: ${errText}`);
          
          // Guaranteed state transition out of PROCESSING on failure
          const nextStatus = currentAttempts >= 3 ? "FAILED_PERMANENT" : "FAILED_RETRYABLE";
          const retryTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          await supabaseAdmin
            .from("evaluation_jobs")
            .update({
              status: nextStatus,
              last_error: errText,
              next_retry_at: retryTime
            })
            .eq("id", job.id);
        }
      } catch (execErr: any) {
        console.error(`[QueueWorker Failure] Exception evaluating session ${job.session_id}: ${execErr.message}`);
        
        // Guaranteed state transition out of PROCESSING on exception
        const nextStatus = currentAttempts >= 3 ? "FAILED_PERMANENT" : "FAILED_RETRYABLE";
        const retryTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from("evaluation_jobs")
          .update({
            status: nextStatus,
            last_error: execErr.message,
            next_retry_at: retryTime
          })
          .eq("id", job.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processedCount}/${filteredJobs.length} evaluation jobs${droppedCount > 0 ? ` (${droppedCount} dropped by per-mode limits)` : ''}`,
        processed: processedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("[QueueWorker Error]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
