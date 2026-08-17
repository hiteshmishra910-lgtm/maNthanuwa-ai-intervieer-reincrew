import { describe, it, expect, beforeEach } from 'vitest';
import { EvaluationMode } from '../types';

// Testing evaluation mode precedence resolution contract
const resolveEvaluationMode = (
  globalMode: string | EvaluationMode | null,
  jobSnapshotMode?: string | null,
  sessionId?: string
): EvaluationMode => {
  try {
    if (sessionId) {
      const sessionOverride = localStorage.getItem(`reicrew_eval_mode_override_${sessionId}`);
      if (sessionOverride) {
        const normOverride = sessionOverride.toUpperCase();
        if (normOverride.includes('LOCAL')) return EvaluationMode.LOCAL;
        if (normOverride.includes('HYBRID')) return EvaluationMode.HYBRID;
        if (normOverride.includes('API')) return EvaluationMode.API;
      }
    }
  } catch (e) {
    // Ignore storage errors
  }

  if (globalMode) {
    const normGlobal = String(globalMode).toUpperCase();
    if (normGlobal.includes('LOCAL')) return EvaluationMode.LOCAL;
    if (normGlobal.includes('HYBRID')) return EvaluationMode.HYBRID;
    if (normGlobal.includes('API')) return EvaluationMode.API;
  }

  if (jobSnapshotMode) {
    const norm = String(jobSnapshotMode).toUpperCase();
    if (norm === 'LOCAL' || norm.includes('LOCAL')) return EvaluationMode.LOCAL;
    if (norm === 'API' || norm.includes('API') || norm.includes('INTERACTIVE') || norm === 'AI') return EvaluationMode.API;
    if (norm === 'HYBRID') return EvaluationMode.HYBRID;
  }

  return EvaluationMode.LOCAL;
};

describe('Evaluation Mode Precedence Contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should honor global DB setting LOCAL over candidate snapshot API when no session override exists', () => {
    const result = resolveEvaluationMode('LOCAL', 'API', 'sess_123');
    expect(result).toBe(EvaluationMode.LOCAL);
  });

  it('should honor global DB setting API over default when no snapshot or override exists', () => {
    const result = resolveEvaluationMode('API', null, 'sess_123');
    expect(result).toBe(EvaluationMode.API);
  });

  it('should prioritize explicit session-scoped UI override over global DB setting', () => {
    localStorage.setItem('reicrew_eval_mode_override_sess_123', 'API');
    const result = resolveEvaluationMode('LOCAL', 'LOCAL', 'sess_123');
    expect(result).toBe(EvaluationMode.API);
  });

  it('should isolate session overrides so Session A override does NOT affect Session B', () => {
    localStorage.setItem('reicrew_eval_mode_override_sess_A', 'API');
    
    const resultA = resolveEvaluationMode('LOCAL', 'LOCAL', 'sess_A');
    const resultB = resolveEvaluationMode('LOCAL', 'LOCAL', 'sess_B');

    expect(resultA).toBe(EvaluationMode.API);
    expect(resultB).toBe(EvaluationMode.LOCAL);
  });

  it('should ignore stale legacy localStorage keys like evaluation_mode', () => {
    localStorage.setItem('evaluation_mode', 'API');
    const result = resolveEvaluationMode('LOCAL', 'API', 'sess_456');
    expect(result).toBe(EvaluationMode.LOCAL);
  });
});
