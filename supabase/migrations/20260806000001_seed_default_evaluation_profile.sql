-- Migration: 20260806000001_seed_default_evaluation_profile.sql
-- Seeds a deterministic default evaluation profile and version row
-- to guarantee that fallback and default evaluation audit log entries
-- satisfy the NOT NULL foreign key constraint on evaluation_audit_log(profile_version_id).

INSERT INTO public.evaluation_profiles (id, name, description, current_version)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Default Global Evaluation Profile',
  'System fallback evaluation profile used when no custom profile is assigned.',
  1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.evaluation_profile_versions (id, profile_id, version_number, weights, required_dimensions)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  1,
  '{"accuracyWeight": 30, "understandingWeight": 35, "reasoningWeight": 20, "communicationWeight": 10, "confidenceWeight": 5}'::jsonb,
  ARRAY['definition', 'mechanism', 'useCase']
) ON CONFLICT (id) DO NOTHING;
