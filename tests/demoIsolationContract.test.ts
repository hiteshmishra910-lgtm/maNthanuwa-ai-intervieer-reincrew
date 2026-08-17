import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assertNotDemoEntity, isDemoCandidate, isDemoSessionId } from '../src/Core/demo/demoGuards';
import { DemoDataService } from '../src/Core/demo/demoDataService';
import { getEffectiveSessionReport } from '../src/Core/utils/reportReconstructor';
import { setDemoMode, isDemoModeActive, resetDemoMode } from '../src/Core/demo/demoMode';
import { DataProvider, mergeDashboardSessions, sortSessionsRealFirst } from '../src/Core/data/dataProvider';
import { DemoDataProvider } from '../src/Core/data/demoDataProvider';
import { ProductionDataProvider } from '../src/Core/data/productionDataProvider';
import { sessionEvents } from '../src/Core/events/sessionEvents';

describe('Demo Isolation & Architecture Contract Tests', () => {
  beforeEach(() => {
    resetDemoMode();
    vi.restoreAllMocks();
  });

  it('correctly identifies demo session IDs', () => {
    expect(isDemoSessionId('demo-session-aarav')).toBe(true);
    expect(isDemoSessionId('demo-session-priya')).toBe(true);
    expect(isDemoSessionId('demo-session-rohan')).toBe(true);
    expect(isDemoSessionId('real-supabase-uuid-12345')).toBe(false);
  });

  it('correctly identifies demo candidates and DOES NOT treat @example.com as demo identity', () => {
    expect(isDemoCandidate({ isDemo: true, name: 'Test Candidate' })).toBe(true);
    expect(isDemoCandidate({ id: 'demo-cand-aarav', name: 'Aarav' })).toBe(true);
    // @example.com must NOT be classified as demo candidate
    expect(isDemoCandidate({ email: 'test.candidate@example.com' })).toBe(false);
    expect(isDemoCandidate({ id: 'cand-real-123', email: 'real@company.com' })).toBe(false);
  });

  it('assertNotDemoEntity allows candidates with @example.com email to persist', () => {
    const realCandidateWithExampleEmail = { id: 'real-uuid-999', name: 'Real Candidate', email: 'test@example.com' };
    expect(() => assertNotDemoEntity(realCandidateWithExampleEmail, 'upsertCandidate')).not.toThrow();

    const demoCandidate = { isDemo: true, name: 'Aarav Sharma' };
    expect(() => assertNotDemoEntity(demoCandidate, 'upsertCandidate')).toThrowError(
      '[Demo Isolation Guard Error] Blocked upsertCandidate'
    );
  });

  it('Demo Mode default state is OFF (false)', () => {
    resetDemoMode();
    expect(isDemoModeActive()).toBe(false);
  });

  it('Demo OFF Hard Boundary: DemoDataProvider is NEVER invoked when Demo Mode is OFF', async () => {
    resetDemoMode(); // Ensure OFF
    expect(isDemoModeActive()).toBe(false);

    const demoGetSessionsSpy = vi.spyOn(DemoDataProvider, 'getSessions');
    const demoGetCandidatesSpy = vi.spyOn(DemoDataProvider, 'getCandidates');
    const demoGetSummarySpy = vi.spyOn(DemoDataProvider, 'getDashboardSummary');

    vi.spyOn(ProductionDataProvider, 'getSessions').mockResolvedValue([
      { id: 'real-session-1', session_status: 'COMPLETED', interview_date: '2026-08-12T10:00:00Z', isDemo: false },
    ]);
    vi.spyOn(ProductionDataProvider, 'getCandidates').mockResolvedValue([
      { id: 'real-cand-1', name: 'Real User', isDemo: false },
    ]);

    const sessions = await DataProvider.getSessions();
    const candidates = await DataProvider.getCandidates();

    expect(demoGetSessionsSpy).not.toHaveBeenCalled();
    expect(demoGetCandidatesSpy).not.toHaveBeenCalled();
    expect(demoGetSummarySpy).not.toHaveBeenCalled();

    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe('real-session-1');
    expect(candidates.length).toBe(1);
    expect(candidates[0].id).toBe('real-cand-1');
  });

  it('REGRESSION TEST: 100 demo records + 1 new real submission -> real submission is at index 0 after merge and slice(0, 5)', async () => {
    setDemoMode(true); // Demo Mode ON

    const demoSessions = await DemoDataProvider.getSessions();
    expect(demoSessions.length).toBeGreaterThanOrEqual(90);

    const newRealSubmission = {
      id: 'real-session-newest-uuid',
      session_id: 'real-session-newest-uuid',
      candidate_name: 'Fresh Candidate',
      interview_date: '2026-08-12T23:59:59Z',
      session_status: 'COMPLETED',
      isDemo: false,
    };

    const merged = mergeDashboardSessions([newRealSubmission], demoSessions);

    // Assert real session comes at index 0
    expect(merged[0].id).toBe('real-session-newest-uuid');
    expect(merged[0].isDemo).not.toBe(true);

    // Assert .slice(0, 5) contains real submission at index 0
    const sliced = merged.slice(0, 5);
    expect(sliced[0].id).toBe('real-session-newest-uuid');
  });

  it('sortSessionsRealFirst places legacy records without isDemo flag as real records before demo records', () => {
    const legacyRealRecord = { id: 'legacy-real-1', interview_date: '2026-08-10T10:00:00Z' }; // isDemo undefined -> real
    const demoRecord = { id: 'demo-session-1', isDemo: true, interview_date: '2026-08-12T10:00:00Z' };

    const sorted = sortSessionsRealFirst([demoRecord, legacyRealRecord]);

    expect(sorted[0].id).toBe('legacy-real-1');
    expect(sorted[1].id).toBe('demo-session-1');
  });

  it('sessionEvents emits typed payload upon session update', () => {
    const listener = vi.fn();
    const unsub = sessionEvents.on(listener);

    sessionEvents.emit({
      sessionId: 'session-xyz',
      candidateId: 'cand-123',
      action: 'created',
    });

    expect(listener).toHaveBeenCalledWith({
      sessionId: 'session-xyz',
      candidateId: 'cand-123',
      action: 'created',
    });

    unsub();
  });

  it('reportReconstructor resolves demo sessions locally without database calls', () => {
    const reportPranita = getEffectiveSessionReport('demo-session-pranita-1');
    expect(reportPranita).toBeDefined();
    expect(reportPranita.candidateName).toBe('Pranita Khobe');
    expect(reportPranita.finalScore).toBe(94);
  });
});
