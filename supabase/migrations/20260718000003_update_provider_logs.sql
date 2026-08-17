-- Expand ai_provider_logs with detailed telemetry metrics
ALTER TABLE ai_provider_logs 
ADD COLUMN IF NOT EXISTS tokens_in INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_out INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT false;
