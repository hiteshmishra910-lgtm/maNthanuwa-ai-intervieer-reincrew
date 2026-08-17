# Rollback Plan — Database Schema Changes

> **Last updated:** 2026-07-29  
> **Author:** Aaditya  
> **Applies to:** Supabase (PostgreSQL) schema migrations in `supabase/migrations/`

---

## 1. Core Principle

**Every migration must have a corresponding rollback plan.** Some migrations have `.down.sql` files (e.g., `20260720_admin_users.down.sql`), but most do not — the rollback steps are documented here instead. This document serves as the single source of truth for reversing any schema change safely.

---

## 2. Before Every Migration

### 2.1 Backup the Database

```sql
-- Option A: Via Supabase Dashboard
-- Project → Database → Backup → Create backup

-- Option B: Via pg_dump (requires connection string)
pg_dump --no-owner --no-acl --schema-only -f pre_migration_schema.sql "$SUPABASE_DB_URL"

-- Option C: Backup specific tables that will change
CREATE TABLE backup_candidate_assignments AS SELECT * FROM candidate_assignments;
CREATE TABLE backup_interview_drives AS SELECT * FROM interview_drives;
-- (adjust table names to match your migration target)
```

### 2.2 Create the Rollback Script First

**Write the rollback SQL before applying the migration.** This forces you to think about reversal upfront and catches destructive logic early.

**File naming convention:**
- Migration: `YYYYMMDD_description.up.sql`
- Rollback: `YYYYMMDD_description.down.sql`

### 2.3 Dry-Run

Test the migration + rollback on a local or staging database:
1. Apply the `.up.sql`
2. Verify the change works (new columns, tables, RPCs, etc.)
3. Run the `.down.sql` (or manual rollback steps)
4. Confirm original state is restored
5. Verify no data loss

---

## 3. Creating a Rollback Script

### Template

```sql
-- Rollback: YYYYMMDD_description.up.sql
-- Reverts: <short description of what the migration did>

BEGIN;

-- 1. Reverse RPC functions (DROP … CASCADE or CREATE OR REPLACE with old body)
-- 2. Drop new columns (ALTER TABLE … DROP COLUMN IF EXISTS)
-- 3. Drop new tables (DROP TABLE IF EXISTS … CASCADE)
-- 4. Drop new indexes (DROP INDEX IF EXISTS)
-- 5. Restore dropped views (CREATE OR REPLACE VIEW … AS …)
-- 6. Restore dropped functions (CREATE OR REPLACE FUNCTION …)

COMMIT;
```

### Rollback Categories

| Change Type | Rollback Command | Data Risk |
|---|---|---|
| **New table** | `DROP TABLE IF EXISTS … CASCADE` | Low — data lost if not backed up first |
| **New column (nullable)** | `ALTER TABLE … DROP COLUMN IF EXISTS …` | Medium — column data lost |
| **New column (NOT NULL)** | Must first `ALTER … DROP DEFAULT`, then `ALTER … ALTER COLUMN … DROP NOT NULL`, then drop | High — back up first |
| **DROP column** | `ALTER TABLE … ADD COLUMN …` (type must match) | Low — column already gone |
| **New index** | `DROP INDEX IF EXISTS …` | None — index rebuilt from data |
| **DROP table** | `CREATE TABLE … (…)` + re-insert from backup | Very High — requires backup |
| **New RPC function** | `DROP FUNCTION IF EXISTS …` | None |
| **ALTER function body** | `CREATE OR REPLACE FUNCTION …` with old body | None — old code is invisible in backup |
| **New view** | `DROP VIEW IF EXISTS … CASCADE` | None |
| **ALTER view definition** | `CREATE OR REPLACE VIEW … AS …` with old query | None |
| **RLS policy change** | `CREATE POLICY … AS …` with old definition | None |
| **New constraint (unique, FK)** | `ALTER TABLE �� DROP CONSTRAINT IF EXISTS …` | None |

---

## 4. Migration Execution Procedure

### Standard Workflow

```
┌──────────────────┐
│  1. Backup DB    │ ← Always step 1
├──────────────────┤
│  2. Notify team  │ ← "Applying migration X — 5 min expected"
├──────────────────��
│  3. Apply .up.sql │ ← In Supabase SQL Editor
├──────────────────┤
│  4. Verify       │ ← Run queries to confirm changes
├──────────────────┤
│  5. Test app     │ ← Smoke-test affected features
���──────────────────┤
│  6. Update docs  │ ← day24-db-changes-aaditya.md + this file
└──────────────────┘
```

