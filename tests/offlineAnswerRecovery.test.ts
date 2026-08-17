import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * PHASE 4 regression guard: candidate answers buffered offline must eventually reach the database.
 *
 * saveResponse() writes every answer to localStorage under `offline_response_<session>_<index>`
 * before the network write and clears it on success. When the write failed, the only recovery was
 * a single `window.addEventListener('online', retrySync, { once: true })` inside that closure.
 *
 * Two holes, both closed by this change:
 *   1. { once: true } meant a retry that itself failed removed the listener — no further attempt.
 *   2. Nothing ever read `offline_response_*` back, so an answer buffered by a tab that was then
 *      closed was stranded in localStorage permanently.
 *
 * flushOfflineResponses() sweeps the buffer and re-upserts. Because the write is an upsert on
 * (session_id, question_index), replaying an answer that did land is a no-op, not a duplicate.
 */

const upsertMock = vi.fn();

vi.mock('../src/Core/database/supabaseClient', () => ({
  supabase: { from: () => ({ upsert: upsertMock }) },
  getEdgeFunctionAuthHeaders: () => ({}),
  getClerkToken: () => null,
  setSupabaseAuthToken: () => {},
  setClerkToken: () => {},
  clearAuthTokens: () => {},
  getSupabase: () => ({}),
}));
vi.mock('../src/Core/logging/errorLogService', () => ({
  ErrorLogService: { logError: () => {} },
}));
vi.mock('../src/Analytics/services/PerformanceLogger', () => ({
  PerformanceLogger: { measure: (_n: string, fn: any) => fn() },
  UploadMetricsCollector: { record: () => {} },
}));

const KEY_A = 'offline_response_sess-1_0';
const KEY_B = 'offline_response_sess-1_1';
const payload = (i: number) => JSON.stringify({ session_id: 'sess-1', question_index: i, candidate_answer: 'x', question_text: 'Sample Question' });

describe('Phase 4: offline answer recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    upsertMock.mockReset();
  });
  afterEach(() => localStorage.clear());

  it('flushes every buffered answer and clears it on success', async () => {
    localStorage.setItem(KEY_A, payload(0));
    localStorage.setItem(KEY_B, payload(1));
    upsertMock.mockResolvedValue({ error: null });

    const { SupabaseService } = await import('../src/Core/database/supabaseService');
    const flushed = await SupabaseService.flushOfflineResponses();

    expect(flushed).toBe(2);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(KEY_A)).toBeNull();
    expect(localStorage.getItem(KEY_B)).toBeNull();
  });

  it('KEEPS the answer buffered when the write fails — losing it would be worse', async () => {
    localStorage.setItem(KEY_A, payload(0));
    upsertMock.mockResolvedValue({ error: { message: 'offline' } });

    const { SupabaseService } = await import('../src/Core/database/supabaseService');
    const flushed = await SupabaseService.flushOfflineResponses();

    expect(flushed).toBe(0);
    expect(localStorage.getItem(KEY_A)).toBe(payload(0));
  });

  it('upserts on (session_id, question_index) so a replay cannot duplicate a row', async () => {
    localStorage.setItem(KEY_A, payload(0));
    upsertMock.mockResolvedValue({ error: null });

    const { SupabaseService } = await import('../src/Core/database/supabaseService');
    await SupabaseService.flushOfflineResponses();

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'sess-1', question_index: 0 }),
      { onConflict: 'session_id,question_index' },
    );
  });

  it('discards a corrupt entry instead of retrying it forever', async () => {
    localStorage.setItem(KEY_A, '{not valid json');
    const { SupabaseService } = await import('../src/Core/database/supabaseService');
    const flushed = await SupabaseService.flushOfflineResponses();

    expect(flushed).toBe(0);
    expect(localStorage.getItem(KEY_A)).toBeNull();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('is a no-op when nothing is buffered, and ignores unrelated keys', async () => {
    localStorage.setItem('reicrew_autosave_sess-1', '{}');
    localStorage.setItem('some_other_key', 'value');

    const { SupabaseService } = await import('../src/Core/database/supabaseService');
    expect(await SupabaseService.flushOfflineResponses()).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
    // Must not touch state belonging to other features.
    expect(localStorage.getItem('reicrew_autosave_sess-1')).toBe('{}');
    expect(localStorage.getItem('some_other_key')).toBe('value');
  });
});

describe('Phase 4: the retry listener re-arms', () => {
  it('no longer registers the online listener with { once: true }', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../src/Core/database/supabaseService.ts'), 'utf8',
    );
    // A once-only listener is removed even when the retry fails, stranding the answer.
    expect(src).not.toMatch(/addEventListener\('online',\s*retrySync,\s*\{\s*once:\s*true\s*\}\)/);
    expect(src).toMatch(/addEventListener\('online',\s*retrySync\)/);
    // It must be removed explicitly, and only after a confirmed success.
    expect(src).toMatch(/removeEventListener\('online',\s*retrySync\)/);
  });
});
