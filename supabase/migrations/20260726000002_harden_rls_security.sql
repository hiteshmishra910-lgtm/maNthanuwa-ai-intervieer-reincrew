-- ============================================================================
-- SECURITY REMEDIATION: HARDEN SUPABASE RLS POLICIES & REVOKE BLANKET ANONYMOUS ACCESS
-- Migration: 20260726_harden_rls_security.sql
-- Fixes: CR-1 Critical Security Audit Vulnerability
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE BLANKET ANONYMOUS PRIVILEGES
-- ----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon;

-- ----------------------------------------------------------------------------
-- 2. RE-GRANT MINIMAL NECESSARY PERMISSIONS TO ANON & AUTHENTICATED
-- ----------------------------------------------------------------------------
-- Public read access for job definitions, drives, templates, and question banks required by interview flow
GRANT SELECT ON public.job_posts TO anon, authenticated;
GRANT SELECT ON public.interview_drives TO anon, authenticated;
GRANT SELECT ON public.drive_access_keys TO anon, authenticated;
GRANT SELECT ON public.interview_templates TO anon, authenticated;
GRANT SELECT ON public.question_banks TO anon, authenticated;
GRANT SELECT ON public.interview_questions TO anon, authenticated;
GRANT SELECT ON public.question_keywords TO anon, authenticated;
GRANT SELECT ON public.question_synonyms TO anon, authenticated;
-- Public read access for job definitions, drives, templates, evaluation profiles, and question banks required by interview flow
GRANT SELECT ON public.job_posts TO anon, authenticated;
GRANT SELECT ON public.interview_drives TO anon, authenticated;
GRANT SELECT ON public.drive_access_keys TO anon, authenticated;
GRANT SELECT ON public.interview_templates TO anon, authenticated;
GRANT SELECT ON public.question_banks TO anon, authenticated;
GRANT SELECT ON public.interview_questions TO anon, authenticated;
GRANT SELECT ON public.question_keywords TO anon, authenticated;
GRANT SELECT ON public.question_synonyms TO anon, authenticated;
GRANT SELECT ON public.evaluation_rubrics TO anon, authenticated;
GRANT SELECT ON public.followup_questions TO anon, authenticated;
GRANT SELECT ON public.evaluation_profiles TO anon, authenticated;
GRANT SELECT ON public.evaluation_profile_versions TO anon, authenticated;

-- Candidates & interview flow access (insert/select for guest/candidate onboarding and session submission)
GRANT SELECT, INSERT, UPDATE ON public.candidates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.interview_sessions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.session_responses TO anon, authenticated;
GRANT INSERT ON public.proctoring_events TO anon, authenticated;
GRANT SELECT, INSERT ON public.evaluation_jobs TO anon, authenticated; -- Anon can enqueue, but NOT update or delete

-- Grant authenticated (recruiter/admin) access to evaluation & management tables
GRANT ALL PRIVILEGES ON public.evaluation_reports TO authenticated, service_role;
GRANT ALL PRIVILEGES ON public.contradictions TO authenticated, service_role;
GRANT ALL PRIVILEGES ON public.validation_results TO authenticated, service_role;
GRANT ALL PRIVILEGES ON public.proctoring_events TO authenticated, service_role;
GRANT ALL PRIVILEGES ON public.evaluation_profiles TO authenticated, service_role;
GRANT ALL PRIVILEGES ON public.evaluation_profile_versions TO authenticated, service_role;
GRANT ALL PRIVILEGES ON public.evaluation_jobs TO authenticated, service_role;

-- Strictly restrict admin/system tables to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_usage_stats TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_audit_log TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. ENABLE RLS ON ALL TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contradictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_usage_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_users') THEN
    ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'evaluation_jobs') THEN
    ALTER TABLE evaluation_jobs ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'interview_drives') THEN
    ALTER TABLE interview_drives ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'drive_access_keys') THEN
    ALTER TABLE drive_access_keys ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'interview_templates') THEN
    ALTER TABLE interview_templates ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'question_banks') THEN
    ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'candidate_assignments') THEN
    ALTER TABLE candidate_assignments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. DROP PERMISSIVE PUBLIC POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "candidates_public_policy" ON candidates;
