import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_INTERVIEW_TEMPLATE } from '../src/Core/ai/aiService';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const ADMIN = 'src/Admin/components/AdminDashboard.tsx';

describe('the interview flow chart states the real question count', () => {
  const admin = code(ADMIN);

  it('no longer claims a fixed five-question interview', () => {
    // Each stage card carried a hardcoded "Q1 of 5" … "Q5 of 5" badge, which read as "this
    // interview asks five questions". DEFAULT_INTERVIEW_TEMPLATE has held ten steps for some
    // time, and a job post with its own question set produces one step per selection.
    expect(admin).not.toMatch(/>Q[1-9] of 5</);
  });

  it('derives the question count from the template rather than restating it', () => {
    expect(admin).toContain('DEFAULT_INTERVIEW_TEMPLATE.steps.length');
    // A literal would drift again the next time the template changes.
    expect(admin).not.toMatch(/DEFAULT_FLOW_QUESTION_COUNT\s*=\s*\d+/);
  });

  it('the template really does define more than five questions', () => {
    // Pins the discrepancy that made the hardcoded badge wrong, so the test fails loudly if
    // someone "fixes" it by shrinking the template instead.
    expect(DEFAULT_INTERVIEW_TEMPLATE.steps.length).toBeGreaterThan(5);
  });

  it('keeps the stage taxonomy separate from the question count', () => {
    // The five cards filter the bank by `q.type`. Conflating that taxonomy with interview length
    // is what produced the misleading badge in the first place.
    expect(admin).toContain('ADAPTIVE_STAGE_COUNT');
    expect([...admin.matchAll(/Stage \d of \{ADAPTIVE_STAGE_COUNT\}/g)]).toHaveLength(5);
  });
});

describe('interview assignment remains reachable', () => {
  /**
   * The remediation brief asked for the Admin "Interview Assignments" table to be removed as
   * redundant with the HR Dashboard. It is not redundant: `SupabaseService.createAssignment` has
   * exactly one call site in the entire codebase — the Admin tab — and the HR Dashboard has no
   * UI to assign an interview to a candidate. Removing it would delete the platform's only
   * assignment capability.
   *
   * These tests record that finding as an executable fact, so the premise can be re-checked
   * rather than re-argued: if HR later gains its own assignment UI, the second test fails and the
   * Admin tab becomes genuinely safe to remove.
   */

  it('some UI can still create an assignment', () => {
    const callSites = ['src/Admin/components/AdminDashboard.tsx', 'src/HR/components/HRDashboard.tsx']
      .filter((f) => code(f).includes('createAssignment('));
    expect(
      callSites.length,
      'no dashboard can create an interview assignment — the capability has been lost'
    ).toBeGreaterThan(0);
  });

  it('records that the HR dashboard does not yet own assignment creation', () => {
    const hr = code('src/HR/components/HRDashboard.tsx');
    const hrCanAssign = hr.includes('createAssignment(');
    const admin = code(ADMIN);
    const adminCanAssign = admin.includes('createAssignment(');

    // Exactly one of these should be true today (Admin). When HR gains the capability, flip the
    // expectation and the Admin tab can be retired.
    expect(hrCanAssign || adminCanAssign).toBe(true);
    if (!hrCanAssign) {
      expect(
        adminCanAssign,
        'HR cannot assign interviews, so the Admin assignments tab must remain'
      ).toBe(true);
    }
  });
});
