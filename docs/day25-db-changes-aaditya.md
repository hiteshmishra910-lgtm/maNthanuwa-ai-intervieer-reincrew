# Day 25 — Database & Backend Changes
**Author:** Aaditya  
**Date:** 2026-07-28  
**Branch:** `feat/db-optimization-duplicate-rollback`

---

## Task 1: Optimize Assignment-Related Database Queries

### Problem
Assignment queries powered the admin dashboard, candidate dashboard, join flow, and CSV import, but used single-column indexes that could not satisfy both the WHERE filter and ORDER BY clause in one scan. PostgreSQL had to sort matching rows in memory after filtering.

Two counter-update functions (`incrementAttempt`, `incrementAccessKeyUsage`) used a client-side read-modify-write pattern: SELECT → compute +1 → UPDATE. Under concurrent load, two clients could read the same value and each write back the same incremented value, losing one update.

### What was done
1. **Added 5 composite indexes tuned to each hot-path query:**
   - `idx_ca_college_email_assigned_at` on `(college_email, assigned_at DESC)` — powers `getAssignmentsByEmail()`
   - `idx_ca_candidate_id_deadline` on `(candidate_id, deadline)` — powers `getAssignmentsForCandidate()`
   - `idx_ca_drive_id_status` on `(drive_id, status)` — powers `count(*)` in batch assign + drive views
   - `idx_ca_assigned_at` on `(assigned_at DESC)` — powers `getAllAssignments()` and tracking view
   - `idx_dak_access_key_is_active` on `(access_key, is_active)` — powers `verifyAccessKey()`

2. **Created 2 atomic RPC functions** that replace the race condition:
   - `increment_assignment_attempt(UUID, TEXT)` — `UPDATE SET attempts_used = attempts_used + 1 ... RETURNING *`
   - `increment_access_key_usage(UUID)` — `UPDATE SET current_uses = current_uses + 1 ... WHERE max_uses = 0 OR current_uses < max_uses`

3. **Updated code in `supabaseService.ts`**:
   - `incrementAttempt()` — now calls `rpc('increment_assignment_attempt')` instead of SELECT→UPDATE
   - `incrementAccessKeyUsage()` — now calls `rpc('increment_access_key_usage')` instead of SELECT→UPDATE

### Affected files
- `supabase/migrations/20260728_optimize_assignment_queries.sql` — New migration
- `src/Core/database/supabaseService.ts` — 2 functions rewritten

---

## Task 2: Add Validation to Prevent Duplicate Assignment Records

### Problem
`createAssignment()` had no duplicate check before insert. If a user tried to assign the same candidate to the same drive twice, the application would throw a raw PostgreSQL constraint violation (`duplicate key value violates unique constraint`), which was confusing and supplied no context.

### What was done
1. **Added `findAssignmentByCandidateAndDrive()` helper** — checks if a candidate already has an assignment for a given drive before inserting.
2. **Updated `createAssignment()`** — now calls the helper before insert and throws a friendly error: *"This candidate is already assigned to this drive (status: INVITED)."*
3. **No changes to `csvImportService.ts`** — it already had duplicate checks.
4. **No changes to `DriveRepository.assignCandidatesToDrive()`** — uses `upsert` which silently handles duplicates.

### Affected files
- `src/Core/database/supabaseService.ts` — new helper + duplicate check in `createAssignment()`

---

## Task 3: Prepare Rollback Plan for Future Database Schema Changes

### Problem
No standardized rollback procedure existed. Most migrations (21 of 24) lacked `.down.sql` files. The deployment guide did not cover migration rollback, and there was no central document listing migration risks or rollback commands.

### What was done
1. **Created `docs/rollback-plan.md`** — comprehensive rollback plan covering:
   - Pre-migration checklist (backup, dry-run, rollback-first)
   - Rollback script template and file naming convention
   - Migration execution procedure (step-by-step)
   - When to roll back (decision criteria)
   - Full migration inventory with rollback risk ratings (Low / Medium / High)
   - Detailed notes for high-risk migrations (data-modifying UPDATEs, table drops, dynamic policy changes)
   - Quick-reference rollback commands for indexes, RPCs, columns, tables, views, and constraints
   - Data recovery scenarios (dropped column, corrupted values, truncated table)
   - Safety checklist for every future migration
   - Emergency contact information

2. **Created `docs/day25-db-changes-aaditya.md`** — documents today's changes with rollback notes.

### Affected files
- `docs/rollback-plan.md` — New document
- `docs/day25-db-changes-aaditya.md` — New document

---

## Migration Order (run in SQL Editor)

```sql
-- Only one migration for today:
-- supabase/migrations/20260728_optimize_assignment_queries.sql
```

## Rollback Notes

### For today's migration (`20260728_optimize_assignment_queries`)
- **Indexes**: `DROP INDEX IF EXISTS idx_ca_college_email_assigned_at`, etc. (5 total)
- **RPCs**: `DROP FUNCTION IF EXISTS increment_assignment_attempt(UUID, TEXT)` and `DROP FUNCTION IF EXISTS increment_access_key_usage(UUID)`
- Code in `supabaseService.ts`: Revert `incrementAttempt()` and `incrementAccessKeyUsage()` to the old SELECT→UPDATE pattern
- Full commands in `docs/rollback-plan.md` §7
