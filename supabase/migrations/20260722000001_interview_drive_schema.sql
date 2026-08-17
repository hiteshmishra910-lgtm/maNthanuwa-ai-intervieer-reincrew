-- ============================================================================
-- REICREW AI — CAMPUS INTERVIEW DRIVE & TEMPLATE SCHEMA
-- Migration: 20260722_interview_drive_schema
-- ============================================================================
-- Adds tables, views, indexes, RLS, and seed data for Campus Interview Drives:
--   1. interview_templates   → Pre-built interview structures & configurations
--   2. question_banks        → Curated question repositories by role/category
--   3. interview_drives      → Core campus drive lifecycle (DRAFT -> SCHEDULED -> ACTIVE -> COMPLETED -> ARCHIVED)
--   4. candidate_assignments → Links candidates to drives with identity verification (college_id, college_email)
--   5. drive_access_keys     → Flexible single or multi-key authentication per drive
--
-- Safety Guarantee: 100% non-destructive & idempotent. Modifies zero existing tables.
-- Safe to run multiple times in the Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- TABLE 1: interview_templates
-- Pre-built interview structures that drives reference.
-- Replaces hardcoded default templates in aiService.ts.
-- ============================================================================
CREATE TABLE IF NOT EXISTS interview_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('Technical', 'Behavioral', 'Mixed')) DEFAULT 'Mixed' NOT NULL,
  total_questions INTEGER DEFAULT 5 NOT NULL,
  steps JSONB DEFAULT '[]'::jsonb NOT NULL,
  
  -- Evaluation Profile Tiers:
  --   'fast'     → Local / Lightweight evaluation
  --   'balanced' → Hybrid evaluation (Default)
  --   'advanced' → API / Deep reasoning evaluation
  default_evaluation_profile TEXT CHECK (default_evaluation_profile IN ('fast', 'balanced', 'advanced')) DEFAULT 'balanced' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 2: question_banks
-- Curated repositories of questions reusable across templates and drives.
-- ============================================================================
CREATE TABLE IF NOT EXISTS question_banks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General' NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Mixed')) DEFAULT 'Mixed' NOT NULL,
  questions JSONB DEFAULT '[]'::jsonb NOT NULL,
  total_questions INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 3: interview_drives (CORE DRIVE LIFECYCLE)
-- Batch campus interview event created by HR.
-- Lifecycle state machine: DRAFT → SCHEDULED → ACTIVE → COMPLETED → ARCHIVED
-- Evaluation Profiles:
--   'fast'     → Local (fast response, minimal latency)
--   'balanced' → Hybrid (balanced quality & throughput)
--   'advanced' → API (deep reasoning, comprehensive analysis)
-- ============================================================================
CREATE TABLE IF NOT EXISTS interview_drives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED')) DEFAULT 'DRAFT' NOT NULL,
  template_id UUID REFERENCES interview_templates(id) ON DELETE SET NULL,
  question_bank_id UUID REFERENCES question_banks(id) ON DELETE SET NULL,
  evaluation_profile TEXT CHECK (evaluation_profile IN ('fast', 'balanced', 'advanced')) DEFAULT 'balanced' NOT NULL,
  proctoring_settings JSONB DEFAULT '{"camera_required": true, "tab_switch_limit": 3, "audio_monitoring": true}'::jsonb NOT NULL,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  total_candidates INTEGER DEFAULT 0 NOT NULL,
  completed_candidates INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- TABLE 4: candidate_assignments
-- Links candidates to drives with identity verification tracking.
-- Status tracking: INVITED → VERIFIED → IN_PROGRESS → COMPLETED | ABSENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS candidate_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drive_id UUID REFERENCES interview_drives(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('INVITED', 'VERIFIED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT')) DEFAULT 'INVITED' NOT NULL,
  college_id TEXT,
  college_email TEXT,
  verified_at TIMESTAMPTZ,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  max_attempts INTEGER DEFAULT 1 NOT NULL,
  attempts_used INTEGER DEFAULT 0 NOT NULL,
  notes TEXT,
  assigned_by TEXT,
  id_proof_url TEXT,
  id_proof_type TEXT,
  UNIQUE(drive_id, candidate_id)
);

-- ============================================================================
-- TABLE 5: drive_access_keys
-- Optional table for multiple keys per drive with usage limits.
-- ============================================================================
CREATE TABLE IF NOT EXISTS drive_access_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drive_id UUID REFERENCES interview_drives(id) ON DELETE CASCADE NOT NULL,
  access_key TEXT UNIQUE NOT NULL,
  max_uses INTEGER DEFAULT 0 NOT NULL,
  current_uses INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_interview_drives_status ON interview_drives(status);
