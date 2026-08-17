# Access-Key Flow Edge Case Audit — Day 34 (7 Aug 2026)

**Auditor:** Aaditya (backend)
**Scope:** Expired link + revoked drive edge cases in the candidate access-key flow
**Status:** Audit only — no code changes. Findings below.

---

## Flow Under Review

```
Candidate visits /join?key=XXX
  → verifyAccessKey() checks key validity + drive status
  → validateAssignment() checks candidate assignment
  → Identity verification (email, college ID, ID proof)
  → Interview session created
```

**Key files:**
- `src/Core/database/supabaseService.ts` — `verifyAccessKey()` (line 1939), `validateAssignment()` (line 2146)
- `src/candidate/join/JoinDriveScreen.tsx` — candidate-facing join flow
- `src/Interview/components/LandingScreen.tsx` — authenticated candidate access
- `src/HR/components/CsvImport/CreateDriveForm.tsx` — drive + key creation
- `src/types/driveTypes.ts` — type definitions
- `src/Core/database/driveRepository.ts` — `getDriveByAccessKey()`, `createDrive()`

---

## What Works Correctly ✅

| Scenario | Handling | Where |
|---|---|---|
| Key not found in DB | Returns `null`, candidate sees "Invalid access key" | `verifyAccessKey()` L1952 |
| Key deactivated (`is_active=false`) | Rejected at query level (`WHERE is_active = true`) | `verifyAccessKey()` L1948 |
| Usage limit exceeded (`current_uses >= max_uses`) | Rejected with early return | `verifyAccessKey()` L1958 |
| Drive status is COMPLETED / ARCHIVED / DRAFT | Rejected via status check | `verifyAccessKey()` L2008 |
| Drive is SCHEDULED but hasn't started yet | Rejected (time window check) | `verifyAccessKey()` L2000 |
| Drive is SCHEDULED but window expired | Rejected | `verifyAccessKey()` L2004 |
| Assignment deadline expired | Marked ABSENT, rejected | `validateAssignment()` L2186 |
| Max attempts exhausted | Rejected | `validateAssignment()` L2190 |

---

## Gaps Found — Expired Link

### E1 — No time-based expiry on access keys 🔴 HIGH

**Current state:** The `drive_access_keys` table has no `expires_at` column. Once a key is created with `is_active=true`, it works indefinitely as long as the linked drive remains ACTIVE.

**Impact:** If HR shares a link and later wants it to stop working (e.g., application deadline passed), there's no way to expire just the link. The only option is to COMPLETED the entire drive — which affects ALL candidates, not just the leaked link.

**Recommendation:** Add `expires_at` column to `drive_access_keys` in a future migration. Not blocking for pilot (HR can COMPLETED the drive).

### E2 — Shareable URL is transient, not stored 🟡 LOW

**Current state:** The link `/join?key=XXX` is constructed in-memory in `HRDashboard.tsx` (line 297) as `window.location.origin + '/join?key=' + key`. It is not stored in the database.

**Impact:** Not a functional bug — the key itself is validated against the DB on every access. But if someone bookmarks or shares the URL, there's no URL-level expiry mechanism. The key validation is the real gate.

**Recommendation:** Acceptable. The key IS the gate, not the URL.

---

## Gaps Found — Revoked Drive

### R1 — No HR UI to revoke a specific access key 🔴 HIGH

**Current state:** The `is_active` boolean column exists on `drive_access_keys` (type definition at `driveTypes.ts:93`), but there is no toggle or button in the HR dashboard to set it to `false`. The column is created and queried but never written to after initial creation.

**Impact:** If HR wants to invalidate a specific key mid-drive (e.g., link leaked to unintended recipients), they cannot. They'd have to COMPLETED the entire drive, which stops ALL candidates — not just the one with the leaked link.

**Recommendation:** Add a "Revoke Key" button in the HR dashboard that sets `is_active=false` on the key row. ~1 hour implementation.

### R2 — Drive status change is all-or-nothing 🟡 MEDIUM

**Current state:** `DriveLifecycleStatus` is `DRAFT | SCHEDULED | ACTIVE | COMPLETED | ARCHIVED`. Changing a drive from ACTIVE → COMPLETED deactivates ALL keys for that drive and stops ALL candidates from joining.

