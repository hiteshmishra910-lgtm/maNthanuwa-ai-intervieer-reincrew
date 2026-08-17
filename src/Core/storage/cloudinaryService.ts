// KEY IMPROVEMENTS OVER ORIGINAL:
//   1. Upload queue with concurrency cap (MAX_CONCURRENT_UPLOADS)
//   2. Exponential-backoff retry (3 attempts) for transient failures
//   3. Deduplication via in-flight Set — same publicId never uploads twice
//   4. Per-upload timeout (30 s image / 60 s video) via AbortController
//   5. Structured error types for caller-side handling
//   6. Performance metrics emitted to UploadMetricsCollector
//   7. Signed uploads via cloudinary-sign edge function (API secret stays server-side)
//   8. Resilient private Supabase Storage fallback when Cloudinary is unconfigured/unavailable

import { supabase, getEdgeFunctionAuthHeaders, getClerkToken } from "../database/supabaseClient";
import { UploadMetricsCollector } from "../../Analytics/services/PerformanceLogger";
import { ErrorLogService } from "../logging/errorLogService";

// ─── Config ──────────────────────────────────────────────────────────────────

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;

const IMAGE_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const VIDEO_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;

const MAX_CONCURRENT_UPLOADS = 4;   // max parallel Cloudinary requests
const MAX_RETRY_ATTEMPTS     = 3;   // retry count on failure
const IMAGE_TIMEOUT_MS       = 30_000;
const VIDEO_TIMEOUT_MS       = 60_000;
export const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1-hour expiration for private bucket access

// ─── Error types ─────────────────────────────────────────────────────────────

export class CloudinaryUploadError extends Error {
  constructor(
    public readonly type: "snapshot" | "clip",
    public readonly publicId: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CloudinaryUploadError";
  }
}

export class CloudinaryTimeoutError extends Error {
  constructor(public readonly publicId: string) {
    super(`Upload timed out: ${publicId}`);
    this.name = "CloudinaryTimeoutError";
  }
}

// ─── Concurrency queue ───────────────────────────────────────────────────────

class UploadQueue {
  private running = 0;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (this.running < MAX_CONCURRENT_UPLOADS) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }

  get stats() {
    return { running: this.running, queued: this.queue.length };
  }
}

const uploadQueue = new UploadQueue();

// ─── Deduplication guard ─────────────────────────────────────────────────────

const inFlight = new Map<string, Promise<string | null>>();

// ─── Get signed upload params from edge function ─────────────────────────────

interface SignedParams {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  public_id: string;
}

async function getSignedParams(
  publicId: string,
  folder: string,
  sessionId: string,
  context?: string,
  resourceType?: string,
): Promise<SignedParams | null> {
  try {
    const { data, error } = await supabase.functions.invoke("cloudinary-sign", {
      body: {
        public_id: publicId,
        folder,
        context,
        resource_type: resourceType,
        clerk_token: getClerkToken(),
        sessionId,
      },
      headers: getEdgeFunctionAuthHeaders(),
    });

    if (error || !data || !data.signature) {
      console.warn("[Cloudinary] Signed upload params unavailable:", error?.message);
      return null;
    }

    return data as SignedParams;
  } catch (err) {
    console.warn("[Cloudinary] Failed to get signed params:", err);
    return null;
  }
}

// ─── Core upload primitive ───────────────────────────────────────────────────

