-- Migration: Add RPC to increment completed candidates for a drive
CREATE OR REPLACE FUNCTION increment_completed_candidates(drive_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE interview_drives
  SET completed_candidates = completed_candidates + 1
  WHERE id = drive_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
