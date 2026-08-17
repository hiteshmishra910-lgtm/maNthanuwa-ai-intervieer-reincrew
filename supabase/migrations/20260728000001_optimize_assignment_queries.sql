-- ============================================================================
-- OPTIMIZE ASSIGNMENT-RELATED DATABASE QUERIES
-- Migration: 20260728_optimize_assignment_queries.sql
--
-- PURPOSE
--   The assignment queries power the admin dashboard, candidate dashboard, join
--   flow, and CSV import. Most use single-column indexes that cannot satisfy
--   both the WHERE filter and the ORDER BY clause in one index scan, forcing
--   PostgreSQL to sort in memory (or seq-scan then sort).
--
--   Several counter-column updates (attempts_used, access_key.current_uses) use
--   a client-side read-modify-write pattern that races under concurrent load.
--
-- WHAT THIS ADDS
--   1. Composite indexes tuned to each hot-path query's filter + sort pattern.
--   2. Atomic RPC functions that replace the read-modify-write race windows.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 — COMPOSITE INDEXES
-- ============================================================================

-- 1a. getAssignmentsByEmail(): WHERE college_email = ? ORDER BY assigned_at DESC
--     Single-column idx_ca_college_email hits the filter but not the sort.
CREATE INDEX IF NOT EXISTS idx_ca_college_email_assigned_at
  ON candidate_assignments (college_email, assigned_at DESC);

-- 1b. getAssignmentsForCandidate(): WHERE candidate_id = ? ORDER BY deadline ASC
--     Also supports deadline-filtered count queries per drive.
CREATE INDEX IF NOT EXISTS idx_ca_candidate_id_deadline
  ON candidate_assignments (candidate_id, deadline);

-- 1c. assignCandidatesToDrive() counter:  SELECT count(*) … WHERE drive_id = ?
--     vw_drive_summary / vw_drive_candidates filter by drive_id then status.
CREATE INDEX IF NOT EXISTS idx_ca_drive_id_status
  ON candidate_assignments (drive_id, status);

-- 1d. getAllAssignments() / vw_assignment_tracking: ORDER BY created_at DESC
--     The original table had no index on assigned_at/created_at at all.
CREATE INDEX IF NOT EXISTS idx_ca_assigned_at
  ON candidate_assignments (assigned_at DESC);

-- 1e. verifyAccessKey(): WHERE access_key = ? AND is_active = true
--     The existing idx_drive_access_keys_key only covers access_key alone.
CREATE INDEX IF NOT EXISTS idx_dak_access_key_is_active
  ON drive_access_keys (access_key, is_active);

-- ============================================================================
-- PART 2 — ATOMIC RPC FUNCTIONS (eliminate read-modify-write races)
-- ============================================================================

-- 2a. Increment assignment attempts atomically.
--     Replaces SupabaseService.incrementAttempt():
--       SELECT … client reads attempts_used → client computes +1 → UPDATE
--     with:
--       UPDATE … SET attempts_used = attempts_used + 1 … RETURNING *
CREATE OR REPLACE FUNCTION increment_assignment_attempt(
  p_assignment_id UUID,
  p_new_status    TEXT DEFAULT 'IN_PROGRESS'
)
RETURNS TABLE (
  id            UUID,
  attempts_used INTEGER,
  status        TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE candidate_assignments
  SET
    attempts_used = candidate_assignments.attempts_used + 1,
    status        = COALESCE(p_new_status, candidate_assignments.status),
    updated_at    = now()
  WHERE candidate_assignments.id = p_assignment_id
  RETURNING candidate_assignments.id, candidate_assignments.attempts_used, candidate_assignments.status;
END;
$$;

-- 2b. Increment access key usage atomically.
--     Replaces SupabaseService.incrementAccessKeyUsage():
--       SELECT current_uses → client computes +1 → UPDATE
--     with:
--       UPDATE … SET current_uses = current_uses + 1 … WHERE …
CREATE OR REPLACE FUNCTION increment_access_key_usage(
  p_key_id UUID
)
RETURNS TABLE (
  id           UUID,
  current_uses INTEGER,
  max_uses     INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE drive_access_keys
  SET current_uses = drive_access_keys.current_uses + 1
  WHERE drive_access_keys.id = p_key_id
    AND (drive_access_keys.max_uses = 0 OR drive_access_keys.current_uses < drive_access_keys.max_uses)
  RETURNING drive_access_keys.id, drive_access_keys.current_uses, drive_access_keys.max_uses;
END;
$$;

-- Grant execution so the application (anon/authenticated roles) can call these.
GRANT EXECUTE ON FUNCTION increment_assignment_attempt(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_access_key_usage(UUID) TO anon, authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
--
-- 1. Confirm indexes exist:
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename IN ('candidate_assignments','drive_access_keys')
--      AND indexname LIKE 'idx_ca_%' OR indexname LIKE 'idx_dak_%'
--    ORDER BY indexname;
--
-- 2. Confirm RPCs exist:
--   SELECT proname, prosrc FROM pg_proc
--    WHERE proname IN ('increment_assignment_attempt','increment_access_key_usage');
--
-- 3. Verify atomic increment works:
--   SELECT * FROM increment_assignment_attempt('<existing-uuid>');
--   SELECT * FROM increment_access_key_usage('<existing-uuid>');
-- ============================================================================
