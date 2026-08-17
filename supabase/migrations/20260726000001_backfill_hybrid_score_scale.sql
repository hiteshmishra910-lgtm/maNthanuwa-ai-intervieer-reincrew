-- ============================================================================
-- CR-3 BACKFILL: correct HYBRID reports stored on the 0-10 scale.
--
-- CONTEXT
--   The evaluate-hybrid-job Edge Function averaged per-question `accuracy` (0-10) and
--   stored it directly as the aggregate score, which every reader treats as 0-100.
--   Result: HYBRID candidates capped at 10/100 and computeRecommendation returned
--   "Reject" for all of them (verified: 9/9 hybrid sessions in production, including one
--   averaging a perfect 10/10).
--
-- DISCRIMINATOR (why this is safe to run exactly once)
--   The fixed builder always emits `overallScores.difficultyWeightedPerformance`.
--   The buggy version never did. So "reportType = final_ai AND that key is absent"
--   identifies precisely the affected rows, and the statement becomes a no-op on a
--   second run because the backfill adds the key.
--
-- REVIEW BEFORE RUNNING. Run the SELECT in step 0 first and confirm the row count and
-- score range match expectations. Take a backup/snapshot before step 1.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 0 — DRY RUN. Inspect what would change. Safe, read-only.
-- ---------------------------------------------------------------------------
-- SELECT r.session_id,
--        r.total_score                          AS old_total_score,
--        LEAST(100, ROUND(r.total_score * 10))  AS new_total_score,
--        r.hiring_recommendation                AS old_recommendation,
--        s.overall_score                        AS old_session_score
--   FROM evaluation_reports r
--   LEFT JOIN interview_sessions s ON s.id = r.session_id
--  WHERE r.evaluation_logic->>'reportType' = 'final_ai'
--    AND r.evaluation_logic->'overallScores'->'difficultyWeightedPerformance' IS NULL
--  ORDER BY r.evaluated_at DESC;

-- ---------------------------------------------------------------------------
-- STEP 1 — Apply. Wrapped in a transaction so it is all-or-nothing.
-- ---------------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE _cr3_affected ON COMMIT DROP AS
SELECT r.session_id,
       LEAST(100, GREATEST(0, ROUND(COALESCE(r.total_score, 0) * 10)))::numeric AS corrected_score
  FROM evaluation_reports r
 WHERE r.evaluation_logic->>'reportType' = 'final_ai'
   AND r.evaluation_logic->'overallScores'->'difficultyWeightedPerformance' IS NULL;

-- 1a. evaluation_reports: aggregate score, recommendation, and the embedded report JSON.
--     Recommendation thresholds mirror shared/scoringPolicy.ts exactly.
UPDATE evaluation_reports r
   SET total_score = a.corrected_score,
       technical_score = a.corrected_score,
       hiring_recommendation = CASE
           WHEN a.corrected_score >= 80 THEN 'Strong Hire'
           WHEN a.corrected_score >= 65 THEN 'Hire'
           WHEN a.corrected_score >= 50 THEN 'Consider'
           ELSE 'Reject'
       END,
       evaluation_logic = jsonb_set(
           jsonb_set(
               jsonb_set(
                   jsonb_set(
                       r.evaluation_logic::jsonb,
                       '{executiveSummary,technicalScore}', to_jsonb(a.corrected_score), true),
                   '{overallScores,knowledgeScore}', to_jsonb(a.corrected_score), true),
               '{overallScores,trustAdjustedScore}', to_jsonb(a.corrected_score), true),
           '{overallScores,difficultyWeightedPerformance}', to_jsonb(a.corrected_score), true)
  FROM _cr3_affected a
 WHERE r.session_id = a.session_id;

-- 1b. interview_sessions.overall_score — read by the admin table, candidate dashboard,
--     CSV export and the analytics average.
UPDATE interview_sessions s
   SET overall_score = a.corrected_score
  FROM _cr3_affected a
 WHERE s.id = a.session_id;

-- NOTE: session_responses.content_score is deliberately NOT touched. Per-question scores
-- are 0-10 on every code path (local and hybrid alike) and were always correct; the
-- Pass/Borderline/Fail verdict thresholds of 7/4 depend on that scale.

COMMIT;

-- ---------------------------------------------------------------------------
-- STEP 2 — Verify. Expect zero rows.
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) AS still_unscaled
--   FROM evaluation_reports
--  WHERE evaluation_logic->>'reportType' = 'final_ai'
--    AND evaluation_logic->'overallScores'->'difficultyWeightedPerformance' IS NULL;
