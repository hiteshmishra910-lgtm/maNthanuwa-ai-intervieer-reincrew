-- Add company_name to candidate_assignments for candidate visibility

ALTER TABLE candidate_assignments
ADD COLUMN IF NOT EXISTS company_name TEXT;
