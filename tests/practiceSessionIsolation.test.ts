import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PHASE 2 regression guard: candidate practice runs must not appear in recruiter-facing feeds.
 *
 * Practice sessions are written to the same `interview_sessions` table as real interviews
 * (src/Practice/hooks/usePracticeSession.ts), marked only by a nested JSONB field
 * `interview_metadata -> practice -> is_practice`.
 *
 * Before this fix, `getAllSessions()` — which powers AdminDashboard.tsx:259 and
 * HRDashboard.tsx:60 — applied no such filter, and `vw_candidate_master` did not even expose the
 * flag. Every student practice run therefore appeared in the recruiter candidate table, the CSV
 * export and the analytics averages as a genuine submission.
 *
 * These are static-source assertions rather than runtime tests because `getAllSessions` requires
 * a live Supabase connection. They pin the two properties that actually regressed, and would fail
 * if someone reinstated the unfiltered mapping.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('Phase 2: practice sessions are isolated from recruiter feeds', () => {
  const service = read('src/Core/database/supabaseService.ts');

  it('getAllSessions filters out rows flagged is_practice', () => {
    expect(service).toContain('realInterviewRecords');

    // Assert the BEHAVIOUR, not the formatting. This originally pinned the exact one-line arrow
    // `masterRecords.filter((r: any) => r.is_practice !== true)`, which broke when the filter was
    // legitimately extended (commit 60da4e1) to also suppress duplicate abandoned session rows.
    // The protection was intact; only the shape had changed. A regression guard that fails on a
    // valid refactor trains people to ignore it, so it now checks that the filter derives
    // realInterviewRecords from masterRecords and excludes practice rows — however it is written.
    const start = service.indexOf('const realInterviewRecords = masterRecords.filter(');
    expect(start, 'realInterviewRecords must be derived from masterRecords').toBeGreaterThan(-1);
    const filterBody = service.slice(start, service.indexOf('const sessionIds', start));
    expect(filterBody).toMatch(/is_practice/);
    // A practice row must be dropped, not merely detected.
    expect(filterBody).toMatch(/is_practice\s*===\s*true\s*\)\s*return false|is_practice\s*!==\s*true/);
  });

  it('both the primary and the degraded return paths use the filtered list', () => {
    // If either path maps over the unfiltered masterRecords, practice runs leak through.
    const getAllStart = service.indexOf('static async getAllSessions');
    const getAllEnd = service.indexOf('static async', getAllStart + 30);
    const body = service.slice(getAllStart, getAllEnd > -1 ? getAllEnd : undefined);

    expect(body).toContain('realInterviewRecords.map(');
    // masterRecords may still be referenced for the fetch and the emptiness check, but must not
    // be the source of any returned collection.
    expect(body).not.toMatch(/return masterRecords\.map\(/);
    expect(body).not.toMatch(/const result\s*=\s*masterRecords\.map\(/);
  });

  it('the candidate history feed is deliberately NOT filtered', () => {
    // Students must still see their own practice results.
    const studentStart = service.indexOf('static async getStudentSessions');
    expect(studentStart).toBeGreaterThan(-1);
    const studentEnd = service.indexOf('static async', studentStart + 30);
    const body = service.slice(studentStart, studentEnd > -1 ? studentEnd : undefined);
    expect(body).not.toContain('is_practice');
  });

  it('the view migration exposes is_practice so the filter has something to read', () => {
    const migration = read('supabase/migrations/20260729000001_expose_is_practice_in_candidate_master.sql');
    expect(migration).toContain('CREATE OR REPLACE VIEW vw_candidate_master');
    expect(migration).toMatch(/interview_metadata\s*->\s*'practice'\s*->>\s*'is_practice'/);
    expect(migration).toContain('AS is_practice');
    // COALESCE keeps historical rows (no metadata) classified as real interviews.
    expect(migration).toContain('COALESCE(');
  });

  it('practice sessions still carry the flag when created', () => {
    const hook = read('src/Practice/hooks/usePracticeSession.ts');
    expect(hook).toContain('is_practice: true');
  });
});
