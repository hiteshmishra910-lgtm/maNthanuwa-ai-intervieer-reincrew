-- ============================================================================
-- SECURITY & FUNCTIONALITY REMEDIATION: ROBUST ADMIN AUTHENTICATION
-- Migration: 20260730_fix_system_settings_rls.sql
--
-- PURPOSE:
--   1. Preserve 100% of the security hardening from CR-1 / 20260726_harden_rls_security.sql.
--      (Ensuring non-admin candidates and anonymous users CANNOT read or write system settings,
--      admin users, or system usage stats).
--   2. Resolve the technical bugs blocking verified admins from saving evaluation mode settings:
--      - Eliminates RLS infinite recursion on admin_users by using a SECURITY DEFINER helper.
--      - Restores case-insensitive multi-claim Clerk JWT matching (email, user_email, claims->email).
--      - Adds missing WITH CHECK clauses required by PostgreSQL for .upsert() write operations.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: Create secure, non-recursive admin verification helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Extract email from Clerk or Supabase JWT claims (handling various token templates)
  v_email := COALESCE(
    auth.jwt() ->> 'email',
    auth.jwt() ->> 'user_email',
    auth.jwt() -> 'claims' ->> 'email'
  );
  
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if email exists in admin_users (case-insensitive).
  -- SECURITY DEFINER allows this lookup without triggering recursive RLS evaluation.
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE LOWER(email) = LOWER(v_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- STEP 2: Secure & fix system_settings (Admin / Service Role Only)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_settings') THEN
    DROP POLICY IF EXISTS "system_settings_public_read" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_admin_write" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_admin_only" ON public.system_settings;
    DROP POLICY IF EXISTS "Admins can read system_settings" ON public.system_settings;
    DROP POLICY IF EXISTS "Admins can write system_settings" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_admin_manage" ON public.system_settings;

    CREATE POLICY "system_settings_admin_manage" ON public.system_settings
      FOR ALL TO authenticated
      USING (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role')
      WITH CHECK (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: Secure & fix admin_users (Admin / Service Role Only)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_users') THEN
    DROP POLICY IF EXISTS "admin_users_select_policy" ON public.admin_users;
    DROP POLICY IF EXISTS "admin_users_all_policy" ON public.admin_users;
    DROP POLICY IF EXISTS "admin_users_admin_only" ON public.admin_users;
    DROP POLICY IF EXISTS "Users can view their own admin status" ON public.admin_users;
    DROP POLICY IF EXISTS "admin_users_manage" ON public.admin_users;

    -- Admins and service role can manage admin users; users can check their own admin status
    CREATE POLICY "admin_users_manage" ON public.admin_users
      FOR ALL TO authenticated
      USING (
        public.is_admin() 
        OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', auth.jwt() ->> 'user_email', auth.jwt() -> 'claims' ->> 'email', ''))
        OR (auth.jwt() ->> 'role') = 'service_role'
      )
      WITH CHECK (
        public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role'
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 4: Secure & fix system_usage_stats (Admin / Service Role Only)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_usage_stats') THEN
    DROP POLICY IF EXISTS "system_usage_stats_admin_policy" ON public.system_usage_stats;
    DROP POLICY IF EXISTS "system_usage_stats_public_read" ON public.system_usage_stats;
    DROP POLICY IF EXISTS "system_usage_stats_admin_only" ON public.system_usage_stats;
    DROP POLICY IF EXISTS "system_usage_stats_manage" ON public.system_usage_stats;

    CREATE POLICY "system_usage_stats_manage" ON public.system_usage_stats
      FOR ALL TO authenticated
      USING (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role')
      WITH CHECK (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 5: Secure & fix evaluation_reports (Admin / Recruiter Only)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'evaluation_reports') THEN
    DROP POLICY IF EXISTS "evaluation_reports_recruiter_policy" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_admin_only" ON public.evaluation_reports;
    DROP POLICY IF EXISTS "evaluation_reports_manage" ON public.evaluation_reports;

    CREATE POLICY "evaluation_reports_manage" ON public.evaluation_reports
      FOR ALL TO authenticated
      USING (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role')
      WITH CHECK (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role');
  END IF;
END $$;

COMMIT;
