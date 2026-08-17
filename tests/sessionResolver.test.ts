import { describe, it, expect } from 'vitest';
import { resolveSessionViewModel, SessionEffectiveStatus, EvaluationModeType, SCORE_PLACEHOLDER, STATUS_LABELS } from '../src/Core/utils/sessionStatusResolver';

describe('sessionStatusResolver Comprehensive Matrix', () => {
  it('1. Handles null or undefined session gracefully', () => {
    const vm = resolveSessionViewModel(null);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.IN_PROGRESS);
    expect(vm.displayScoreText).toBe(SCORE_PLACEHOLDER);
    expect(vm.isUnattempted).toBe(true);
  });

  it('2. Resolves COMPLETED session with QUEUED job status', () => {
    const session = { session_status: 'COMPLETED', questions_answered: 5, jobStatus: 'QUEUED' };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.QUEUED);
    expect(vm.displayStatusText).toBe('QUEUED');
    expect(vm.displayScoreText).toBe(SCORE_PLACEHOLDER);
    expect(vm.displayRecommendation).toBe(STATUS_LABELS.PENDING_EVALUATION);
  });

  it('3. Resolves COMPLETED session with PROCESSING job status', () => {
    const session = { session_status: 'COMPLETED', questions_answered: 5, jobStatus: 'PROCESSING' };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.PROCESSING);
    expect(vm.displayStatusText).toBe('PROCESSING');
    expect(vm.displayScoreText).toBe(SCORE_PLACEHOLDER);
    expect(vm.displayRecommendation).toBe(STATUS_LABELS.PROCESSING_EVALUATION);
  });

  it('4. Resolves COMPLETED session with FAILED job status', () => {
    const session = { session_status: 'COMPLETED', questions_answered: 5, jobStatus: 'FAILED' };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.FAILED);
    expect(vm.displayStatusText).toBe('FAILED');
    expect(vm.displayScoreText).toBe(SCORE_PLACEHOLDER);
    expect(vm.displayRecommendation).toBe(STATUS_LABELS.FAILED_EVALUATION);
  });

  it('5. Resolves COMPLETED session with FAILED_RETRYABLE job status as QUEUED', () => {
    const session = { session_status: 'COMPLETED', questions_answered: 5, jobStatus: 'FAILED_RETRYABLE' };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.QUEUED);
  });

  it('6. Resolves COMPLETED session with completed local report', () => {
    const session = {
      session_status: 'COMPLETED',
      questions_answered: 5,
      overall_score: 85,
      recommendation: 'Strong Hire',
      evaluation_logic: { metadata: { evaluationMode: 'LOCAL' } },
    };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.COMPLETED);
    expect(vm.displayScoreText).toBe('85%');
    expect(vm.displayRecommendation).toBe('Strong Hire');
  });

  it('7. Overrides QUEUED/PROCESSING when rawStatus is TERMINATED', () => {
    const session = { session_status: 'TERMINATED', questions_answered: 0, jobStatus: 'QUEUED' };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.TERMINATED);
    expect(vm.displayStatusText).toBe('TERMINATED (Incomplete)');
  });

  it('8. Sorts evaluation_jobs array descending by timestamp to find active job', () => {
    const session = {
      session_status: 'COMPLETED',
      evaluation_jobs: [
        { status: 'FAILED', created_at: '2026-07-28T10:00:00Z' },
        { status: 'PROCESSING', created_at: '2026-07-28T12:00:00Z' },
      ],
    };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.PROCESSING);
  });

  it('9. Handles missing created_at with last_attempt_at timestamp fallback', () => {
    const session = {
      session_status: 'COMPLETED',
      evaluation_jobs: [
        { status: 'PROCESSING', created_at: null, last_attempt_at: '2026-07-28T12:00:00Z' },
        { status: 'FAILED', created_at: '2026-07-27T10:00:00Z', last_attempt_at: null },
      ],
    };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.PROCESSING);
  });

  it('10. Correctly enforces job precedence over conflicting legacy fields', () => {
    const session = {
      session_status: 'COMPLETED',
      evaluation_jobs: [{ status: 'PROCESSING', created_at: '2026-07-28T12:00:00Z' }],
      jobStatus: 'QUEUED',
      evaluation_logic: { evaluationStatus: 'COMPLETED' },
    };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.PROCESSING);
  });

  it('11. Resolves 0-answer unattempted session', () => {
    const session = { session_status: 'TERMINATED', questions_answered: 0, overall_score: 50 };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.TERMINATED);
    expect(vm.displayScoreText).toBe(SCORE_PLACEHOLDER);
    expect(vm.isUnattempted).toBe(true);
  });

  it('12. Resolves IN_PROGRESS session cleanly', () => {
    const session = { session_status: 'IN_PROGRESS', questions_answered: 2 };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.IN_PROGRESS);
  });

  it('13. Falls back to IN_PROGRESS for unknown or unexpected status values', () => {
    const session = { session_status: 'UNKNOWN_FUTURE_STATUS', questions_answered: 0 };
    const vm = resolveSessionViewModel(session);
    expect(vm.effectiveStatus).toBe(SessionEffectiveStatus.IN_PROGRESS);
  });

  it('14. Resolves API mode session', () => {
    const session = { session_status: 'COMPLETED', evaluation_logic: { metadata: { mode: 'API' } } };
    expect(resolveSessionViewModel(session).evalMode).toBe(EvaluationModeType.API);
  });

  it('15. Resolves HYBRID mode session', () => {
    const session = { session_status: 'COMPLETED', evaluation_logic: { metadata: { mode: 'HYBRID' } } };
    expect(resolveSessionViewModel(session).evalMode).toBe(EvaluationModeType.HYBRID);
  });
});