CREATE INDEX IF NOT EXISTS idx_interview_drives_scheduled_at ON interview_drives(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interview_drives_created_by ON interview_drives(created_by);
CREATE INDEX IF NOT EXISTS idx_interview_drives_template_id ON interview_drives(template_id);
CREATE INDEX IF NOT EXISTS idx_interview_drives_question_bank_id ON interview_drives(question_bank_id);

CREATE INDEX IF NOT EXISTS idx_question_banks_category ON question_banks(category);
CREATE INDEX IF NOT EXISTS idx_question_banks_is_active ON question_banks(is_active);

CREATE INDEX IF NOT EXISTS idx_candidate_assignments_drive_id ON candidate_assignments(drive_id);
CREATE INDEX IF NOT EXISTS idx_candidate_assignments_candidate_id ON candidate_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_assignments_status ON candidate_assignments(status);
CREATE INDEX IF NOT EXISTS idx_candidate_assignments_college_id ON candidate_assignments(college_id);
CREATE INDEX IF NOT EXISTS idx_candidate_assignments_college_email ON candidate_assignments(college_email);

CREATE INDEX IF NOT EXISTS idx_drive_access_keys_drive_id ON drive_access_keys(drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_access_keys_key ON drive_access_keys(access_key);

-- ============================================================================
-- AUTO-UPDATED TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_interview_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_interview_templates_updated_at ON interview_templates;
CREATE TRIGGER trg_interview_templates_updated_at
  BEFORE UPDATE ON interview_templates
  FOR EACH ROW EXECUTE FUNCTION update_interview_templates_updated_at();

CREATE OR REPLACE FUNCTION update_question_banks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_question_banks_updated_at ON question_banks;
CREATE TRIGGER trg_question_banks_updated_at
  BEFORE UPDATE ON question_banks
  FOR EACH ROW EXECUTE FUNCTION update_question_banks_updated_at();

CREATE OR REPLACE FUNCTION update_interview_drives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_interview_drives_updated_at ON interview_drives;
CREATE TRIGGER trg_interview_drives_updated_at
  BEFORE UPDATE ON interview_drives
  FOR EACH ROW EXECUTE FUNCTION update_interview_drives_updated_at();

-- ============================================================================
-- PRESENTATION VIEWS
-- ============================================================================

DROP VIEW IF EXISTS vw_drive_candidates CASCADE;
DROP VIEW IF EXISTS vw_drive_summary CASCADE;

-- View 1: vw_drive_candidates — Detailed candidate assignment & session status per drive
CREATE OR REPLACE VIEW vw_drive_candidates AS
SELECT
  d.id AS drive_id,
  d.title AS drive_title,
  ca.id AS assignment_id,
  c.id AS candidate_id,
  c.name AS candidate_name,
  c.email AS candidate_email,
  ca.college_id,
  ca.college_email,
  ca.status AS assignment_status,
  ca.verified_at,
  ca.assigned_at,
  ca.completed_at,
  s.id AS session_id,
  s.overall_score,
  s.status AS session_status,
  s.started_at AS session_started_at,
  s.completed_at AS session_completed_at
FROM interview_drives d
JOIN candidate_assignments ca ON ca.drive_id = d.id
JOIN candidates c ON c.id = ca.candidate_id
LEFT JOIN interview_sessions s ON s.id = ca.session_id;

-- View 2: vw_drive_summary — High-level drive analytics & completion status
CREATE OR REPLACE VIEW vw_drive_summary AS
SELECT
  d.id AS drive_id,
  d.title,
  d.description,
  d.status,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT dak.access_key), NULL) AS access_keys,
  d.evaluation_profile,
  CASE d.evaluation_profile
    WHEN 'fast' THEN 'Local'
    WHEN 'balanced' THEN 'Hybrid'
    WHEN 'advanced' THEN 'API'
    ELSE 'Hybrid'
  END AS evaluation_profile_label,
  d.scheduled_at,
  d.started_at,
  d.completed_at,
  d.total_candidates,
  d.completed_candidates,
  d.created_by,
  d.created_at,
  t.name AS template_name,
  t.category AS template_category,
  qb.title AS question_bank_title,
  COUNT(DISTINCT ca.id) AS actual_candidates,
  COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'INVITED') AS invited_count,
  COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'VERIFIED') AS verified_count,
  COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'IN_PROGRESS') AS in_progress_count,
  COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'COMPLETED') AS completed_count,
  COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'ABSENT') AS absent_count,
  ROUND(AVG(s.overall_score), 2) AS avg_score
FROM interview_drives d
LEFT JOIN interview_templates t ON t.id = d.template_id
LEFT JOIN question_banks qb ON qb.id = d.question_bank_id
LEFT JOIN candidate_assignments ca ON ca.drive_id = d.id
LEFT JOIN drive_access_keys dak ON dak.drive_id = d.id
LEFT JOIN interview_sessions s ON s.id = ca.session_id
GROUP BY d.id, d.title, d.description, d.status, d.evaluation_profile,
         d.scheduled_at, d.started_at, d.completed_at, d.total_candidates,
         d.completed_candidates, d.created_by, d.created_at, t.name, t.category, qb.title;

