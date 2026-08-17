import { describe, it, expect } from 'vitest';
import { localEvaluate } from '../src/Core/api/apiService';
import type { Question } from '../types';

/**
 * H-10 regression guard.
 *
 * `localEvaluate` was dead code: imported by aiService.ts but never called, and its
 * `evaluationAvailable` flag never read. API mode therefore had no fallback when the LLM was
 * unavailable, and the stub returned `score: 0` — so wiring it up naively would have scored
 * every candidate zero during an outage.
 *
 * These tests pin the two properties that matter: it produces a real score from the question's
 * own checklist, and it reports honestly when it could not evaluate.
 */

const q = (evaluationGuide: string[]): Question =>
  ({
    id: 'q1',
    question: 'Explain TCP versus UDP.',
    type: 'Technical',
    difficulty: 'medium',
    evaluationGuide,
    role: 'CSE',
    interviewCategory: 'Technical_Core',
    isActive: true,
    version: 1,
  }) as unknown as Question;

const GUIDE = ['connection oriented reliable delivery', 'connectionless datagram transport'];

describe('H-10: local fallback evaluation', () => {
  it('scores an empty answer 0 but marks it as a real evaluation', () => {
    const r = localEvaluate('', q(GUIDE));
    expect(r.score).toBe(0);
    expect(r.evaluationAvailable).toBe(true); // "genuinely scored zero", not "unscored"
    expect(r.missed).toEqual(GUIDE);
  });

  it('rewards an answer covering the checklist', () => {
    const good = localEvaluate(
      'TCP is connection oriented and guarantees reliable delivery, while UDP is a connectionless datagram transport.',
      q(GUIDE),
    );
    expect(good.score).toBeGreaterThan(0);
    expect(good.matched.length).toBeGreaterThan(0);
    expect(good.evaluationAvailable).toBe(true);
  });

  it('scores an off-topic answer below a covering answer', () => {
    const good = localEvaluate(
      'TCP is connection oriented with reliable delivery; UDP is connectionless datagram transport.',
      q(GUIDE),
    );
    const bad = localEvaluate('I enjoy cooking pasta on weekends.', q(GUIDE));
    expect(bad.score).toBeLessThan(good.score);
  });

  it('never returns a score outside 0-10', () => {
    for (const answer of ['', 'x', 'connection oriented '.repeat(500), '<script>', '{}']) {
      const r = localEvaluate(answer, q(GUIDE));
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(10);
      expect(Number.isFinite(r.score)).toBe(true);
    }
  });

  it('reports evaluationAvailable=false when the question has no criteria, instead of a silent 0', () => {
    const r = localEvaluate('a real answer', q([]));
    expect(r.evaluationAvailable).toBe(false);
    expect(r.reason).toMatch(/no evaluation criteria/i);
  });

  it('flags its own output as provisional so reviewers do not treat it as a full evaluation', () => {
    const r = localEvaluate('connection oriented reliable delivery', q(GUIDE));
    expect(r.confidence).toBeLessThan(100);
    expect(r.reason).toMatch(/provisional/i);
  });

  it('never throws on hostile input', () => {
    for (const answer of [null, undefined, 123, {}] as unknown[]) {
      expect(() => localEvaluate(answer as string, q(GUIDE))).not.toThrow();
    }
  });
});
