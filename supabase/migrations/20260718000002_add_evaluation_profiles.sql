-- Migration: 20260718_add_evaluation_profiles
-- Adds tables and indexes for evaluation profiles, profile versions, and audit logging.

-- 1. evaluation_profiles
CREATE TABLE IF NOT EXISTS evaluation_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  current_version INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. evaluation_profile_versions
CREATE TABLE IF NOT EXISTS evaluation_profile_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES evaluation_profiles(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  weights JSONB NOT NULL,
  required_dimensions TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_profile_version UNIQUE(profile_id, version_number)
);

-- Index for querying versions
CREATE INDEX IF NOT EXISTS idx_evaluation_profile_versions_lookup ON evaluation_profile_versions(profile_id, version_number);

-- 3. evaluation_audit_log
CREATE TABLE IF NOT EXISTS evaluation_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  profile_version_id UUID REFERENCES evaluation_profile_versions(id) NOT NULL,
  cache_hit BOOLEAN DEFAULT false NOT NULL,
  latency_ms INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  hash TEXT NOT NULL,
  evaluation_result JSONB NOT NULL,
  replay_metadata JSONB NOT NULL,
  raw_input_snapshot JSONB, -- Nullable, only stored if debug_mode=true
  evaluated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for audit log observability and performance
CREATE INDEX IF NOT EXISTS idx_evaluation_audit_log_session ON evaluation_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_audit_log_evaluated_at ON evaluation_audit_log(evaluated_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_audit_log_profile_version ON evaluation_audit_log(profile_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_audit_log_hash ON evaluation_audit_log(hash);

-- Enable RLS and set permissive policies
ALTER TABLE evaluation_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evaluation_profiles_public" ON evaluation_profiles;
CREATE POLICY "evaluation_profiles_public" ON evaluation_profiles FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.evaluation_profiles TO anon, authenticated;

ALTER TABLE evaluation_profile_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evaluation_profile_versions_public" ON evaluation_profile_versions;
CREATE POLICY "evaluation_profile_versions_public" ON evaluation_profile_versions FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON public.evaluation_profile_versions TO anon, authenticated;

ALTER TABLE evaluation_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evaluation_audit_log_authenticated" ON evaluation_audit_log;
CREATE POLICY "evaluation_audit_log_authenticated" ON evaluation_audit_log FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON public.evaluation_audit_log TO anon, authenticated;
