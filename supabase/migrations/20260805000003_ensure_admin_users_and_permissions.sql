-- Migration: 20260805000003_ensure_admin_users_and_permissions.sql
-- Ensure admin_users table structure, permissions, and RLS policies are restored cleanly.

CREATE TABLE IF NOT EXISTS public.admin_users (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant full access to service_role, and read access to authenticated and anon
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated, anon, service_role;

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Permissive policy to allow client role lookups
DROP POLICY IF EXISTS "admin_users_allow_all" ON public.admin_users;
CREATE POLICY "admin_users_allow_all"
ON public.admin_users
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Seed Admin & HR team members
INSERT INTO public.admin_users (email, role)
VALUES
  ('shreyayadav9885@gmail.com', 'admin'),
  ('pranitakhobe22@gmail.com', 'admin'),
  ('rohitnalbuga2@gmail.com', 'admin'),
  ('aaditya0257@gmail.com', 'admin'),
  ('shivamjpatil2007@gmail.com', 'admin'),
  ('riddhinahar028@gmail.com', 'admin'),
  ('harshkatole30@gmail.com', 'admin'),
  ('shreyayadav2703@gmail.com', 'admin'),
  ('dakshitadekate@gmail.com', 'admin')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;
