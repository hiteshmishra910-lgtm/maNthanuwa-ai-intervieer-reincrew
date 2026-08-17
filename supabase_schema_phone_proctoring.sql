-- ============================================================================
-- REICREW AI — Phone Camera Proctoring Migration
-- Run this in Supabase SQL Editor after the base schema (v6) is deployed.
-- ============================================================================

-- Pairing tokens for phone-camera proctoring
-- 8-char uppercase alphanumeric, one-time-use with connectionId binding
CREATE TABLE IF NOT EXISTS proctoring_pairing_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
  token VARCHAR(8) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,                     -- Set on first phone connect (one-time use)
  connection_id TEXT,                          -- e.g. "phone_8fd3ac91", bound on first connect
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Fast lookup by token (pairing flow)
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_token ON proctoring_pairing_tokens(token);

-- Fast lookup by session (cleanup / admin queries)
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_session ON proctoring_pairing_tokens(session_id);
