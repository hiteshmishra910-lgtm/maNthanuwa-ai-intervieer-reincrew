-- Migration: Update evaluation_jobs status CHECK constraint and add operational metadata columns for retry worker
ALTER TABLE evaluation_jobs DROP CONSTRAINT IF EXISTS evaluation_jobs_status_check;
ALTER TABLE evaluation_jobs ADD CONSTRAINT evaluation_jobs_status_check 
    CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'FAILED_RETRYABLE', 'FAILED_PERMANENT'));

ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Index for queue worker fast lookup
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_queue_lookup 
    ON evaluation_jobs (status, next_retry_at, attempts);