async function uploadWithRetry(
  endpoint: string,
  form: FormData,
  publicId: string,
  type: "snapshot" | "clip",
  timeoutMs: number,
): Promise<string> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const attemptStart = performance.now();

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        console.error(errText);
        lastError = new CloudinaryUploadError(
          type,
          publicId,
          res.status,
          `Cloudinary ${type} upload failed [${res.status}] attempt ${attempt}: ${errText}`,
        );

        // 4xx errors (except 429 rate-limit) are not retryable
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw lastError;
        }

        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }

      const data = await res.json();
      const durationMs = performance.now() - attemptStart;

      UploadMetricsCollector.record({
        type,
        publicId,
        attempt,
        durationMs,
        success: true,
        queueStats: uploadQueue.stats,
      });

      return data.secure_url as string;

    } catch (err) {
      clearTimeout(timer);

      if ((err as Error).name === "AbortError") {
        lastError = new CloudinaryTimeoutError(publicId);
      } else if (err instanceof CloudinaryUploadError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        UploadMetricsCollector.record({
          type,
          publicId,
          attempt,
          durationMs: performance.now() - attemptStart,
          success: false,
          error: (err as Error).message,
          queueStats: uploadQueue.stats,
        });
        throw err;
      } else {
        lastError = err as Error;
      }

      UploadMetricsCollector.record({
        type,
        publicId,
        attempt,
        durationMs: performance.now() - attemptStart,
        success: false,
        error: lastError.message,
        queueStats: uploadQueue.stats,
      });

      if (attempt < MAX_RETRY_ATTEMPTS) {
        await sleep(1000 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError;
}

// ─── Build FormData with signed params ────────────────────────────────────────

async function buildFormData(
  file: Blob,
  publicId: string,
  folder: string,
  context: string,
  sessionId: string,
  resourceType?: string,
): Promise<FormData | null> {
  const signed = await getSignedParams(publicId, folder, sessionId, context, resourceType);
  if (!signed) {
    return null;
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.api_key);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("public_id", publicId);
  form.append("folder", folder);
  if (context) form.append("context", context);

  return form;
}

// ─── Supabase Storage Fallback (Private Bucket + Immutable Evidence) ─────────

export async function uploadToSupabaseStorageFallback(
  sessionId: string,
  violationId: string,
  blob: Blob,
  mediaType: "snapshot" | "clip"
): Promise<string | null> {
  const ext = mediaType === "snapshot" ? "jpg" : "webm";
  const contentType = mediaType === "snapshot" ? "image/jpeg" : "video/webm";
  const storagePath = `${sessionId}/${mediaType === "snapshot" ? "snapshots" : "clips"}/${violationId}.${ext}`;

  try {
    // 1. Upload to private bucket 'proctoring-media' with upsert: false (immutable evidence)
    const { error: uploadErr } = await supabase.storage
      .from("proctoring-media")
      .upload(storagePath, blob, {
        contentType,
        upsert: false,
      });

    if (uploadErr && !uploadErr.message?.includes("already exists")) {
      console.error("[SupabaseStorage] Fallback upload failed:", uploadErr.message);
      ErrorLogService.logError("proctoring", `Supabase Storage fallback failed for ${storagePath}: ${uploadErr.message}`, {
        sessionId,
        violationId,
        mediaType,
        provider: "supabase-storage",
        uploadPath: storagePath,
        rawError: uploadErr.message,
      });
      return null;
    }

    // 2. Generate initial signed URL for immediate session usage
    const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
      .from("proctoring-media")
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlErr || !signedUrlData?.signedUrl) {
      console.error("[SupabaseStorage] Signed URL generation failed:", signedUrlErr?.message);
      return `supabase-storage://proctoring-media/${storagePath}`;
    }

    console.log(`[SupabaseStorage] Fallback upload successful: ${storagePath}`);
    return signedUrlData.signedUrl;
  } catch (err: any) {
    console.error("[SupabaseStorage] Fallback exception:", err.message);
    ErrorLogService.logError("proctoring", `Supabase Storage fallback exception: ${err.message}`, {
      sessionId,
      violationId,
      mediaType,
      provider: "supabase-storage",
      uploadPath: storagePath,
      rawError: err.message,
    });
    return null;
  }
}

/**
 * On-demand helper for HR/Admin dashboards to resolve a fresh signed URL
 * from a stored private storage path or canonical URI.
 */
export async function getSignedProctoringUrl(storagePathOrUri: string): Promise<string | null> {
  if (!storagePathOrUri) return null;
  if (storagePathOrUri.startsWith("http://") || storagePathOrUri.startsWith("https://")) {
    return storagePathOrUri; // Already a full URL (e.g. Cloudinary)
  }

  const cleanPath = storagePathOrUri.replace(/^supabase-storage:\/\/proctoring-media\//, "");
  const { data, error } = await supabase.storage
    .from("proctoring-media")
    .createSignedUrl(cleanPath, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[SupabaseStorage] Failed to generate signed URL for path:", cleanPath, error?.message);
    return null;
  }
  return data.signedUrl;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function uploadProctoringSnapshot(
  sessionId: string,
  violationId: string,
  imageBlob: Blob,
): Promise<string | null> {
  const publicId = `proctoring/snapshots/${sessionId}/${violationId}`;
  const folder = `reicrew/proctoring/snapshots/${sessionId}`;
  const context = `session_id=${sessionId}|violation_id=${violationId}`;

  if (inFlight.has(publicId)) {
    console.warn(`[Cloudinary] Duplicate snapshot upload prevented: ${publicId}`);
    return inFlight.get(publicId)!;
  }

  const promise = (async () => {
    try {
      const form = await buildFormData(imageBlob, publicId, folder, context, sessionId);
      if (form) {
        await uploadQueue.acquire();
        try {
          return await uploadWithRetry(IMAGE_ENDPOINT, form, publicId, "snapshot", IMAGE_TIMEOUT_MS);
        } finally {
          uploadQueue.release();
        }
      }
    } catch (err: any) {
      // Ignore non-retryable 400 client validation errors
      if (err instanceof CloudinaryUploadError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        console.error(`[Cloudinary] Permanent client validation error [${err.status}], skipping fallback.`);
        return null;
      }
      console.warn(`[Cloudinary] Snapshot upload failed (${err.message}). Attempting Supabase Storage fallback...`);
    } finally {
      inFlight.delete(publicId);
    }

    // Fall back to private Supabase Storage
    return await uploadToSupabaseStorageFallback(sessionId, violationId, imageBlob, "snapshot");
  })();

  inFlight.set(publicId, promise);
  return promise;
}

export async function uploadProctoringClip(
  sessionId: string,
  violationId: string,
  videoBlob: Blob,
): Promise<string | null> {
  const publicId = `proctoring/clips/${sessionId}/${violationId}`;
  const folder = `reicrew/proctoring/clips/${sessionId}`;
  const context = `session_id=${sessionId}|violation_id=${violationId}`;

  if (inFlight.has(publicId)) {
    console.warn(`[Cloudinary] Duplicate clip upload prevented: ${publicId}`);
    return inFlight.get(publicId)!;
  }

  const promise = (async () => {
    try {
      const form = await buildFormData(videoBlob, publicId, folder, context, sessionId, "video");
      if (form) {
        await uploadQueue.acquire();
        try {
          return await uploadWithRetry(VIDEO_ENDPOINT, form, publicId, "clip", VIDEO_TIMEOUT_MS);
        } finally {
          uploadQueue.release();
        }
      }
    } catch (err: any) {
      // Ignore non-retryable 400 client validation errors
      if (err instanceof CloudinaryUploadError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        console.error(`[Cloudinary] Permanent client validation error [${err.status}], skipping fallback.`);
        return null;
      }
      console.warn(`[Cloudinary] Clip upload failed (${err.message}). Attempting Supabase Storage fallback...`);
    } finally {
      inFlight.delete(publicId);
    }

    // Fall back to private Supabase Storage
    return await uploadToSupabaseStorageFallback(sessionId, violationId, videoBlob, "clip");
  })();

  inFlight.set(publicId, promise);
  return promise;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { uploadQueue };
