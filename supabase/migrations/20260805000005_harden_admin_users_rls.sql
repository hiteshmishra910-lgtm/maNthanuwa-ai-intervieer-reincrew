-- Migration: 20260805000005_harden_admin_users_rls.sql
-- Harden admin_users RLS: allow SELECT for role checking, restrict write operations to service_role and admins.

REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM anon;
GRANT SELECT ON public.admin_users TO authenticated, anon;
GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_allow_all" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_policy" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_write_policy" ON public.admin_users;

-- Allow authenticated and anon to SELECT from admin_users to resolve user roles (useUserRole)
CREATE POLICY "admin_users_select_policy"
ON public.admin_users FOR SELECT
TO authenticated, anon
USING (true);

-- Only service_role can INSERT/UPDATE/DELETE admin_users directly
CREATE POLICY "admin_users_write_policy"
ON public.admin_users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
