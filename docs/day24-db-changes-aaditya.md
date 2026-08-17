# Day 24 — Database Changes
**Author:** Aaditya  
**Date:** 2026-07-27  
**Branch:** `fix/db-cleanup-assignment-access-key`

---

## Task 1: Consolidate Assignment Tables

### Problem
Two tables served the same purpose — `interview_assignments` (older, linked to job posts) and `candidate_assignments` (newer, linked to drives). Some code paths read from one, others from the other, creating split data and confusion.

### What was done
1. **Added `updated_at` to `candidate_assignments`** — The old table had an auto-updating timestamp, the new one didn't. Added the column + trigger for consistency.  
   *Migration: `20260727_add_updated_at_to_candidate_assignments.sql`*

2. **Recreated `vw_assignment_tracking`** — The admin dashboard view now queries `candidate_assignments` (joined with `interview_drives` for the job title) instead of `interview_assignments`.  
   *Migration: `20260727_consolidate_assignment_tables.sql`*

3. **Dropped `interview_assignments`** — Removed the old table, its trigger, and its auto-update function. Uses `IF EXISTS` guards throughout.  
   *Migration: `20260727_consolidate_assignment_tables.sql`*

4. **Updated all code references** — `supabaseService.ts` (4 functions: `getAssignmentById`, `getAssignmentsByEmail`, `getAllAssignments`, `deleteAssignment`), `App.tsx`, `LandingScreen.tsx`, `AdminDashboard.tsx`, `deadlineService.ts`, and `types.ts` all updated to use `candidate_assignments` with the new status values (`INVITED`, `VERIFIED`, `IN_PROGRESS`, `COMPLETED`, `ABSENT`).

### Affected files
- `types.ts` — `AssignmentStatus` type, `InterviewAssignment` interface
- `src/Core/database/supabaseService.ts` — 4 query functions rewritten
- `src/Core/utils/deadlineService.ts` — status checks reordered
- `App.tsx` — reads `drive_id` instead of `job_post_id`
- `src/Interview/components/LandingScreen.tsx` — role lookup via drives
- `src/Admin/components/AdminDashboard.tsx` — status filters & badges

---

## Task 2: Remove `access_key` Column from `job_posts`

### Problem
The `job_posts.access_key` column was an old system for access control, superseded by the `drive_access_keys` table. It was already revoked from public reads but the column still existed in the schema.

### What was done
1. **Dropped the column** — `ALTER TABLE job_posts DROP COLUMN IF EXISTS access_key`.  
   *Migration: `20260727_remove_job_posts_access_key.sql`*

2. **Updated code references** — Removed `accessKey` from `JobPost` interface and all places that read/wrote it (`storageService.ts`, `supabaseService.ts` seed data). The `LandingScreen.tsx` now validates access keys against `drive_access_keys` instead.

### Affected files
- `types.ts` — removed `accessKey` from `JobPost`
- `src/Core/database/jobSeedRepository.ts` — added explicit `accessKey` to `JobTemplate`
- `src/Core/database/supabaseService.ts` — removed from seed insert
- `src/Core/storage/storageService.ts` — removed from 3 mappings
- `src/Interview/components/LandingScreen.tsx` — validation now uses `verifyAccessKey()`

---

## Migration Order (run in SQL Editor)

```sql
-- 1. Add updated_at to candidate_assignments
-- 2. Consolidate tables (drop old, recreate view)
-- 3. Remove access_key column from job_posts
```

## Rollback Notes

- To restore `interview_assignments`: rerun `20260720_interview_assignments.up.sql`
- To restore `access_key` column: `ALTER TABLE job_posts ADD COLUMN access_key TEXT;`
- `candidate_assignments` was never dropped — no data loss risk
