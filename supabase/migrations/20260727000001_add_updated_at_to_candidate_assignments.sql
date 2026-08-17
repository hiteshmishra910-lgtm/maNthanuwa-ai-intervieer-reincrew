-- Add updated_at column to candidate_assignments for consistency
-- The old interview_assignments table had an auto-updating updated_at column.
-- This migration adds it to candidate_assignments before dropping the old table.

ALTER TABLE candidate_assignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

CREATE OR REPLACE FUNCTION update_candidate_assignment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidate_assignment_updated_at ON candidate_assignments;
CREATE TRIGGER trg_candidate_assignment_updated_at
  BEFORE UPDATE ON candidate_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_candidate_assignment_updated_at();
