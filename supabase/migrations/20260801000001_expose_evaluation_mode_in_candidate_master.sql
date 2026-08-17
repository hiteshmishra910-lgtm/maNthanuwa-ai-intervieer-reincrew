-- =====================================================================
-- Expose the session's configured evaluation mode in vw_candidate_master
-- =====================================================================
--
-- PROBLEM
-- -------
-- `createSession` (src/Core/database/supabaseService.ts) resolves the effective evaluation
-- mode for every session and persists it at
--   interview_sessions.interview_metadata ->> 'evaluationMode'
-- with the job post's snapshot as a secondary source at
--   interview_metadata -> 'job_settings_snapshot' ->> 'evaluationMode'.
--
-- The recruiter dashboards never saw either value. `getAllSessions()` reads exclusively from
-- vw_candidate_master, and this view did not select interview_metadata at all. The dashboard's
-- mode resolver therefore had only one possible source — the saved evaluation report's
-- metadata — and fell back to reporting 'LOCAL' whenever that report was absent or had not
-- been written yet.
--
-- The visible consequence was that the Evaluation Reports table displayed LOCAL for every
-- session, including sessions that had genuinely been configured for and evaluated in API or
-- HYBRID mode. That is a false statement of fact about how a candidate was assessed.
--
-- FIX
-- ---
-- Append the configured mode to the view. `CREATE OR REPLACE VIEW` permits appending columns
-- as long as the existing columns keep their name, order and type, so every existing consumer
-- is unaffected.
--
-- The value is normalised here rather than in TypeScript so that the SQL feed, the CSV export
-- and any future direct query all agree: quotes stripped (system_settings stores JSON scalars,
-- so the value can arrive as `"API"`), trimmed, upper-cased, and NULL rather than '' when
-- absent. NULL is deliberate — it means "not recorded", which the UI must render as unknown
-- rather than silently claiming LOCAL.
--
-- Idempotent: safe to re-run.
-- =====================================================================

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
  -- Surfaces the practice marker so recruiter-facing queries can exclude it.
  -- COALESCE to false so pre-existing rows without the metadata are treated as real interviews,
  -- which preserves current behaviour for historical data.
  COALESCE((s.interview_metadata -> 'practice' ->> 'is_practice')::boolean, false) AS is_practice,
  -- NEW: the mode this session was configured to be evaluated in, as captured at session
  -- creation. Falls back to the job post snapshot for sessions created before createSession
  -- began writing the top-level key. NULL when neither is present.
  NULLIF(
    UPPER(
      TRIM(BOTH '"' FROM COALESCE(
        s.interview_metadata ->> 'evaluationMode',
        s.interview_metadata -> 'job_settings_snapshot' ->> 'evaluationMode',
        ''
      ))
    ),
    ''
  ) AS evaluation_mode
FROM candidates c
JOIN interview_sessions s ON c.id = s.candidate_id
LEFT JOIN job_posts j ON s.job_post_id = j.id
LEFT JOIN evaluation_reports e ON s.id = e.session_id;
