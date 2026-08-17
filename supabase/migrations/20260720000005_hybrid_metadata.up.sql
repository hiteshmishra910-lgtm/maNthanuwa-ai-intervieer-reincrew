-- Migration: 20260720_hybrid_metadata
-- Adds metadata storage for hybrid mode evaluations, ensuring debugging capabilities

ALTER TABLE public.interview_sessions 
ADD COLUMN IF NOT EXISTS evaluation_metadata JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ DEFAULT NULL;

-- Log the creation
DO $$ 
BEGIN
  RAISE NOTICE 'Added evaluation_metadata and finished_at to interview_sessions';
END $$;