**Impact:** There's no way to partially revoke access. If one key is compromised, all candidates for that drive are affected.

**Recommendation:** Acceptable for pilot. Per-key revocation (R1 fix) addresses the most common scenario.

### R3 — No CANCELLED status in lifecycle 🟢 LOW

**Current state:** `DriveLifecycleStatus` (`driveTypes.ts:5`) has no CANCELLED value. If HR wants to abort a drive mid-way, they'd use COMPLETED — which looks like a successful completion in reports and dashboards.

**Impact:** Cosmetic/misleading. A cancelled drive shouldn't show completion metrics. But this is a dashboard reporting concern, not a functional bug.

**Recommendation:** Add `CANCELLED` to the enum in a future cleanup. Not blocking.

---

## Security Findings

### S1 — RLS allows anonymous SELECT on drive_access_keys 🔴 HIGH

**Current state:** Migration `20260722000001_interview_drive_schema.sql` (line 314) creates:
```sql
CREATE POLICY "drive_access_keys_public_policy" ON drive_access_keys
  FOR ALL USING (true) WITH CHECK (true);
```
And migration `20260726000002_harden_rls_security.sql` (line 24) grants:
```sql
GRANT SELECT ON public.drive_access_keys TO anon, authenticated;
```

**Impact:** Any anonymous client (without login) can query `supabase.from('drive_access_keys').select('*')` and retrieve all access keys. This enables key enumeration.

**Recommendation:** Apply the RLS hardening migration already written on `fix/pre-launch-security-gate` branch (`20260808000001_pre_launch_rls_hardening.sql`). This replaces the permissive policy with role-scoped ones.

### S2 — No rate limiting on key verification 🟡 MEDIUM

**Current state:** `verifyAccessKey()` is a plain Supabase query from the client. There's no rate limiting, CAPTCHA, or attempt tracking. A 6-8 character alphanumeric key has ~2 billion combinations — brute-forceable with automated requests.

**Impact:** Low risk in practice (keys are distributed via HR to known candidates), but a theoretical concern if the join URL is publicly accessible.

**Recommendation:** Add a client-side debounce (500ms between attempts) and track failed attempts in localStorage. If >5 failures in 5 min, show a cooldown message. Not critical for pilot with known HRs.

### S3 — Auto-enrollment bypasses assignment restrictions 🟢 LOW

**Current state:** `validateAssignment()` (supabaseService.ts L2166-2184) auto-creates an assignment if none exists for the candidate's email + drive. This means any candidate with a valid key can join, even if HR didn't pre-assign them.

**Impact:** Intentional for walk-in campus drives, but HR may not realize the key grants open enrollment rather than controlled access.

**Recommendation:** Document this behavior clearly in the HR dashboard when creating drives.

### S4 — No concurrent session guard 🟢 LOW

**Current state:** `handleStartInterview()` creates a new `interview_sessions` row without checking whether the candidate already has an `IN_PROGRESS` session for the same drive. A candidate could open multiple tabs and start multiple sessions.

**Impact:** Could produce duplicate evaluations and inflate candidate metrics.

**Recommendation:** Add a check in session creation: if an IN_PROGRESS session exists for this candidate+drive, resume it instead of creating a new one.

---

## Recommendations Summary

### Fix Before Pilot (recommended)
| # | Issue | Effort | Why |
|---|---|---|---|
| R1 | Add "Revoke Key" toggle in HR dashboard | ~1 hour | HR needs to invalidate leaked links |
| S1 | Apply RLS hardening migration | Already written | Blocks anonymous key enumeration |

### Acceptable for Pilot (fix post-pilot)
| # | Issue | Why deferrable |
|---|---|---|
| E1 | Add `expires_at` to access keys | HR can COMPLETED the drive as workaround |
| R2 | Per-key revocation beyond is_active | R1 fix covers the main case |
| R3 | Add CANCELLED lifecycle status | Cosmetic, not functional |
| S2 | Rate limiting on key attempts | Low risk with known pilot HRs |
| S3 | Document auto-enrollment behavior | Informational |
| S4 | Concurrent session guard | Edge case, low frequency |

---

*Generated: 7 Aug 2026 | Branch: fix/hybrid-stuck-processing-and-score-alignment*
