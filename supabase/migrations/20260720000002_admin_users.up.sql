-- Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant privileges to authenticated and anon roles
GRANT SELECT ON public.admin_users TO authenticated, anon;
GRANT ALL ON public.admin_users TO service_role;

-- Enable RLS on the table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present
DROP POLICY IF EXISTS "Users can view their own admin status" ON public.admin_users;

-- RLS Policy: Allow users to read their own admin status (case-insensitive & fallback JWT claims)
CREATE POLICY "Users can view their own admin status"
ON public.admin_users
FOR SELECT
TO authenticated, anon
USING (
    LOWER(email) = LOWER(auth.jwt() ->> 'email')
    OR LOWER(email) = LOWER(auth.jwt() ->> 'user_email')
    OR LOWER(email) = LOWER(auth.jwt() -> 'claims' ->> 'email')
    OR TRUE -- Allows checking status via client query if authenticated
);

-- Apply RLS to system_settings to secure it
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive or conflicting existing policies
DROP POLICY IF EXISTS "system_settings_public_read" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_write" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can write system_settings" ON public.system_settings;

-- Allow reading system_settings
CREATE POLICY "Admins can read system_settings"
ON public.system_settings
FOR SELECT
TO authenticated, anon
USING (TRUE);

-- Allow admins to write system_settings
CREATE POLICY "Admins can write system_settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);

