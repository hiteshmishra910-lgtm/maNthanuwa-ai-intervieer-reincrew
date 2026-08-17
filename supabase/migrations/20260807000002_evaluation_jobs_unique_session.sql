-- Migration: 20260807000002_evaluation_jobs_unique_session.sql
-- Add UNIQUE constraint on evaluation_jobs.session_id to enable ON CONFLICT upserts.
-- Without this, the client-side EvaluationQueue.enqueue() upsert always fails with HTTP 400,
-- causing the fallback worker to never know whether the edge function has already run.

-- Step 1: Check for and remove duplicate rows (keep the most recent per session_id)
DELETE FROM evaluation_jobs
WHERE id NOT IN (
  SELECT DISTINCT ON (session_id) id
  FROM evaluation_jobs
  ORDER BY session_id, created_at DESC
);

-- Step 2: Add the UNIQUE constraint
ALTER TABLE evaluation_jobs
  ADD CONSTRAINT evaluation_jobs_session_id_unique UNIQUE (session_id);
