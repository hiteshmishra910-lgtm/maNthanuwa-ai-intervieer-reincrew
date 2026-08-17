// src/utils/performanceLogger.ts
//
// Replaces the original console-only PerformanceLogger with a structured
// metrics collector that persists upload events and generates evidence reports.
//
// WHAT'S NEW vs ORIGINAL:
//   - Records every upload attempt (success + failure) with full context
//   - Tracks queue depth at time of each upload
//   - generateReport() produces the JSON evidence report for Task 6
//   - PerformanceLogger.measure() still works — drop-in compatible

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadRecord {
  type: "snapshot" | "clip";
  publicId: string;
  attempt: number;
  durationMs: number;
  success: boolean;
  error?: string;
  queueStats: { running: number; queued: number };
  timestamp: string; // ISO
}

export interface EvidenceReport {
  generatedAt: string;
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  duplicatesPrevented: number;
  retriesTotal: number;
  averageDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  byType: {
    snapshot: TypeStats;
    clip: TypeStats;
  };
  bottlenecks: string[];
  uploadLog: UploadRecord[];
}

interface TypeStats {
  total: number;
  successful: number;
  failed: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

// ─── Collector (singleton) ───────────────────────────────────────────────────

class _UploadMetricsCollector {
  private records: UploadRecord[] = [];
  private duplicatesPrevented = 0;

  record(entry: Omit<UploadRecord, "timestamp">): void {
    this.records.push({ ...entry, timestamp: new Date().toISOString() });
  }

  recordDuplicate(): void {
    this.duplicatesPrevented++;
  }

  generateReport(): EvidenceReport {
    const all = this.records;
    const successful = all.filter((r) => r.success);
    const failed = all.filter((r) => !r.success);

    // Retries = any attempt > 1
    const retriesTotal = all.filter((r) => r.attempt > 1).length;

    const durations = successful.map((r) => r.durationMs).sort((a, b) => a - b);

    return {
      generatedAt: new Date().toISOString(),
      totalUploads: all.length,
      successfulUploads: successful.length,
      failedUploads: failed.length,
      duplicatesPrevented: this.duplicatesPrevented,
      retriesTotal,
      averageDurationMs: avg(durations),
      p95DurationMs: percentile(durations, 95),
      maxDurationMs: durations.at(-1) ?? 0,
      minDurationMs: durations.at(0) ?? 0,
      byType: {
        snapshot: typeStats(all, "snapshot"),
        clip: typeStats(all, "clip"),
      },
      bottlenecks: this.detectBottlenecks(all),
      uploadLog: all,
    };
  }

  reset(): void {
    this.records = [];
    this.duplicatesPrevented = 0;
  }

  private detectBottlenecks(records: UploadRecord[]): string[] {
    const issues: string[] = [];

    // High failure rate
    const failRate = records.filter((r) => !r.success).length / Math.max(records.length, 1);
    if (failRate > 0.1) {
      issues.push(`High failure rate: ${(failRate * 100).toFixed(1)}% of uploads failed`);
    }

    // Slow uploads (> 10 s average)
    const successDurations = records.filter((r) => r.success).map((r) => r.durationMs);
    const avgDur = avg(successDurations);
    if (avgDur > 10_000) {
      issues.push(`Slow average upload time: ${(avgDur / 1000).toFixed(1)}s`);
    }

    // Queue saturation (queued > 0 means concurrency cap was hit)
    const queueSaturated = records.filter((r) => r.queueStats.queued > 0).length;
    if (queueSaturated > 0) {
      issues.push(
        `Queue saturation detected in ${queueSaturated} uploads — consider raising MAX_CONCURRENT_UPLOADS`,
      );
    }

    // Multiple retries
    const highRetry = records.filter((r) => r.attempt >= 3).length;
    if (highRetry > 0) {
      issues.push(`${highRetry} uploads required 3 attempts — likely transient network issues`);
    }

    if (issues.length === 0) {
      issues.push("No bottlenecks detected — all uploads within acceptable thresholds");
    }

    return issues;
  }
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function typeStats(records: UploadRecord[], type: "snapshot" | "clip"): TypeStats {
  const subset = records.filter((r) => r.type === type);
  const ok = subset.filter((r) => r.success);
  const durations = ok.map((r) => r.durationMs).sort((a, b) => a - b);
  return {
    total: subset.length,
    successful: ok.length,
    failed: subset.filter((r) => !r.success).length,
    avgDurationMs: avg(durations),
    p95DurationMs: percentile(durations, 95),
  };
}

export const UploadMetricsCollector = new _UploadMetricsCollector();

// ─── Drop-in PerformanceLogger (backwards compatible) ────────────────────────

export class PerformanceLogger {
  static async measure<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const durationMs = performance.now() - start;
      console.log(`🚀 ${operationName}: ${durationMs.toFixed(2)} ms`);
      return result;
    } catch (error) {
      const durationMs = performance.now() - start;
      console.error(`❌ ${operationName} FAILED after ${durationMs.toFixed(2)} ms`, error);
      throw error;
    }
  }
}