DROP POLICY IF EXISTS "candidates_onboarding_and_self" ON candidates;
DROP POLICY IF EXISTS "job_posts_public_read" ON job_posts;
DROP POLICY IF EXISTS "job_posts_admin_write" ON job_posts;
DROP POLICY IF EXISTS "job_posts_read_active" ON job_posts;
DROP POLICY IF EXISTS "job_posts_admin_manage" ON job_posts;
DROP POLICY IF EXISTS "interview_sessions_public_policy" ON interview_sessions;
DROP POLICY IF EXISTS "interview_sessions_access" ON interview_sessions;
DROP POLICY IF EXISTS "session_responses_public_policy" ON session_responses;
DROP POLICY IF EXISTS "session_responses_access" ON session_responses;
DROP POLICY IF EXISTS "evaluation_reports_recruiter_policy" ON evaluation_reports;
DROP POLICY IF EXISTS "evaluation_reports_admin_only" ON evaluation_reports;
DROP POLICY IF EXISTS "proctoring_events_insert_policy" ON proctoring_events;
DROP POLICY IF EXISTS "proctoring_events_select_policy" ON proctoring_events;
DROP POLICY IF EXISTS "contradictions_recruiter_policy" ON contradictions;
DROP POLICY IF EXISTS "validation_results_recruiter_policy" ON validation_results;
DROP POLICY IF EXISTS "system_settings_public_read" ON system_settings;
DROP POLICY IF EXISTS "system_settings_admin_write" ON system_settings;
DROP POLICY IF EXISTS "system_settings_admin_only" ON system_settings;
DROP POLICY IF EXISTS "system_usage_stats_admin_policy" ON system_usage_stats;
DROP POLICY IF EXISTS "system_usage_stats_public_read" ON system_usage_stats;
DROP POLICY IF EXISTS "system_usage_stats_admin_only" ON system_usage_stats;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_users') THEN
    DROP POLICY IF EXISTS "admin_users_select_policy" ON admin_users;
    DROP POLICY IF EXISTS "admin_users_all_policy" ON admin_users;
    DROP POLICY IF EXISTS "admin_users_admin_only" ON admin_users;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'evaluation_jobs') THEN
    DROP POLICY IF EXISTS "evaluation_jobs_public" ON evaluation_jobs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'interview_drives') THEN
    DROP POLICY IF EXISTS "interview_drives_public_policy" ON interview_drives;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'drive_access_keys') THEN
    DROP POLICY IF EXISTS "drive_access_keys_public_policy" ON drive_access_keys;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. CREATE SCOPED & SECURE RLS POLICIES
-- ----------------------------------------------------------------------------

-- A. ADMIN USERS (Strictly Admin / Service Role Only)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_users') THEN
    CREATE POLICY "admin_users_admin_only" ON admin_users
      FOR ALL TO authenticated
      USING (
        (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
        OR (auth.jwt() ->> 'role') = 'service_role'
      )
      WITH CHECK (
        (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
        OR (auth.jwt() ->> 'role') = 'service_role'
      );
  END IF;
END $$;

-- B. CANDIDATES (Self onboarding/access or Admin)
CREATE POLICY "candidates_onboarding_and_self" ON candidates
  FOR ALL TO anon, authenticated
  USING (
    clerk_user_id IS NULL -- Allow candidate guest registration during session start
    OR (auth.jwt() ->> 'sub') = clerk_user_id
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    clerk_user_id IS NULL
    OR (auth.jwt() ->> 'sub') = clerk_user_id
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- C. JOB POSTS (Public Read for Active Jobs, Admin Manage)
CREATE POLICY "job_posts_read_active" ON job_posts
  FOR SELECT TO anon, authenticated
  USING (
    status = 'ACTIVE'
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

CREATE POLICY "job_posts_admin_manage" ON job_posts
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- D. INTERVIEW SESSIONS (Session Owner or Admin)
CREATE POLICY "interview_sessions_access" ON interview_sessions
  FOR ALL TO anon, authenticated
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE clerk_user_id IS NULL OR (auth.jwt() ->> 'sub') = clerk_user_id
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates WHERE clerk_user_id IS NULL OR (auth.jwt() ->> 'sub') = clerk_user_id
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- E. SESSION RESPONSES (Response Owner or Admin)
CREATE POLICY "session_responses_access" ON session_responses
  FOR ALL TO anon, authenticated
  USING (
    session_id IN (
      SELECT id FROM interview_sessions WHERE candidate_id IN (
        SELECT id FROM candidates WHERE clerk_user_id IS NULL OR (auth.jwt() ->> 'sub') = clerk_user_id
      )
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM interview_sessions WHERE candidate_id IN (
        SELECT id FROM candidates WHERE clerk_user_id IS NULL OR (auth.jwt() ->> 'sub') = clerk_user_id
      )
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- F. EVALUATION REPORTS (Admin / Recruiter Only)
CREATE POLICY "evaluation_reports_admin_only" ON evaluation_reports
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- G. SYSTEM SETTINGS (Admin Only)
CREATE POLICY "system_settings_admin_only" ON system_settings
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- H. SYSTEM USAGE STATS (Admin Only)
CREATE POLICY "system_usage_stats_admin_only" ON system_usage_stats
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (SELECT email FROM admin_users)
    OR (auth.jwt() ->> 'role') = 'service_role'
  );
