-- ============================================================================
-- STORAGE BUCKETS - Run this in Supabase SQL Editor
-- Creates the 2 required storage buckets for the platform
-- ============================================================================

-- Create buckets (skip if already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('proctoring-snapshots', 'proctoring-snapshots', true),
  ('proctoring-clips', 'proctoring-clips', true)
ON CONFLICT (id) DO NOTHING;

-- Permissive storage policy for development (anon + authenticated can upload/read/delete)
DROP POLICY IF EXISTS "Allow all operations for anon and authenticated" ON storage.objects;
CREATE POLICY "Allow all operations for anon and authenticated"
ON storage.objects FOR ALL
USING (bucket_id IN ('proctoring-snapshots', 'proctoring-clips'))
WITH CHECK (bucket_id IN ('proctoring-snapshots', 'proctoring-clips'));

-- Verify
SELECT id, name, public FROM storage.buckets
WHERE id IN ('proctoring-snapshots', 'proctoring-clips');
