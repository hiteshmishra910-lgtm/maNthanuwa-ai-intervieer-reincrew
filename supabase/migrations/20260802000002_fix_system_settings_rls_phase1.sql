-- ============================================================================
-- Phase 1: Fix RLS Policies for system_settings (Admin Verification)
-- Migration: 20260802_fix_system_settings_rls_phase1.sql
--
-- PURPOSE:
--   - Corrects `is_admin()` JWT claim extraction to capture all standard Clerk variants.
--   - Re-asserts `system_settings_admin_manage` policy.
--
-- EXPECTED JWT STRUCTURE FROM CLERK:
-- {
--   "aud": "authenticated",
--   "role": "authenticated",
--   "sub": "user_2...",
--   "email": "admin@example.com",             <- Standard Supabase JWT format
--   "user_metadata": { "email": "..." },      <- Supabase user_metadata format
--   "claims": { "email": "..." }              <- Legacy/custom claims format
-- }
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Extract email comprehensively from all possible Clerk/Supabase JWT locations
  v_email := COALESCE(
    auth.jwt() ->> 'email',
    auth.jwt() ->> 'user_email',
    auth.jwt() -> 'claims' ->> 'email'
  );
  
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if email exists in admin_users (case-insensitive).
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE LOWER(email) = LOWER(v_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- Ensure system_settings policy is completely clean and re-applied
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_settings') THEN
    DROP POLICY IF EXISTS "system_settings_admin_manage" ON public.system_settings;
    
    -- Crucial: Apply FOR ALL so it handles SELECT, INSERT, UPDATE, DELETE
    CREATE POLICY "system_settings_admin_manage" ON public.system_settings
      FOR ALL TO authenticated
      USING (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role')
      WITH CHECK (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role');
  END IF;
END $$;

COMMIT;
