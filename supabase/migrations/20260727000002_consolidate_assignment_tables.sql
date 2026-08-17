-- Step 1: Recreate vw_assignment_tracking to query candidate_assignments instead of interview_assignments
-- The old view joined interview_assignments → job_posts for the job title.
-- The new view joins candidate_assignments → interview_drives (drives have the position title).

DROP VIEW IF EXISTS vw_assignment_tracking CASCADE;

CREATE OR REPLACE VIEW vw_assignment_tracking AS
SELECT
  ca.id,
  c.email AS candidate_email,
  c.name AS candidate_name,
  ca.drive_id,
  d.title AS job_title,
  ca.assigned_by,
  ca.status,
  ca.deadline,
  ca.max_attempts,
  ca.attempts_used,
  ca.session_id,
  ca.notes,
  ca.assigned_at AS created_at,
  ca.updated_at,
  es.overall_score,
  es.started_at AS session_started_at,
  es.completed_at AS session_completed_at
FROM candidate_assignments ca
LEFT JOIN candidates c ON c.id = ca.candidate_id
LEFT JOIN interview_drives d ON d.id = ca.drive_id
LEFT JOIN interview_sessions es ON es.id = ca.session_id;

-- Step 2: Drop the old interview_assignments table (with its trigger and function first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'interview_assignments') THEN
    DROP TRIGGER IF EXISTS trg_assignment_updated_at ON interview_assignments;
  END IF;
END $$;
DROP FUNCTION IF EXISTS update_assignment_updated_at;
DROP TABLE IF EXISTS interview_assignments CASCADE;
