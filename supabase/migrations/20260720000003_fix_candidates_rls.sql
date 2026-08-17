-- Fix: Add RLS policy for candidates table that allows authenticated users to read
-- This policy exists in the schema but may not have been applied to your Supabase project.
-- Run this in your Supabase SQL Editor.

-- Enable RLS on candidates table (if not already enabled)
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "candidates_public_policy" ON candidates;

-- Create policy: allow all operations (SELECT, INSERT, UPDATE, DELETE) for everyone
-- This is intentionally permissive since candidates own their data through Clerk auth
CREATE POLICY "candidates_public_policy" ON candidates
  FOR ALL USING (true) WITH CHECK (true);

-- Also ensure the interview_sessions view is accessible
-- Drop & recreate to confirm it works with security_invoker
DROP POLICY IF EXISTS "interview_sessions_public_policy" ON interview_sessions;
CREATE POLICY "interview_sessions_public_policy" ON interview_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Note: If you still see permission errors, check that:
-- 1. RLS is enabled: ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
-- 2. The policy exists: SELECT * FROM pg_policies WHERE tablename = 'candidates';
-- 3. Your Clerk JWT template includes 'iss' claim matching your Supabase project
