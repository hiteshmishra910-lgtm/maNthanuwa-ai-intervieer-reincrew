import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards for the two reported proctoring regressions.
 *
 * 1. "Multiple faces used to work but no longer triggers warnings."
 *    Two independent defects, both of which had to be fixed for the warning to appear:
 *      (a) DynamicInterviewScreen assigned `multiFaceState = 'VIOLATION_CREATED' as any`, a value
 *          outside the declared union ('SINGLE_FACE' | 'MULTI_FACE_START' |
 *          'MULTI_FACE_CONFIRMED'), forced past the compiler with a cast. No consumer tests for
 *          it, so the state never matched anything.
 *      (b) MonitoringDashboard's live violations panel was written as
 *          `A === x || B === y || C === z && (<div/>)`. `&&` binds tighter than `||`, so it
 *          parsed as `A || B || (C && <div/>)` and short-circuited to the boolean `true`, which
 *          React renders as nothing.
 *
 * 2. "Tab switching is broken or inconsistent."
 *    The 5-second violation cooldown was gated on a SINGLE shared `lastViolationTime`, so any
 *    violation suppressed every other type. Switching tabs takes the candidate's face out of
 *    frame, so NO_FACE fired first and silently swallowed the TAB_HIDDEN that followed
 *    milliseconds later.
 *
 * These are static-source assertions because the reducer is a closure inside a 2,400-line
 * component and is not exported. They pin the specific defects rather than the formatting.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/** Strip comments so an assertion cannot be satisfied by prose describing the bug. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const SCREEN = 'src/Interview/components/DynamicInterviewScreen.tsx';
const PANEL = 'src/Analytics/components/MonitoringDashboard.tsx';

describe('multiple-faces detection reaches the UI', () => {
  const screen = code(SCREEN);

  it('uses only states declared in the ProctoringState union', () => {
    const types = read('types.ts');
    const union = types.match(/multiFaceState:\s*([^;]+);/);
    expect(union, 'multiFaceState union must exist').toBeTruthy();
    expect(union![1]).toContain('MULTI_FACE_CONFIRMED');
    // The off-union value and the cast that hid it must both be gone.
    expect(screen).not.toContain("multiFaceState = 'VIOLATION_CREATED'");
    expect(screen).not.toMatch(/multiFaceState\s*===\s*'VIOLATION_CREATED'/);
    expect(screen).toContain("multiFaceState = 'MULTI_FACE_CONFIRMED'");
  });

  it('resolves back to SINGLE_FACE from the same state it sets', () => {
    // The set and the read must agree, or the RESOLVED timeline event never fires.
    expect(screen).toMatch(/multiFaceState\s*===\s*'MULTI_FACE_CONFIRMED'/);
  });

  it('the live violations panel condition is parenthesised', () => {
    const panel = code(PANEL);
    const line = panel.split('\n').find((l) => l.includes('MULTI_FACE_START'));
    expect(line, 'the multi-face branch must exist').toBeTruthy();
    // A bare `a || b && (...)` is the precedence bug. Requiring the disjunction to be wrapped
    // before `&&` is what makes React receive an element instead of a boolean.
    expect(line!).toMatch(/\(\s*proctoring\.multiFaceState[^)]*MULTI_FACE_CONFIRMED'\s*\)\s*&&/);
  });

  it('MediaPipe is still configured to detect more than one face', () => {
    // A numFaces of 1 would make faceCount > 1 unreachable no matter how correct the rest is.
    const service = code('src/Proctoring/services/mediaPipeService.ts');
    const numFaces = service.match(/numFaces:\s*(\d+)/);
    expect(numFaces).toBeTruthy();
    expect(Number(numFaces![1])).toBeGreaterThan(1);
  });
});

describe('violation cooldowns are per-type, not global', () => {
  const screen = code(SCREEN);

  it('no violation gate reads the shared lastViolationTime', () => {
    // The regression: `now - state.lastViolationTime < VIOLATION_COOLDOWN` in any gate lets an
    // unrelated violation suppress this one.
    expect(screen).not.toMatch(/now\s*-\s*state\.lastViolationTime\s*[<>]=?\s*VIOLATION_COOLDOWN/);
  });

  it('every violation type is gated on its own clock', () => {
    for (const type of ['TAB_HIDDEN', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'NO_FACE', 'MULTIPLE_FACES']) {
      expect(screen, `${type} must use a per-type cooldown`).toContain(`isWithinCooldown(state, '${type}'`);
    }
  });

  it('the per-type clock is actually recorded when a violation fires', () => {
    // A gate that reads a clock nothing writes would never suppress anything — the opposite
    // failure, duplicate violations on every frame.
    for (const type of ['TAB_HIDDEN', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'NO_FACE', 'MULTIPLE_FACES']) {
      expect(screen, `${type} must stamp its cooldown`).toMatch(
        new RegExp(`stampCooldown\\((state|newState), '${type}'`)
      );
    }
  });

  it('the state field backing the per-type clock is declared', () => {
    expect(read('types.ts')).toContain('lastViolationTimeByType');
  });
});

describe('violations name the specific event that occurred', () => {
  const screen = code(SCREEN);

  it('distinguishes copy from cut from paste', () => {
    // The DOM event already carried e.type; it was logged but discarded before reaching the
    // violation record, so every clipboard event read as "Clipboard action detected".
    expect(screen).toMatch(/clipboardAction/);
    for (const action of ['copy', 'cut', 'paste']) {
      expect(screen, `clipboard label for ${action}`).toMatch(new RegExp(`${action}:\\s*'${action[0].toUpperCase()}${action.slice(1)} attempt`, 'i'));
    }
    expect(screen).not.toContain("message: 'Clipboard action detected'");
  });

  it('distinguishes a tab switch from a window focus loss', () => {
    expect(screen).toMatch(/trigger:\s*'visibilitychange'/);
    expect(screen).toMatch(/trigger:\s*'blur'/);
    expect(screen).not.toContain("message: 'Browser tab hidden'");
  });

  it('reports how many faces were seen, not just that there were several', () => {
    expect(screen).toMatch(/Multiple faces in frame — \$\{faces\} people/);
  });

  it('every violation carries a detail on its timeline event', () => {
    // Previously MULTIPLE_FACES emitted a TimelineEvent with no detail at all, so the reviewer
    // saw a bare event name in the timeline.
    const timelineEvents = [...screen.matchAll(/event:\s*'(TAB_HIDDEN|FULLSCREEN_EXIT|COPY_PASTE|NO_FACE|MULTIPLE_FACES)'[^}]*\}/g)];
    expect(timelineEvents.length).toBeGreaterThanOrEqual(5);
    for (const match of timelineEvents) {
      expect(match[0], `${match[1]} timeline event must carry a detail`).toMatch(/detail/);
    }
  });

  it('the candidate is warned about clipboard use, not only scored for it', () => {
    expect(screen).toMatch(/copyPasteCount/);
  });
});
