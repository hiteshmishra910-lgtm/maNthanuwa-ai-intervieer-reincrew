-- ============================================================================
-- Phase 2, 3, 5: Evaluation Pipeline Architecture Fixes
-- Migration: 20260802_evaluation_architecture_fixes.sql
--
-- PURPOSE:
--   - Phase 2: Add Immutable Interview Snapshot columns to interview_sessions
--   - Phase 3: Add Execution Tracking columns to interview_sessions
--   - Phase 5: Create evaluation_lifecycle_logs table for granular event logging
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: Alter interview_sessions for Snapshot and Execution Tracking
-- ----------------------------------------------------------------------------
ALTER TABLE public.interview_sessions
  -- Phase 2: Immutable Configuration Snapshot
  ADD COLUMN IF NOT EXISTS configured_evaluation_mode TEXT,
  ADD COLUMN IF NOT EXISTS configured_provider TEXT,
  ADD COLUMN IF NOT EXISTS configured_model TEXT,
  ADD COLUMN IF NOT EXISTS configured_prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS configured_scoring_version TEXT,
  ADD COLUMN IF NOT EXISTS evaluation_engine_version TEXT,
  
  -- Phase 3: Execution Tracking
  ADD COLUMN IF NOT EXISTS execution_attempt_mode TEXT,
  ADD COLUMN IF NOT EXISTS execution_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS fallback_mode TEXT,
  ADD COLUMN IF NOT EXISTS final_report_source TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add Constraints
DO $$ BEGIN
  -- Prevent invalid evaluation modes
  ALTER TABLE public.interview_sessions
    ADD CONSTRAINT valid_configured_evaluation_mode CHECK (configured_evaluation_mode IS NULL OR configured_evaluation_mode IN ('API', 'LOCAL', 'HYBRID'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Prevent invalid execution statuses
  ALTER TABLE public.interview_sessions
    ADD CONSTRAINT valid_execution_status CHECK (execution_status IN (
      'PENDING', 
      'LOCAL_RUNNING', 
      'API_RUNNING', 
      'HYBRID_RUNNING', 
      'API_FAILED', 
      'LOCAL_FAILED', 
      'REPORT_GENERATED', 
      'REPORT_SAVED', 
      'FAILED'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ----------------------------------------------------------------------------
-- STEP 2: Create evaluation_lifecycle_logs table (Phase 5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evaluation_lifecycle_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL,       -- e.g., 'SYSTEM', 'CANDIDATE', 'ADMIN'
    component TEXT NOT NULL,   -- e.g., 'DynamicInterviewScreen', 'EvaluationDispatcher'
    event_type TEXT NOT NULL,  -- e.g., 'SESSION_STARTED', 'API_TIMEOUT'
    details JSONB
);

-- Enable RLS
ALTER TABLE public.evaluation_lifecycle_logs ENABLE ROW LEVEL SECURITY;

-- Clean up any pre-existing policies for idempotency
DROP POLICY IF EXISTS "evaluation_lifecycle_logs_insert" ON public.evaluation_lifecycle_logs;
DROP POLICY IF EXISTS "evaluation_lifecycle_logs_select" ON public.evaluation_lifecycle_logs;

-- Policy: Allow inserts by authenticated users (candidate generating logs during interview)
CREATE POLICY "evaluation_lifecycle_logs_insert" ON public.evaluation_lifecycle_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Policy: Allow SELECT by admins or service_role
CREATE POLICY "evaluation_lifecycle_logs_select" ON public.evaluation_lifecycle_logs
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role');

-- Index for efficient querying by session
CREATE INDEX IF NOT EXISTS idx_eval_lifecycle_logs_session_id ON public.evaluation_lifecycle_logs(session_id);

-- Explicit GRANTs to complement RLS policies
GRANT SELECT, INSERT ON public.evaluation_lifecycle_logs TO authenticated, anon;
GRANT ALL ON public.evaluation_lifecycle_logs TO service_role;


-- ----------------------------------------------------------------------------
-- STEP 3: Update vw_candidate_master view with Security Invoker & expose columns
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS vw_candidate_master CASCADE;
CREATE OR REPLACE VIEW vw_candidate_master 
WITH (security_invoker = true) AS
SELECT
  c.id AS candidate_id,
  s.id AS session_id,
  c.name AS candidate_name,
  c.email AS candidate_email,
  j.title AS role,
  s.started_at AS interview_date,
  s.duration_seconds / 60 AS duration_minutes,
  s.total_questions AS questions_asked,
  (SELECT COUNT(*) FROM session_responses WHERE session_id = s.id) AS questions_answered,
  s.overall_score,
  e.risk_score,
  e.risk_level,
  e.hiring_recommendation AS recommendation,
  e.candidate_outcome,
  s.status AS session_status,
  s.is_deleted,
  s.deleted_at,
  e.strengths,
  e.failures AS weaknesses,
  COALESCE((s.interview_metadata -> 'practice' ->> 'is_practice')::boolean, false) AS is_practice,
  NULLIF(
    UPPER(
      TRIM(BOTH '"' FROM COALESCE(
        s.configured_evaluation_mode,
        s.interview_metadata ->> 'evaluationMode',
        s.interview_metadata -> 'job_settings_snapshot' ->> 'evaluationMode',
        ''
      ))
    ),
    ''
  ) AS evaluation_mode,
  s.configured_evaluation_mode,
  s.configured_provider,
  s.configured_model,
  s.execution_attempt_mode,
  s.execution_status,
  s.fallback_mode,
  s.final_report_source,
  s.failure_reason
FROM candidates c
JOIN interview_sessions s ON c.id = s.candidate_id
LEFT JOIN job_posts j ON s.job_post_id = j.id
LEFT JOIN evaluation_reports e ON s.id = e.session_id;

-- ----------------------------------------------------------------------------
-- STEP 4: Enforce security_invoker = true on all public views to resolve UNRESTRICTED warnings
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_candidate_qa_details') THEN
    ALTER VIEW public.vw_candidate_qa_details SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_drive_candidates') THEN
    ALTER VIEW public.vw_drive_candidates SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_drive_summary') THEN
    ALTER VIEW public.vw_drive_summary SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_drive_templates') THEN
    ALTER VIEW public.vw_drive_templates SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_question_banks') THEN
    ALTER VIEW public.vw_question_banks SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_assignment_tracking') THEN
    ALTER VIEW public.vw_assignment_tracking SET (security_invoker = true);
  END IF;
END $$;

COMMIT;