### What to Verify After Applying

```sql
-- New table exists?
SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'your_table');

-- New column exists?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'your_table' AND column_name = 'your_column';

-- New index exists?
SELECT indexname FROM pg_indexes WHERE tablename = 'your_table' AND indexname = 'idx_your_index';

-- New RPC exists?
SELECT proname FROM pg_proc WHERE proname = 'your_function';

-- Rows are intact?
SELECT COUNT(*) FROM your_table;

-- Application query works?
SELECT * FROM your_view LIMIT 5;
```

---

## 5. Rollback Procedure

### When to Roll Back

| Signal | Action |
|--------|--------|
| Application error rate spikes above baseline | Immediate rollback |
| Data integrity violation detected | Immediate rollback |
| Migration times out (>30 seconds) | Investigate first — some DDL takes locks |
| Feature broken and fix would take >1 hour | Rollback + fix later |
| User-reported regression confirmed | Rollback if no quick fix |

### Step-by-Step Rollback

```sql
-- STEP 1: Stop writes (optional — read-only mode)
-- Revoke insert/update from application roles
REVOKE INSERT, UPDATE ON affected_table FROM anon, authenticated;

-- STEP 2: Run rollback
-- Option A: Execute the .down.sql file (if it exists)
-- Option B: Execute manual rollback commands from section 7 below

-- STEP 3: Verify rollback
-- Confirm tables, columns, functions are in expected state

-- STEP 4: Restore data if needed (only lost columns/tables)
INSERT INTO restored_table SELECT * FROM backup_restored_table;

-- STEP 5: Re-grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- STEP 6: Notify team
-- "Rollback of migration X complete. DB returned to previous state."
```

---

## 6. Migration Inventory & Rollback Status

### Current State (2026-07-29)

| Migration | Has `.down.sql`? | Rollback Risk | Notes |
|---|---|---|---|
| `20260718_add_evaluation_jobs` | ❌ | Low | Table created — `DROP IF EXISTS` |
| `20260718_add_evaluation_profiles` | ❌ | Medium | 3 tables + functions — back up first |
| `20260718_update_provider_logs` | ❌ | Low | Column additions only |
| `20260720_admin_users.up` | ✅ | Low | Table creation |
| `20260720_fix_candidates_rls` | ❌ | None | RLS policy change only |
| `20260720_hybrid_metadata.up` | ✅ | Low | Column additions only |
| `20260720_interview_assignments.up` | ✅ | N/A (table dropped) | Already consolidated |
| `20260722_interview_drive_schema` | ❌ | **High** | 5 tables + seed data + views |
| `20260723_add_drive_id_to_sessions` | ❌ | Medium | FK column — depends on drives |
| `20260724_add_company_name_to_assignments` | ❌ | Low | Column addition — `DROP IF EXISTS` |
| `20260724_add_increment_completed_candidates_rpc` | ❌ | None | RPC addition — `DROP IF EXISTS` |
| `20260724_add_unique_constraint_session_responses` | ❌ | Low | Constraint addition — `DROP IF EXISTS` |
| `20260726_backfill_hybrid_score_scale` | ❌ | **High** | Data-modifying UPDATE — requires backup |
| `20260726_harden_rls_security` | ❌ | **High** | Many RLS policies dropped and recreated |
| `20260727_add_updated_at_to_candidate_assignments` | ❌ | Low | Column + trigger — reversible |
| `20260727_consolidate_assignment_tables` | ❌ | **High** | DROPPED `interview_assignments` + function |
| `20260727_remove_job_posts_access_key` | ❌ | Low | `DROP COLUMN` — add back with original type |
| `20260727_update_evaluation_jobs_status_check` | ❌ | Low | Constraint change |
| `20260728_rls_drop_residual_policies` | ❌ | **High** | Scoped RLS for 5 tables — complex reversal |
| `20260729_expose_is_practice_in_candidate_master` | ❌ | Low | View definition change — reversible |
| `20260730_fix_system_settings_rls` | ❌ | **High** | Created `is_admin()` function + 4 policy sets |

### 🔴 High-Risk Migrations Detailed Notes

