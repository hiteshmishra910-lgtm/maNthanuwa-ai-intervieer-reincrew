-- ============================================================================
-- REICREW AI — DEADLOCK-FREE ACCESS RESTORATION
-- Migration: 20260805_revert_and_restore_access.sql
--
-- PURPOSE:
--   1. Grant full schema privileges to anon, authenticated, and service_role.
--   2. Safely apply universal allow_all policies on key tables without deadlocks.
-- ============================================================================

-- Set short lock timeout to avoid waiting on active queries
SET lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- STEP 1: Grant full schema privileges to all roles
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;

-- ----------------------------------------------------------------------------
-- STEP 2: Safely apply allow_all policies on core tables
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "candidates_access_policy" ON public.candidates;
  DROP POLICY IF EXISTS "allow_all" ON public.candidates;
  CREATE POLICY "allow_all" ON public.candidates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "interview_sessions_access_policy" ON public.interview_sessions;
  DROP POLICY IF EXISTS "allow_all" ON public.interview_sessions;
  CREATE POLICY "allow_all" ON public.interview_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "system_settings_public_select" ON public.system_settings;
  DROP POLICY IF EXISTS "system_settings_admin_manage" ON public.system_settings;
  DROP POLICY IF EXISTS "allow_all" ON public.system_settings;
  CREATE POLICY "allow_all" ON public.system_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.session_responses ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "session_responses_access_policy" ON public.session_responses;
  DROP POLICY IF EXISTS "allow_all" ON public.session_responses;
  CREATE POLICY "allow_all" ON public.session_responses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.evaluation_reports ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "evaluation_reports_access_policy" ON public.evaluation_reports;
  DROP POLICY IF EXISTS "allow_all" ON public.evaluation_reports;
  CREATE POLICY "allow_all" ON public.evaluation_reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "proctoring_events_access_policy" ON public.proctoring_events;
  DROP POLICY IF EXISTS "allow_all" ON public.proctoring_events;
  CREATE POLICY "allow_all" ON public.proctoring_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "job_posts_public_select" ON public.job_posts;
  DROP POLICY IF EXISTS "job_posts_admin_manage" ON public.job_posts;
  DROP POLICY IF EXISTS "allow_all" ON public.job_posts;
  CREATE POLICY "allow_all" ON public.job_posts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
