-- Migration: 20260805_create_proctoring_media_bucket.sql
-- 1. Create proctoring-media storage bucket for proctoring snapshots & clips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proctoring-media',
  'proctoring-media',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'video/webm', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies for proctoring-media
DROP POLICY IF EXISTS "Allow uploads to proctoring-media" ON storage.objects;
CREATE POLICY "Allow uploads to proctoring-media"
ON storage.objects FOR INSERT
TO public, anon, authenticated
WITH CHECK (bucket_id = 'proctoring-media');

DROP POLICY IF EXISTS "Allow reads from proctoring-media" ON storage.objects;
CREATE POLICY "Allow reads from proctoring-media"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'proctoring-media');

-- 3. Fix evaluation_audit_log and ai_provider_logs RLS policies for client inserts
GRANT SELECT, INSERT ON public.evaluation_audit_log TO anon, authenticated;
GRANT SELECT, INSERT ON public.ai_provider_logs TO anon, authenticated;

DROP POLICY IF EXISTS "evaluation_audit_log_insert_policy" ON public.evaluation_audit_log;
CREATE POLICY "evaluation_audit_log_insert_policy"
ON public.evaluation_audit_log FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "ai_provider_logs_insert_policy" ON public.ai_provider_logs;
CREATE POLICY "ai_provider_logs_insert_policy"
ON public.ai_provider_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);
