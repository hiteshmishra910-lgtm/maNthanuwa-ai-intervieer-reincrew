export async function saveEvaluationResults(
  supabaseAdmin: any,
  sessionId: string,
  report: any,
  metadata: any
) {
  // Calculate summary metrics
  const averageScore = report?.overallScores?.knowledgeScore ?? report?.executiveSummary?.technicalScore ?? 0;
  const recommendation = report?.executiveSummary?.recommendation ?? report?.hiringRecommendation ?? 'Consider';
  const summary = report?.executiveSummary?.summary ?? '';

  console.log(`[Hybrid DB] Step 1: Updating interview_sessions for session ${sessionId}`);
  console.log(`[Hybrid DB] Step 1a: averageScore=${averageScore}, recommendation="${recommendation}"`);

  // 1. Update interview_sessions — write to execution_status (the column EndScreen
  //    and the Realtime listener watch), NOT just the legacy `status` column.
  const { error: sessionError } = await supabaseAdmin
    .from('interview_sessions')
    .update({
      completed_at: new Date().toISOString(),
      status: 'COMPLETED',
      execution_status: 'REPORT_SAVED',
      final_report_source: 'HYBRID_API',
      overall_score: averageScore,
    })
    .eq('id', sessionId);

  if (sessionError) {
    console.error(`[Hybrid DB] Step 1 FAILED:`, sessionError.message);
    throw new Error(`Failed to save report to session: ${sessionError.message}`);
  }
  console.log(`[Hybrid DB] Step 1a: ✅ interview_sessions updated (execution_status=REPORT_SAVED, status=COMPLETED)`);

  // 2. Update candidate_assignments + drive counter (drive flow only)
  console.log(`[Hybrid DB] Step 2: Checking drive_id for assignment update...`);
  const { data: session } = await supabaseAdmin
    .from('interview_sessions')
    .select('drive_id, candidate_id')
    .eq('id', sessionId)
    .single();

  if (session?.drive_id) {
    await supabaseAdmin
      .from('candidate_assignments')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      })
      .eq('drive_id', session.drive_id)
      .eq('candidate_id', session.candidate_id);

    await supabaseAdmin.rpc('increment_completed_candidates', {
      drive_id_input: session.drive_id
    });
  }

  // 3. Upsert into evaluation_reports so getAllSessions() and Admin Dashboard can find it
  console.log(`[Hybrid DB] Step 3: Upserting evaluation_reports (evaluationStatus="${report?.evaluationStatus}")...`);
  const { error: reportError } = await supabaseAdmin
    .from('evaluation_reports')
    .upsert({
      session_id: sessionId,
      evaluation_logic: report,
      total_score: averageScore,
      final_verdict: summary,
      hiring_recommendation: recommendation,
      strengths: report?.strengths || [],
      failures: report?.weaknesses || [],
      verdict_justification: summary,
      evaluated_at: new Date().toISOString(),
      candidate_outcome: 'PENDING',
    }, { onConflict: 'session_id' });

  if (reportError) {
    console.warn(`[Hybrid DB] Step 3 FAILED (non-fatal):`, reportError.message);
  } else {
    console.log(`[Hybrid DB] Step 3a: ✅ evaluation_reports upserted`);
  }

  // 4. Backfill per-question scores into session_responses from the question breakdown
  const breakdown = report?.questionBreakdown || [];
  if (breakdown.length > 0) {
    for (let i = 0; i < breakdown.length; i++) {
      const q = breakdown[i];
      const { error: respError } = await supabaseAdmin
        .from('session_responses')
        .update({
          content_score: q.accuracy ?? null,
          verdict: (q.accuracy ?? 0) >= 7 ? 'Pass' : (q.accuracy ?? 0) >= 5 ? 'Borderline' : 'Fail',
        })
        .eq('session_id', sessionId)
        .eq('question_index', i);

      if (respError) {
        console.warn(`[Hybrid] Failed to backfill score for question ${i}: ${respError.message}`);
      }
    }
    console.log(`[Hybrid] Backfilled scores for ${breakdown.length} questions`);
  }

  // 5. Mark evaluation job as COMPLETED
  console.log(`[Hybrid] Marking job COMPLETED`);
  const { error: jobError } = await supabaseAdmin
    .from('evaluation_jobs')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);

  if (jobError) {
    throw new Error(`Failed to update job status to COMPLETED: ${jobError.message}`);
  }
}

export async function markJobFailed(
  supabaseAdmin: any,
  sessionId: string,
  errorMsg: string,
  isRetryable: boolean = true,
  currentAttempts: number = 1
) {
  const now = new Date();
  const nextAttemptNum = currentAttempts + 1;
  const isFinalAttempt = !isRetryable || nextAttemptNum > 3;

  const status = isFinalAttempt ? 'FAILED_PERMANENT' : 'FAILED_RETRYABLE';
  
  // Exponential backoff: Attempt 1 -> +1m, Attempt 2 -> +5m
  const backoffMs = nextAttemptNum === 2 ? 60 * 1000 : 5 * 60 * 1000;
  const nextRetryAt = isFinalAttempt ? null : new Date(now.getTime() + backoffMs).toISOString();

  console.log(`[Hybrid] Marking job ${status} (Attempt ${currentAttempts}) for session ${sessionId}`);

  const { error } = await supabaseAdmin
    .from('evaluation_jobs')
    .update({
      status,
      error: errorMsg,
      last_error: errorMsg,
      last_attempt_at: now.toISOString(),
      next_retry_at: nextRetryAt,
      completed_at: isFinalAttempt ? now.toISOString() : null,
    })
    .eq('session_id', sessionId);

  if (error) {
    console.error(`[Hybrid Error] Failed to update job status to ${status}: ${error.message}`);
    throw new Error(`Failed to update evaluation_jobs table: ${error.message}`);
  }
}