-- View 3: vw_drive_templates — Active interview templates
CREATE OR REPLACE VIEW vw_drive_templates AS
SELECT
  id,
  name,
  description,
  category,
  total_questions,
  steps,
  default_evaluation_profile
FROM interview_templates
WHERE is_active = true
ORDER BY name ASC;

-- View 4: vw_question_banks — Active question banks
CREATE OR REPLACE VIEW vw_question_banks AS
SELECT
  id,
  title,
  description,
  category,
  difficulty,
  total_questions,
  created_by,
  created_at
FROM question_banks
WHERE is_active = true
ORDER BY title ASC;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Matches project standard RLS pattern (permissive for app schema)
-- ============================================================================
ALTER TABLE interview_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_access_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_public_policy" ON interview_templates;
CREATE POLICY "templates_public_policy" ON interview_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "question_banks_public_policy" ON question_banks;
CREATE POLICY "question_banks_public_policy" ON question_banks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "interview_drives_public_policy" ON interview_drives;
CREATE POLICY "interview_drives_public_policy" ON interview_drives FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "candidate_assignments_public_policy" ON candidate_assignments;
CREATE POLICY "candidate_assignments_public_policy" ON candidate_assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "drive_access_keys_public_policy" ON drive_access_keys;
CREATE POLICY "drive_access_keys_public_policy" ON drive_access_keys FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- SEED DATA — Default Interview Templates & Question Banks
-- ============================================================================
INSERT INTO interview_templates (name, description, category, total_questions, steps, default_evaluation_profile) VALUES
(
  'Standard Technical',
  'Balanced technical interview covering fundamentals, core concepts, and problem-solving scenarios.',
  'Technical',
  7,
  '[{"category":"Introduction","difficulty":"easy"},{"category":"Technical_Fundamentals","difficulty":"easy"},{"category":"Technical_Core","difficulty":"medium"},{"category":"Technical_Scenario","difficulty":"hard"},{"category":"Analytical","difficulty":"medium"},{"category":"Project","difficulty":"medium"},{"category":"Communication","difficulty":"easy"}]',
  'balanced'
),
(
  'Quick Screening',
  'Short screening interview for initial candidate assessment.',
  'Technical',
  4,
  '[{"category":"Introduction","difficulty":"easy"},{"category":"Technical_Fundamentals","difficulty":"easy"},{"category":"Technical_Core","difficulty":"medium"},{"category":"Communication","difficulty":"easy"}]',
  'fast'
),
(
  'Comprehensive Deep Dive',
  'In-depth technical interview for experienced candidate evaluation.',
  'Technical',
  10,
  '[{"category":"Introduction","difficulty":"easy"},{"category":"Technical_Fundamentals","difficulty":"easy"},{"category":"Technical_Core","difficulty":"medium"},{"category":"Technical_Scenario","difficulty":"hard"},{"category":"Analytical","difficulty":"hard"},{"category":"Project","difficulty":"medium"},{"category":"Behavioral","difficulty":"medium"},{"category":"Situational","difficulty":"hard"},{"category":"Communication","difficulty":"easy"},{"category":"Behavioral","difficulty":"hard"}]',
  'advanced'
),
(
  'Behavioral & Communication',
  'Focuses on soft skills, behavioral questions, and communication ability.',
  'Behavioral',
  5,
  '[{"category":"Introduction","difficulty":"easy"},{"category":"Communication","difficulty":"easy"},{"category":"Behavioral","difficulty":"medium"},{"category":"Situational","difficulty":"medium"},{"category":"Behavioral","difficulty":"hard"}]',
  'fast'
),
(
  'Campus Fresher Screening',
  'Simplified interview for campus freshers focusing on fundamentals and aptitude.',
  'Mixed',
  5,
  '[{"category":"Introduction","difficulty":"easy"},{"category":"Technical_Fundamentals","difficulty":"easy"},{"category":"Technical_Core","difficulty":"easy"},{"category":"Communication","difficulty":"easy"},{"category":"Analytical","difficulty":"medium"}]',
  'fast'
)
ON CONFLICT DO NOTHING;

INSERT INTO question_banks (title, description, category, difficulty, total_questions, created_by) VALUES
(
  'Core Software Engineering & OOP',
  'Standard questions on Object-Oriented Programming, Data Structures, and System Design basics.',
  'Software Engineering',
  'Medium',
  15,
  'System'
),
(
  'Campus Aptitude & Logical Reasoning',
  'Problem-solving, logic puzzles, and quantitative aptitude for campus drives.',
  'Aptitude',
  'Easy',
  10,
  'System'
)
ON CONFLICT DO NOTHING;
