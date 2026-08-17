-- Add API tier columns to ai_provider_logs for free→paid fallback observability
-- provider_tier: which tier ('free' | 'paid') served the request
-- fallback_reason: why the switch happened (RATE_LIMIT, QUOTA_EXHAUSTED, etc.)
ALTER TABLE ai_provider_logs
  ADD COLUMN IF NOT EXISTS provider_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;