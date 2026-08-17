-- ============================================================================
-- PHASE 2: expose is_practice on vw_candidate_master.
--
-- PROBLEM
--   Practice sessions are written to the same `interview_sessions` table as real interviews
--   (src/Practice/hooks/usePracticeSession.ts:115). The only marker is a nested JSONB field,
--   interview_metadata -> 'practice' -> 'is_practice'.
--
--   vw_candidate_master — the feed behind the Admin dashboard (AdminDashboard.tsx:259) and the
--   HR dashboard (HRDashboard.tsx:60) via SupabaseService.getAllSessions() — neither filtered
--   on that flag nor even SELECTed it. A recruiter therefore saw every student practice run as
--   though it were a real interview submission, and those rows fed the candidate tables, the CSV
--   export and the analytics averages. A student practising ten times created ten phantom
--   candidates in the hiring pipeline.
--
--   The flag could not be filtered client-side either, because the view did not expose it.
--
-- WHAT THIS DOES
--   Re-creates the view with one extra column. Every existing column keeps its name, order and
--   type, so this is additive and backwards compatible: existing consumers are unaffected.
--
--   Deployment order does not matter. The application filters defensively on a possibly-absent
--   field, so it behaves exactly as it does today until this migration runs, and starts
--   excluding practice sessions afterwards.
--
--   The candidate's own history is unaffected — it uses getStudentSessions(), not this view, so
--   students continue to see their practice results.
-- ============================================================================

DROP VIEW IF EXISTS vw_candidate_master CASCADE;
CREATE OR REPLACE VIEW vw_candidate_master AS
SELECT
  c.id AS candidate_id,
  s.id AS session_id,
  c.name AS candidate_name,
  c.email AS candidate_email,
  j.title AS role,
  s.started_at AS interview_date,
  s.duration_seconds / 60 AS duration_minutes,
  s.total_questions AS questions_asked,
  (SELECT COUNT(*) FROM session_responses WHERE session_id = s.id) AS questions_answered,
  s.overall_score,
  e.risk_score,
  e.risk_level,
  e.hiring_recommendation AS recommendation,
  e.candidate_outcome,
  s.status AS session_status,
  s.is_deleted,
  s.deleted_at,
  e.strengths,
  e.failures AS weaknesses,
  -- NEW: surfaces the practice marker so recruiter-facing queries can exclude it.
  -- COALESCE to false so pre-existing rows without the metadata are treated as real interviews,
  -- which preserves current behaviour for historical data.
  COALESCE((s.interview_metadata -> 'practice' ->> 'is_practice')::boolean, false) AS is_practice
FROM candidates c
JOIN interview_sessions s ON c.id = s.candidate_id
LEFT JOIN job_posts j ON s.job_post_id = j.id
LEFT JOIN evaluation_reports e ON s.id = e.session_id;

-- Verification:
--   SELECT is_practice, COUNT(*) FROM vw_candidate_master GROUP BY is_practice;
