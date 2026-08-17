-- Drop the unused access_key column from job_posts.
-- Access control for drives now uses the dedicated drive_access_keys table.
-- The column was already revoked from anon reads in migration 20260728.
-- This migration completes the cleanup by removing the column entirely.

ALTER TABLE job_posts DROP COLUMN IF EXISTS access_key;
