-- Migration: 20260807000001_evaluation_queue_architecture.sql
-- Add lease recovery, turn progress tracking, and atomic completion RPC for evaluation_jobs

ALTER TABLE evaluation_jobs 
  ADD COLUMN IF NOT EXISTS leased_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_questions INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS processed_questions INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_lease ON evaluation_jobs (status, leased_until);

-- Create atomic RPC function for complete_evaluation_job
CREATE OR REPLACE FUNCTION complete_evaluation_job(
  p_session_id UUID,
  p_report JSONB,
  p_candidate_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Insert or update evaluation_reports
  INSERT INTO evaluation_reports (session_id, evaluation_logic, created_at)
  VALUES (p_session_id, p_report, NOW())
  ON CONFLICT (session_id)
  DO UPDATE SET evaluation_logic = p_report;

  -- 2. Update interview_sessions execution status
  UPDATE interview_sessions
  SET 
    execution_status = 'REPORT_SAVED',
    final_report_source = 'HYBRID_API',
    completed_at = NOW()
  WHERE id = p_session_id;

  -- 3. Update evaluation_jobs status
  UPDATE evaluation_jobs
  SET 
    status = 'COMPLETED',
    processed_questions = COALESCE(total_questions, 10),
    completed_at = NOW(),
    last_heartbeat_at = NOW()
  WHERE session_id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_evaluation_job(UUID, JSONB, TEXT) TO anon, authenticated, service_role;
