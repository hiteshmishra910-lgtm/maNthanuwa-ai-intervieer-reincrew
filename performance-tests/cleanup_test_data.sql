-- SQL Script to clean up mock candidate and session records created during load testing.
-- Deletes in reverse-dependency order (child tables first) to avoid foreign key violations.

BEGIN;

-- 1. Delete from contradictions linked to Locust sessions
DELETE FROM contradictions
WHERE session_id IN (
    SELECT s.id 
    FROM interview_sessions s
    JOIN candidates c ON s.candidate_id = c.id
    WHERE c.email LIKE 'locust_test_%' OR c.name LIKE 'locust_test_%'
);

-- 2. Delete from validation_results linked to Locust sessions
DELETE FROM validation_results
WHERE session_id IN (
    SELECT s.id 
    FROM interview_sessions s
    JOIN candidates c ON s.candidate_id = c.id
    WHERE c.email LIKE 'locust_test_%' OR c.name LIKE 'locust_test_%'
);

-- 3. Delete from proctoring_events linked to Locust sessions
DELETE FROM proctoring_events
WHERE session_id IN (
    SELECT s.id 
    FROM interview_sessions s
    JOIN candidates c ON s.candidate_id = c.id
    WHERE c.email LIKE 'locust_test_%' OR c.name LIKE 'locust_test_%'
);

-- 4. Delete from session_responses linked to Locust sessions
DELETE FROM session_responses
WHERE session_id IN (
    SELECT s.id 
    FROM interview_sessions s
    JOIN candidates c ON s.candidate_id = c.id
    WHERE c.email LIKE 'locust_test_%' OR c.name LIKE 'locust_test_%'
);

-- 5. Delete from evaluation_reports linked to Locust sessions
DELETE FROM evaluation_reports
WHERE session_id IN (
    SELECT s.id 
    FROM interview_sessions s
    JOIN candidates c ON s.candidate_id = c.id
    WHERE c.email LIKE 'locust_test_%' OR c.name LIKE 'locust_test_%'
);

-- 6. Delete from interview_sessions linked to Locust candidates
DELETE FROM interview_sessions
WHERE candidate_id IN (
    SELECT id 
    FROM candidates 
    WHERE email LIKE 'locust_test_%' OR name LIKE 'locust_test_%'
);

-- 7. Delete the Locust candidates
DELETE FROM candidates
WHERE email LIKE 'locust_test_%' OR name LIKE 'locust_test_%';

COMMIT;

VACUUM ANALYZE contradictions;
VACUUM ANALYZE validation_results;
VACUUM ANALYZE proctoring_events;
VACUUM ANALYZE session_responses;
VACUUM ANALYZE evaluation_reports;
VACUUM ANALYZE interview_sessions;
VACUUM ANALYZE candidates;
