-- ============================================================================
-- CR-1 FOLLOW-UP: remove residual permissive policies that still expose candidate data.
--
-- SYMPTOM (measured against production AFTER 20260726_harden_rls_security.sql):
--   An anonymous caller holding only the public anon key can still read
--     candidates          10 rows  (name + email)
--     interview_sessions 122 rows
--     session_responses  640 rows  (answers + expected_key_points)
--     job_posts           20 rows
--     evaluation_jobs     26 rows
--   while admin_users / system_settings / system_usage_stats correctly return 401.
--
-- WHY THE PREVIOUS MIGRATION WAS NOT ENOUGH:
--   PostgreSQL combines multiple PERMISSIVE policies on a table with OR. The hardening
--   migration dropped old policies BY NAME. Any pre-existing policy whose name was not on
--   that list survives and re-grants access on its own, regardless of how strict the new
--   policy is. The `clerk_user_id IS NULL` guest clause is NOT the explanation: only 2 of
--   the 10 visible candidate rows have a NULL clerk_user_id, yet all 10 are readable.
--
-- WHAT THIS DOES:
--   Enumerates pg_policies and drops EVERY policy on the affected tables, then recreates a
--   single known-good policy per table. Dropping by enumeration rather than by name is the
--   only way to guarantee no residual policy survives.
--
-- SAFETY:
--   Run STEP 0 first and keep the output — it is the record of what existed beforehand.
--   This migration is idempotent and can be re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 0 — INSPECT FIRST. Read-only. Save this output before proceeding.
-- ---------------------------------------------------------------------------
-- SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename IN ('candidates','interview_sessions','session_responses',
--                      'job_posts','evaluation_jobs')
--  ORDER BY tablename, policyname;

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 1 — Drop every existing policy on the affected tables.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('candidates','interview_sessions','session_responses',
                         'job_posts','evaluation_jobs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'Dropped residual policy % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 2 — Ensure RLS is enabled AND forced.
-- FORCE matters: without it the table owner bypasses RLS entirely.
-- ---------------------------------------------------------------------------
ALTER TABLE public.candidates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.session_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_responses   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_posts           FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='evaluation_jobs') THEN
    EXECUTE 'ALTER TABLE public.evaluation_jobs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.evaluation_jobs FORCE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 3 — Recreate exactly one policy per table.
--
-- Guest onboarding note: the previous policy allowed reading ANY row where
-- clerk_user_id IS NULL, so every guest/legacy candidate was world-readable. Anonymous
-- callers now get INSERT only — enough to register at session start, with no read access.
-- ---------------------------------------------------------------------------

-- candidates: a signed-in user sees only their own row; admins see all.
CREATE POLICY "candidates_self_or_admin_read" ON public.candidates
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'sub') = clerk_user_id
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users)
  );

-- Anonymous callers may create their candidate row at session start, but cannot read it back.
CREATE POLICY "candidates_anon_insert_only" ON public.candidates
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "candidates_self_update" ON public.candidates
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'sub') = clerk_user_id)
  WITH CHECK ((auth.jwt() ->> 'sub') = clerk_user_id);

-- interview_sessions: scoped to the owning candidate; admins see all.
CREATE POLICY "interview_sessions_owner_or_admin" ON public.interview_sessions
  FOR ALL TO authenticated
  USING (
    candidate_id IN (
      SELECT id FROM public.candidates WHERE (auth.jwt() ->> 'sub') = clerk_user_id
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users)
  )
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM public.candidates WHERE (auth.jwt() ->> 'sub') = clerk_user_id
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users)
  );

-- session_responses: scoped through the session to the owning candidate.
CREATE POLICY "session_responses_owner_or_admin" ON public.session_responses
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM public.interview_sessions s
       WHERE s.candidate_id IN (
         SELECT id FROM public.candidates WHERE (auth.jwt() ->> 'sub') = clerk_user_id
       )
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users)
  )
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM public.interview_sessions s
       WHERE s.candidate_id IN (
         SELECT id FROM public.candidates WHERE (auth.jwt() ->> 'sub') = clerk_user_id
       )
    )
    OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users)
  );

-- job_posts: intentionally public-readable (the join page lists open roles), but the
-- access_key column must never be exposed. Reads go through a view that omits it.
CREATE POLICY "job_posts_admin_manage" ON public.job_posts
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users))
  WITH CHECK ((auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users));

CREATE POLICY "job_posts_public_read" ON public.job_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE');

-- evaluation_jobs: enqueue-only for clients; the worker uses the service role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='evaluation_jobs') THEN
    EXECUTE $p$
      CREATE POLICY "evaluation_jobs_owner_read" ON public.evaluation_jobs
        FOR SELECT TO authenticated
        USING (
          session_id IN (
            SELECT s.id FROM public.interview_sessions s
             WHERE s.candidate_id IN (
               SELECT id FROM public.candidates WHERE (auth.jwt() ->> 'sub') = clerk_user_id
             )
          )
          OR (auth.jwt() ->> 'email') IN (SELECT email FROM public.admin_users)
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "evaluation_jobs_enqueue" ON public.evaluation_jobs
        FOR INSERT TO anon, authenticated WITH CHECK (true)
    $p$;
  END IF;
END $$;

DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'job_posts' AND column_name = 'access_key') THEN 
    REVOKE ALL (access_key) ON public.job_posts FROM anon;
  END IF; 
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- STEP 5 — VERIFY. With only the anon key, all of these must now return 0 rows or 401:
--   GET /rest/v1/candidates?select=*
--   GET /rest/v1/interview_sessions?select=*
--   GET /rest/v1/session_responses?select=*
--   GET /rest/v1/job_posts?select=access_key
-- And confirm exactly one policy set remains:
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
--    AND tablename IN ('candidates','interview_sessions','session_responses',
--                      'job_posts','evaluation_jobs') ORDER BY 1,2;
-- ---------------------------------------------------------------------------
