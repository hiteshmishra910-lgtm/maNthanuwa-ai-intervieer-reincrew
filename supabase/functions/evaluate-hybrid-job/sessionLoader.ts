import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeIntegrityScore } from "../_shared_generated/scoringPolicy.ts";

export async function loadSession(supabaseAdmin: any, sessionId: string) {
  console.log(`[Hybrid] Session loaded: ${sessionId}`);

  // Parallelize all 3 independent queries — each only needs sessionId
  const [sessionRes, responsesRes, proctoringRes] = await Promise.all([
    // 1. Fetch Session
    supabaseAdmin
      .from('interview_sessions')
      .select('*, job_posts(*)')
      .eq('id', sessionId)
      .single(),

    // 2. Fetch Responses
    supabaseAdmin
      .from('session_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_index', { ascending: true }),

    // 3. Fetch Proctoring Report for Integrity Score
    supabaseAdmin
      .from('proctoring_reports')
      .select('violation_score, integrity_score')
      .eq('session_id', sessionId)
      .maybeSingle(),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    throw new Error(`Failed to load session ${sessionId}: ${sessionRes.error?.message}`);
  }
  if (responsesRes.error) {
    throw new Error(`Failed to load responses for session ${sessionId}: ${responsesRes.error.message}`);
  }
  // Log proctoring query errors but don't block — proctoring is optional, default to 0
  if (proctoringRes.error) {
    console.warn(`[Hybrid] Proctoring query failed for session ${sessionId}: ${proctoringRes.error.message}`);
  }

  const violationScore = proctoringRes.data?.violation_score ?? 0;
  const integrityScore = typeof proctoringRes.data?.integrity_score === 'number'
    ? proctoringRes.data.integrity_score
    : computeIntegrityScore(violationScore);

  return { session: sessionRes.data, responses: responsesRes.data, integrityScore };
}
