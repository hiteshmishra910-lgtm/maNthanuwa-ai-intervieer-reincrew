-- ============================================================
-- Migration: Recruiter Onboarding
-- Date: 2026-07-28
-- Author: Shreya
-- Description:
--   - Creates organizations table for recruiter onboarding
--   - Opens RLS policies on interview_drives, drive_access_keys,
--     candidate_assignments for HR import and /join route
--   - All policies are intentionally permissive (true) for now.
--     Proper email-based RLS requires Clerk JWT template
--     configuration — flagged as future work.
-- ============================================================


-- ── 1. Organizations table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  industry     text,
  company_size text,
  website      text,
  created_by   text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.organizations;
CREATE POLICY "Enable read for authenticated users"
  ON public.organizations
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.organizations;
CREATE POLICY "Enable insert for authenticated users"
  ON public.organizations
  FOR INSERT
  WITH CHECK (true);

GRANT ALL ON public.organizations TO anon;
GRANT ALL ON public.organizations TO authenticated;


-- ── 2. interview_drives — open policy for HR flow ────────────────────────────
-- Allows HR users to create and update drives, and allows anon
-- SELECT so /join route can look up drives by access key.

DROP POLICY IF EXISTS "interview_drives_public_policy" ON public.interview_drives;
CREATE POLICY "interview_drives_public_policy"
  ON public.interview_drives
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.interview_drives TO anon;
GRANT ALL ON public.interview_drives TO authenticated;


-- ── 3. drive_access_keys — open policy for /join route ───────────────────────
-- Allows anon users (candidates) to read access keys on the
-- /join route without being authenticated.

DROP POLICY IF EXISTS "drive_access_keys_public_policy" ON public.drive_access_keys;
CREATE POLICY "drive_access_keys_public_policy"
  ON public.drive_access_keys
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.drive_access_keys TO anon;
GRANT ALL ON public.drive_access_keys TO authenticated;


-- ── 4. candidate_assignments — open policy for CSV import ────────────────────
-- Allows HR to insert candidate assignments via CSV import
-- and allows candidates to read their own assignments on /join.

DROP POLICY IF EXISTS "candidate_assignments_public_policy" ON public.candidate_assignments;
CREATE POLICY "candidate_assignments_public_policy"
  ON public.candidate_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.candidate_assignments TO anon;
GRANT ALL ON public.candidate_assignments TO authenticated;


-- ── Future work ───────────────────────────────────────────────────────────────
-- Replace permissive policies above with email-based RLS once
-- Clerk JWT template is configured to include email claims:
--
-- Example for organizations:
--   CREATE POLICY "hr_own_org"
--     ON public.organizations FOR ALL
--     USING (auth.jwt() ->> 'email' = created_by)
--     WITH CHECK (auth.jwt() ->> 'email' = created_by);
--
-- Example for interview_drives:
--   CREATE POLICY "hr_own_drives"
--     ON public.interview_drives FOR ALL
--     USING (auth.jwt() ->> 'email' = created_by)
--     WITH CHECK (auth.jwt() ->> 'email' = created_by);
-- ============================================================