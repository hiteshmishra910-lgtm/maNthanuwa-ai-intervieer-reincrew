-- ============================================================================
-- Migration: Cleanup Load Testing Data & Restore Answered Sessions
--
-- 1. Soft-deletes or hard-deletes mock/load-test sessions (e.g. loadtest_*, test_* emails, or "Load Test" names).
-- 2. Restores real candidate sessions that have questions answered (is_deleted = false).
-- 3. Ensures interview_sessions.status = 'COMPLETED' for sessions with recorded answers.
-- ============================================================================

-- 1. Soft delete load test sessions
UPDATE interview_sessions
SET is_deleted = true, deleted_at = NOW()
WHERE id IN (
  SELECT s.id
  FROM interview_sessions s
  JOIN candidates c ON s.candidate_id = c.id
  WHERE c.email LIKE 'loadtest_%'
     OR c.email LIKE '%@test.com'
     OR c.email LIKE 'test_%'
     OR c.email LIKE 'bot_%'
     OR c.name LIKE '%Load Test%'
     OR c.name LIKE 'Mock %'
);

-- 2. Restore any real candidate sessions that were soft-deleted but have answered questions
UPDATE interview_sessions
SET is_deleted = false, deleted_at = NULL
WHERE id IN (
  SELECT DISTINCT session_id FROM session_responses
)
AND id NOT IN (
  SELECT s.id
  FROM interview_sessions s
  JOIN candidates c ON s.candidate_id = c.id
  WHERE c.email LIKE 'loadtest_%'
     OR c.email LIKE '%@test.com'
);

-- 3. Mark interview_sessions as COMPLETED for sessions with session_responses
UPDATE interview_sessions
SET status = 'COMPLETED'
WHERE id IN (
  SELECT DISTINCT session_id FROM session_responses
)
AND status NOT IN ('COMPLETED', 'TERMINATED');
