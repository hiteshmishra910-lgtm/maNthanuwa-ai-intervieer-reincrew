import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadProctoringSnapshot,
  uploadProctoringClip,
  getSignedProctoringUrl,
  SIGNED_URL_EXPIRY_SECONDS,
} from '../src/Core/storage/cloudinaryService';
import { supabase } from '../src/Core/database/supabaseClient';

vi.mock('../src/Core/database/supabaseClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://supabase.co/storage/v1/object/sign/proctoring-media/test/path?token=xyz' },
            error: null,
          }),
        })),
      },
    },
    getEdgeFunctionAuthHeaders: vi.fn(() => ({})),
    getClerkToken: vi.fn(() => 'mock-token'),
  };
});

describe('Storage Fallback & Resilience Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Returns Cloudinary URL when Cloudinary signed upload succeeds', async () => {
    // Mock Cloudinary signing success
    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: {
        signature: 'mock-sig',
        api_key: 'mock-key',
        timestamp: 12345,
      },
      error: null,
    });

    // Mock global fetch for Cloudinary API success
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/image/upload/snapshot.jpg' }),
    } as Response);

    const blob = new Blob(['test-image'], { type: 'image/jpeg' });
    const url = await uploadProctoringSnapshot('sess-100', 'viol-100', blob);

    expect(url).toBe('https://res.cloudinary.com/demo/image/upload/snapshot.jpg');
    fetchSpy.mockRestore();
  });

  it('2. Falls back to private Supabase Storage when Cloudinary signing fails', async () => {
    // Mock Cloudinary signing failure
    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: null,
      error: { message: 'Cloudinary signing function down' },
    });

    const blob = new Blob(['test-snapshot'], { type: 'image/jpeg' });
    const url = await uploadProctoringSnapshot('sess-101', 'viol-101', blob);

    expect(url).toContain('https://supabase.co/storage/v1/object/sign/proctoring-media/');
    expect(supabase.storage.from).toHaveBeenCalledWith('proctoring-media');
  });

  it('3. Generates fresh signed URL on demand via getSignedProctoringUrl', async () => {
    const rawPath = 'supabase-storage://proctoring-media/sess-102/snapshots/viol-102.jpg';
    const signedUrl = await getSignedProctoringUrl(rawPath);

    expect(signedUrl).toContain('https://supabase.co/storage/v1/object/sign/proctoring-media/');
    expect(SIGNED_URL_EXPIRY_SECONDS).toBe(3600);
  });

  it('4. Returns existing HTTPS URLs unmodified in getSignedProctoringUrl', async () => {
    const directUrl = 'https://res.cloudinary.com/demo/video/upload/clip.mp4';
    const res = await getSignedProctoringUrl(directUrl);
    expect(res).toBe(directUrl);
  });
});
