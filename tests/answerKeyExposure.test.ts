import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { APTITUDE_QUESTION_BANK } from '../src/Interview/services/questionBank';

/**
 * CR-5 regression guard: the aptitude answer key must never reach the browser.
 *
 * The 80 aptitude questions previously shipped inside the client bundle complete with
 * `answer` ("B") and `explanation`, and grading compared against that same client-side data.
 * Any candidate could read the key from DevTools, or simply edit the computed score.
 *
 * The key now lives only in supabase/functions/_shared/aptitudeAnswerKey.ts, consumed by the
 * `score-aptitude` Edge Function.
 */

const ROOT = path.resolve(__dirname, '..');
const KEY_FILE = 'supabase/functions/_shared/aptitudeAnswerKey.ts';

describe('CR-5: aptitude answer key is not client-reachable', () => {
  it('ships a non-empty aptitude bank', () => {
    expect(Array.isArray(APTITUDE_QUESTION_BANK)).toBe(true);
    expect(APTITUDE_QUESTION_BANK.length).toBeGreaterThan(0);
  });

  it('exposes no `answer` or `explanation` field on any aptitude question', () => {
    const leaking = APTITUDE_QUESTION_BANK.filter(
      (q: any) => q.answer !== undefined || q.explanation !== undefined,
    );
    expect(
      leaking.map((q: any) => q.id),
      'these aptitude questions still carry the answer key in client code',
    ).toEqual([]);
  });

  it('still ships what the candidate legitimately needs to take the test', () => {
    for (const q of APTITUDE_QUESTION_BANK as any[]) {
      expect(q.id, 'question id').toBeTruthy();
      expect(q.question, `question text for ${q.id}`).toBeTruthy();
      expect(Array.isArray(q.options), `options for ${q.id}`).toBe(true);
      expect(q.options.length, `options for ${q.id}`).toBeGreaterThan(1);
    }
  });

  it('keeps the answer key file outside src/ so bundlers cannot reach it', () => {
    const keyPath = path.join(ROOT, KEY_FILE);
    expect(fs.existsSync(keyPath), `${KEY_FILE} should exist`).toBe(true);
    expect(KEY_FILE.startsWith('supabase/functions/')).toBe(true);
  });

  it('has an answer-key entry for every shipped aptitude question', () => {
    const keySrc = fs.readFileSync(path.join(ROOT, KEY_FILE), 'utf8');
    const missing = (APTITUDE_QUESTION_BANK as any[])
      .map(q => q.id)
      .filter(id => !keySrc.includes(`"${id}"`));
    expect(missing, 'aptitude questions with no server-side answer').toEqual([]);
  });

  it('is never imported from application source', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        if (fs.readFileSync(p, 'utf8').includes('aptitudeAnswerKey')) {
          offenders.push(path.relative(ROOT, p).replace(/\\/g, '/'));
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders, 'src/ must never import the answer key').toEqual([]);
  });
});