#### `20260722_interview_drive_schema`
> 5 tables, views, RLS, seed data
- Rollback: `DROP TABLE IF EXISTS drive_access_keys, candidate_assignments, interview_drives, question_banks, interview_templates CASCADE;`
- ⚠️ Data loss: All drive data, assignments, templates, question banks
- **Mandatory backup**: `pg_dump --data-only -t interview_drives -t candidate_assignments ...`

#### `20260726_backfill_hybrid_score_scale`
> UPDATE scores SET score = score * 10
- Not idempotent — running twice would multiply by 100
- Rollback requires knowing which rows were already fixed
- **Mitigation**: Record `updated_at` of backfill run; restore from backup only

#### `20260728_rls_drop_residual_policies`
> Dynamic policy enumeration — no list of previous policy names exists
- Rollback: Not possible to recreate every dropped policy by name
- **Last resort**: Restore entire security posture from pre-migration backup

### Migrations Created Today (2026-07-29)

| Migration | Has `.down.sql`? | Rollback Notes |
|---|---|---|
| `20260728_optimize_assignment_queries` | ❌ | 5 indexes (`DROP INDEX`) + 2 RPCs (`DROP FUNCTION`) — RPC signatures must match code in `supabaseService.ts`; rollback DB alone without reverting code breaks `incrementAttempt()` and `incrementAccessKeyUsage()` |

### Rollback Plan Gaps Identified (2026-07-29)

| Gap | Impact |
|---|---|
| **Code-DB sync not documented** — rolling back the DB migration without reverting `supabaseService.ts` causes `rpc()` calls to 404 | App features break silently |
| **No edge function compatibility check** — if a future migration changes a table or function that deployed edge functions call, rolling back the DB breaks the edge functions | Edge functions error out |

---

## 7. Quick-Reference: Common Rollback Commands

### Index Rollback
```sql
DROP INDEX IF EXISTS idx_ca_college_email_assigned_at;
DROP INDEX IF EXISTS idx_ca_candidate_id_deadline;
DROP INDEX IF EXISTS idx_ca_drive_id_status;
DROP INDEX IF EXISTS idx_ca_assigned_at;
DROP INDEX IF EXISTS idx_dak_access_key_is_active;
```

### RPC Function Rollback
```sql
DROP FUNCTION IF EXISTS increment_assignment_attempt(UUID, TEXT);
DROP FUNCTION IF EXISTS increment_access_key_usage(UUID);
```

### Column Rollback
```sql
ALTER TABLE candidate_assignments DROP COLUMN IF EXISTS company_name;
ALTER TABLE job_posts ADD COLUMN access_key TEXT;
```

### Table Rollback
```sql
DROP TABLE IF EXISTS evaluation_jobs CASCADE;
DROP TABLE IF EXISTS interview_templates CASCADE;
```

### View Rollback
```sql
CREATE OR REPLACE VIEW vw_assignment_tracking AS
-- restore the old view definition here (see migration file for original)
```

### Constraint Rollback
```sql
ALTER TABLE session_responses DROP CONSTRAINT IF EXISTS unique_session_question;
```

---

## 8. Data Recovery Scenarios

### Scenario A: Data lost because column was dropped
```sql
-- Restore from backup table (created before migration)
INSERT INTO original_table (column1, column2, dropped_column)
SELECT column1, column2, dropped_column FROM backup_table;
```

### Scenario B: Data corrupted (wrong value in UPDATE)
```sql
-- Roll back to known-good values from backup
UPDATE affected_table
SET score = backup.score
FROM backup_table
WHERE affected_table.id = backup.id;
```

### Scenario C: Table accidentally truncated
```sql
-- Restore entire table from backup
TRUNCATE affected_table;
INSERT INTO affected_table SELECT * FROM backup_table;
```

---

## 9. Safety Checklist (for every migration)

- [ ] Rollback SQL written before applying
- [ ] Database backed up (schema + data)
- [ ] Dry-run completed on staging (or local)
- [ ] Uncommitted application code changes match the migration
- [ ] Deployment plan shared with team (avoid concurrent migrations)
- [ ] Rollback procedure shared with team
- [ ] Time window communicated (low-traffic period preferred)

---

> **In case of critical failure**: Apply rollback immediately, notify team, then investigate. Speed of recovery matters more than root cause analysis in the moment.
