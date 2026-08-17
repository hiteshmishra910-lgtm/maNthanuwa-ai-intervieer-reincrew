CREATE TABLE IF NOT EXISTS evaluation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup of queued jobs
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_status ON evaluation_jobs (status);
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_session_id ON evaluation_jobs (session_id);

-- Enable RLS and set permissive policies
ALTER TABLE evaluation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evaluation_jobs_public" ON evaluation_jobs FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.evaluation_jobs TO anon, authenticated;
