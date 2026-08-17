-- Interview Assignments: connects HR admin portal with student portal
-- HR assigns interviews to candidates by email; students see them on their dashboard.

CREATE TABLE IF NOT EXISTS interview_assignments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_post_id     UUID REFERENCES job_posts(id) ON DELETE CASCADE NOT NULL,
  candidate_email TEXT NOT NULL,
  candidate_id    UUID REFERENCES candidates(id) ON DELETE SET NULL,
  assigned_by     TEXT NOT NULL,
  status          TEXT CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','EXPIRED','EXHAUSTED')) DEFAULT 'NOT_STARTED' NOT NULL,
  deadline        TIMESTAMPTZ,
  max_attempts    INTEGER DEFAULT 1 NOT NULL,
  attempts_used   INTEGER DEFAULT 0 NOT NULL,
  session_id      UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_email ON interview_assignments(candidate_email);
CREATE INDEX IF NOT EXISTS idx_assignments_job_post ON interview_assignments(job_post_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON interview_assignments(status);

-- RLS: admins can do everything, students can read their own assignments
ALTER TABLE interview_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on assignments"
  ON interview_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Students read own assignments"
  ON interview_assignments FOR SELECT
  USING (
    candidate_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "Students insert own assignments (self-register)"
  ON interview_assignments FOR INSERT
  WITH CHECK (
    candidate_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "Students update own assignments"
  ON interview_assignments FOR UPDATE
  USING (
    candidate_email = (auth.jwt() ->> 'email')
  );

-- View: assignment tracking for admin dashboard
CREATE OR REPLACE VIEW vw_assignment_tracking AS
SELECT
  a.id,
  a.candidate_email,
  c.name AS candidate_name,
  a.job_post_id,
  jp.title AS job_title,
  a.assigned_by,
  a.status,
  a.deadline,
  a.max_attempts,
  a.attempts_used,
  a.session_id,
  a.notes,
  a.created_at,
  a.updated_at,
  es.overall_score,
  es.started_at AS session_started_at,
  es.completed_at AS session_completed_at
FROM interview_assignments a
LEFT JOIN candidates c ON c.id = a.candidate_id
LEFT JOIN job_posts jp ON jp.id = a.job_post_id
LEFT JOIN interview_sessions es ON es.id = a.session_id;

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_assignment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assignment_updated_at ON interview_assignments;
CREATE TRIGGER trg_assignment_updated_at
  BEFORE UPDATE ON interview_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_updated_at();
