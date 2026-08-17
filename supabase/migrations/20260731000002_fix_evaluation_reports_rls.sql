-- ============================================================================
-- REICREW AI — PRODUCTION RLS SECURITY REMEDIATION
-- Migration: 20260731_fix_evaluation_reports_rls.sql
-- ============================================================================
-- PURPOSE:
--   1. Replaces admin-only RLS policy on evaluation_reports with scoped role policies.
--   2. Grants Candidates SELECT & INSERT access for their own interview sessions.
--   3. Grants HR Recruiters SELECT access for candidates assigned to their drives.
--   4. Strictly DENIES Candidates & Recruiters UPDATE/DELETE access (reports are immutable).
--   5. Creates expression indexes on LOWER() columns for high-performance RLS evaluation.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: Performance Expression Indexing
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_evaluation_reports_session ON public.evaluation_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate ON public.interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidates_clerk_sub ON public.candidates(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email_lower ON public.candidates(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_candidate_assignments_session ON public.candidate_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_candidate_assignments_drive ON public.candidate_assignments(drive_id);
CREATE INDEX IF NOT EXISTS idx_candidate_assignments_assigned_by_lower ON public.candidate_assignments(LOWER(assigned_by));
CREATE INDEX IF NOT EXISTS idx_interview_drives_created_by_lower ON public.interview_drives(LOWER(created_by));

-- ----------------------------------------------------------------------------
-- STEP 2: Safeguarded Database Constraints
-- ----------------------------------------------------------------------------
DO $$ 
DECLARE
  v_dup_count INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'evaluation_reports') THEN
    
    -- Check for duplicate session_id rows before applying unique constraint
    SELECT COUNT(*) INTO v_dup_count
    FROM (
      SELECT session_id FROM public.evaluation_reports
      GROUP BY session_id HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count = 0 THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_evaluation_reports_session_id') THEN
        ALTER TABLE public.evaluation_reports ADD CONSTRAINT unique_evaluation_reports_session_id UNIQUE (session_id);
      END IF;
    ELSE
      RAISE NOTICE 'Skipping UNIQUE(session_id) constraint creation: % duplicate session_id row(s) found.', v_dup_count;
    END IF;

  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: Scoped, Role-Based RLS Policies
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'evaluation_reports') THEN
    
    -- Drop legacy policies cleanly
    DROP POLICY IF EXISTS "evaluation_reports_manage" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_admin_only" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_recruiter_policy" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_select_policy" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_insert_policy" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_update_policy" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_delete_policy" ON public.evaluation_reports;

    -- Enable and FORCE RLS
    ALTER TABLE public.evaluation_reports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.evaluation_reports FORCE ROW LEVEL SECURITY;

    -- 1. SELECT POLICY: Admins, Service Role, Owning Candidates, and Assigned Recruiters
    CREATE POLICY "evaluation_reports_select_policy" ON public.evaluation_reports
      FOR SELECT TO authenticated
      USING (
        -- Admin or Service Role
        public.is_admin() 
        OR (auth.jwt() ->> 'role') = 'service_role'
        -- Owning Candidate (matching clerk_user_id or email claim)
        OR session_id IN (
          SELECT s.id FROM public.interview_sessions s
          JOIN public.candidates c ON c.id = s.candidate_id
          WHERE c.clerk_user_id = (auth.jwt() ->> 'sub')
             OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', auth.jwt() ->> 'user_email', auth.jwt() -> 'claims' ->> 'email', ''))
        )
        -- Assigned Recruiter (matching drive created_by or assignment assigned_by)
        OR session_id IN (
          SELECT ca.session_id FROM public.candidate_assignments ca
          LEFT JOIN public.interview_drives d ON d.id = ca.drive_id
          WHERE ca.session_id IS NOT NULL
            AND (
              LOWER(ca.assigned_by) = LOWER(COALESCE(auth.jwt() ->> 'email', auth.jwt() ->> 'user_email', auth.jwt() -> 'claims' ->> 'email', ''))
              OR LOWER(d.created_by) = LOWER(COALESCE(auth.jwt() ->> 'email', auth.jwt() ->> 'user_email', auth.jwt() -> 'claims' ->> 'email', ''))
            )
        )
      );

    -- 2. INSERT POLICY: Admins, Service Role, or Owning Candidate (Initial Local Evaluation insert only)
    CREATE POLICY "evaluation_reports_insert_policy" ON public.evaluation_reports
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin() 
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR session_id IN (
          SELECT s.id FROM public.interview_sessions s
          JOIN public.candidates c ON c.id = s.candidate_id
          WHERE c.clerk_user_id = (auth.jwt() ->> 'sub')
             OR LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', auth.jwt() ->> 'user_email', auth.jwt() -> 'claims' ->> 'email', ''))
        )
      );

    -- 3. UPDATE / DELETE POLICIES: Admins & Service Role ONLY (Candidates CANNOT update or delete reports)
    CREATE POLICY "evaluation_reports_update_policy" ON public.evaluation_reports
      FOR UPDATE TO authenticated
      USING (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role')
      WITH CHECK (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role');

    CREATE POLICY "evaluation_reports_delete_policy" ON public.evaluation_reports
      FOR DELETE TO authenticated
      USING (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role');

  END IF;
END $$;

COMMIT;
