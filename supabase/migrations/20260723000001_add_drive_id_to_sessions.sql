-- ============================================================================
-- REICREW AI — CAMPUS INTERVIEW DRIVE SESSION LINK MIGRATION
-- Migration: 20260723_add_drive_id_to_sessions
-- ============================================================================
-- Links interview_sessions directly to interview_drives (drive_id).
-- Allows batch campus drive interview sessions to link to their parent drive.
-- ============================================================================

ALTER TABLE interview_sessions 
ADD COLUMN IF NOT EXISTS drive_id UUID REFERENCES interview_drives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_drive_id ON interview_sessions(drive_id);
