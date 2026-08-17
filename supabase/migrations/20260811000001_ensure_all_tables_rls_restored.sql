-- ============================================================================
-- REICREW AI — COMPREHENSIVE RLS RESTORATION & DYNAMIC UNCONSTRAINED ACCESS
-- Migration: 20260811000001_ensure_all_tables_rls_restored.sql
--
-- PURPOSE:
--   1. Dynamically grant full schema privileges (SELECT, INSERT, UPDATE, DELETE)
--      on all public tables, sequences, and routines to anon, authenticated, and service_role.
--   2. Dynamically ensure an idempotent "allow_all" RLS policy on EVERY table in public schema.
--   3. Ensure complete_evaluation_job RPC updates the evaluation_logic column.
-- ============================================================================

SET lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- STEP 1: Schema-wide Grant Permissions
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;

-- ----------------------------------------------------------------------------
-- STEP 2: Dynamically Apply "allow_all" Policy to All Public Tables
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I;', tbl.tablename);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl.tablename || '_policy', tbl.tablename);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl.tablename || '_access_policy', tbl.tablename);
      EXECUTE format('CREATE POLICY "allow_all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', tbl.tablename);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
-- ----------------------------------------------------------------------------
-- STEP 2B: Set security_invoker = true on All Views (Fixes Security Advisor Errors)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true);', v.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: Ensure complete_evaluation_job RPC populates evaluation_logic column
-- ----------------------------------------------------------------------------
-- Idempotently backfill evaluation_logic from report_data if report_data column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'evaluation_reports' AND column_name = 'report_data'
  ) THEN
    EXECUTE 'UPDATE public.evaluation_reports SET evaluation_logic = report_data WHERE evaluation_logic IS NULL AND report_data IS NOT NULL;';
  END IF;
END $$;


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
  -- 1. Insert or update evaluation_reports (using evaluation_logic as the single JSONB report column)
  INSERT INTO evaluation_reports (session_id, evaluation_logic, created_at)
  VALUES (p_session_id, p_report, NOW())
  ON CONFLICT (session_id)
  DO UPDATE SET
    evaluation_logic = p_report;

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
