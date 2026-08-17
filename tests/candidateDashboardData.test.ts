import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PHASE 15 regression guard: the candidate dashboard must show real data, not placeholders.
 *
 * Two components were rendered live on the candidate dashboard while querying nothing:
 *
 *   AssignedInterviews.tsx  — declared `() =>`, ignoring its candidateId prop entirely, and
 *     always rendered "Interviews assigned to you by HR or recruiters will appear here". Its
 *     comment claimed it was waiting for the assignment schema — but `candidate_assignments`
 *     had existed since migration 20260722, so a recruiter could assign an interview, it would
 *     persist, and the candidate would be shown an empty state. The recruiter-to-candidate
 *     handoff was silently broken at its final step.
 *
 *   UpcomingInterviews.tsx — same pattern, telling students the feature "will be connected once
 *     the scheduling system is defined". Its own comment already identified usable data:
 *     sessions in CREATED status, of which production holds 74 of 122.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/**
 * Strip comments before asserting on removed text. Each fix documents the exact placeholder copy
 * it replaced, so a naive substring check matches the comment describing the bug rather than the
 * bug itself.
 */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const ASSIGNED = 'src/candidate/components/AssignedInterviews.tsx';
const UPCOMING = 'src/candidate/components/UpcomingInterviews.tsx';

describe('Phase 15: candidate dashboard panels query real data', () => {
  it.each([[ASSIGNED], [UPCOMING]])('%s no longer discards its candidateId prop', (file) => {
    const src = code(file);
    // The placeholder signature threw the prop away.
    expect(src).not.toMatch(/React\.FC<\w+Props>\s*=\s*\(\)\s*=>/);
    expect(src).toContain('({ candidateId })');
    // And the prop must actually reach a query.
    expect(src).toContain('candidateId');
    expect(src).toContain('SupabaseService.');
  });

  it.each([[ASSIGNED], [UPCOMING]])('%s no longer carries a placeholder marker', (file) => {
    const src = code(file);
    expect(src).not.toContain('PLACEHOLDER');
    expect(src).not.toContain('PARTIAL DATA');
    expect(src).not.toMatch(/will be connected once/i);
    expect(src).not.toMatch(/schema not yet finalized/i);
  });

  it.each([[ASSIGNED], [UPCOMING]])('%s handles loading, error and empty states', (file) => {
    const src = read(file);
    expect(src).toContain('setLoading');
    expect(src).toContain('setError');
    // An empty result must read as "nothing here", never as a failure.
    expect(src).toMatch(/length === 0/);
  });

  it.each([[ASSIGNED], [UPCOMING]])('%s guards against setState after unmount', (file) => {
    const src = read(file);
    // Both fetch on mount; without this a fast unmount warns and can leak.
    expect(src).toContain('cancelled');
    expect(src).toMatch(/return \(\) => \{ cancelled = true; \};/);
  });

  it('AssignedInterviews reads the canonical table, not the missing one', () => {
    const service = read('src/Core/database/supabaseService.ts');
    const method = service.slice(service.indexOf('static async getAssignmentsForCandidate'));
    const body = method.slice(0, method.indexOf('static async', 40));
    expect(body).toContain("from('candidate_assignments')");
    // interview_assignments does not exist in production; reading it here would 404.
    expect(body).not.toContain('interview_assignments');
    expect(body).toContain("eq('candidate_id'");
  });

  it('a failed assignment query degrades to empty rather than taking down the dashboard', () => {
    const service = read('src/Core/database/supabaseService.ts');
    const method = service.slice(service.indexOf('static async getAssignmentsForCandidate'));
    const body = method.slice(0, method.indexOf('static async', 40));
    // Returning [] keeps one broken panel from blanking the whole page.
    expect(body).toMatch(/if \(error\)[\s\S]{0,220}return \[\]/);
  });

  it('UpcomingInterviews shows unfinished sessions, which is what the data supports', () => {
    const src = code(UPCOMING);
    expect(src).toContain('getStudentSessions');
    expect(src).toContain("'CREATED'");
    expect(src).toContain("'IN_PROGRESS'");
    // No scheduled_at column exists, so it must not promise a calendar.
    expect(src).not.toMatch(/scheduledDate|reminderEnabled/);
  });
});
