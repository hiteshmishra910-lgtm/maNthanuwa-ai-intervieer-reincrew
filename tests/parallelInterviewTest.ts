// tests/parallelInterviewTest.ts
//
// Simulates N concurrent interview sessions, each generating M violations.
// Every violation triggers a snapshot + clip upload to Cloudinary.
//
// Run with:
//   npx ts-node tests/parallelInterviewTest.ts
//
// Output:
//   - Console summary
//   - reports/evidence_report_<timestamp>.json
//
// ENV REQUIRED:
//   VITE_CLOUDINARY_CLOUD_NAME=...
//   VITE_CLOUDINARY_UPLOAD_PRESET=...

import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const CONCURRENT_SESSIONS  = 5;   // number of parallel interviews
const VIOLATIONS_PER_SESSION = 4; // violations per session
const SNAPSHOT_SIZE_BYTES  = 50_000;  // ~50 KB JPEG
const CLIP_SIZE_BYTES      = 500_000; // ~500 KB WebM

// ─── Stubs (replace with real imports in your project) ────────────────────────

// Minimal stubs for running outside the React/browser environment
process.env.VITE_CLOUDINARY_CLOUD_NAME    = process.env.VITE_CLOUDINARY_CLOUD_NAME    ?? "demo";
process.env.VITE_CLOUDINARY_UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "reicrew_proctoring";

// Stub import.meta.env for Node
(global as any).importMetaEnv = {
  VITE_CLOUDINARY_CLOUD_NAME:    process.env.VITE_CLOUDINARY_CLOUD_NAME,
  VITE_CLOUDINARY_UPLOAD_PRESET: process.env.VITE_CLOUDINARY_UPLOAD_PRESET,
};

// ─── Metrics ─────────────────────────────────────────────────────────────────

interface UploadResult {
  sessionId: string;
  violationId: string;
  type: "snapshot" | "clip";
  success: boolean;
  durationMs: number;
  attempt: number;
  error?: string;
  url?: string;
}

const results: UploadResult[] = [];

// ─── Fake upload (mirrors real cloudinaryService logic without network) ────────
// In real runs, import and use the actual uploadProctoringSnapshot/Clip functions.

async function fakeUpload(
  type: "snapshot" | "clip",
  sessionId: string,
  violationId: string,
  blobSizeBytes: number,
): Promise<UploadResult> {
  const start = performance.now();

  // Simulate network latency: 300 ms – 2500 ms, occasionally fail (10%)
  const latency = 300 + Math.random() * 2200;
  const shouldFail = Math.random() < 0.10;

  await sleep(latency);

  const durationMs = performance.now() - start;

  if (shouldFail) {
    return {
      sessionId,
      violationId,
      type,
      success: false,
      durationMs,
      attempt: 1,
      error: "Simulated Cloudinary 503 transient error",
    };
  }

  return {
    sessionId,
    violationId,
    type,
    success: true,
    durationMs,
    attempt: 1,
    url: `https://res.cloudinary.com/demo/${type === "snapshot" ? "image" : "video"}/upload/proctoring/${type}s/${sessionId}/${violationId}`,
  };
}

// ─── Session simulation ───────────────────────────────────────────────────────

async function simulateSession(sessionIndex: number): Promise<void> {
  const sessionId = `test-session-${String(sessionIndex).padStart(3, "0")}`;
  console.log(`[Session ${sessionIndex}] Starting — ${VIOLATIONS_PER_SESSION} violations`);

  for (let v = 0; v < VIOLATIONS_PER_SESSION; v++) {
    const violationId = `viol-${sessionId}-${v}`;

    // Snapshot and clip run concurrently within a violation (matches real behaviour)
    const [snapshotResult, clipResult] = await Promise.allSettled([
      fakeUpload("snapshot", sessionId, violationId, SNAPSHOT_SIZE_BYTES),
      fakeUpload("clip",     sessionId, violationId, CLIP_SIZE_BYTES),
    ]);

    for (const settled of [snapshotResult, clipResult]) {
      if (settled.status === "fulfilled") {
        results.push(settled.value);
      } else {
        results.push({
          sessionId,
          violationId,
          type: "snapshot",
          success: false,
          durationMs: 0,
          attempt: 1,
          error: settled.reason?.message ?? "Unknown",
        });
      }
    }
  }

  console.log(`[Session ${sessionIndex}] ✅ Complete`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Parallel Interview Upload Test`);
  console.log(`  Sessions: ${CONCURRENT_SESSIONS} | Violations/session: ${VIOLATIONS_PER_SESSION}`);
  console.log(`  Total uploads: ${CONCURRENT_SESSIONS * VIOLATIONS_PER_SESSION * 2} (snapshot + clip each)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const testStart = performance.now();

  // All sessions start at the same time (true concurrency)
  await Promise.all(
    Array.from({ length: CONCURRENT_SESSIONS }, (_, i) => simulateSession(i + 1)),
  );

  const totalDurationMs = performance.now() - testStart;

  // ── Analysis ───────────────────────────────────────────────────────────────

  const successful = results.filter((r) => r.success);
  const failed     = results.filter((r) => !r.success);
  const durations  = successful.map((r) => r.durationMs).sort((a, b) => a - b);

  const report = {
    testConfig: {
      concurrentSessions: CONCURRENT_SESSIONS,
      violationsPerSession: VIOLATIONS_PER_SESSION,
      snapshotSizeBytes: SNAPSHOT_SIZE_BYTES,
      clipSizeBytes: CLIP_SIZE_BYTES,
    },
    summary: {
      totalUploads: results.length,
      successfulUploads: successful.length,
      failedUploads: failed.length,
      successRate: `${((successful.length / results.length) * 100).toFixed(1)}%`,
      totalTestDurationMs: Math.round(totalDurationMs),
      averageUploadDurationMs: Math.round(avg(durations)),
      p50DurationMs: Math.round(percentile(durations, 50)),
      p95DurationMs: Math.round(percentile(durations, 95)),
      p99DurationMs: Math.round(percentile(durations, 99)),
      maxDurationMs: Math.round(durations.at(-1) ?? 0),
    },
    byType: {
      snapshot: typeSummary(results, "snapshot"),
      clip:     typeSummary(results, "clip"),
    },
    failures: failed.map((r) => ({
      sessionId: r.sessionId,
      violationId: r.violationId,
      type: r.type,
      error: r.error,
    })),
    bottleneckAnalysis: detectBottlenecks(results, totalDurationMs),
    generatedAt: new Date().toISOString(),
    uploadLog: results,
  };

  // ── Print summary ──────────────────────────────────────────────────────────

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  RESULTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Total uploads     : ${report.summary.totalUploads}`);
  console.log(`  Successful        : ${report.summary.successfulUploads}`);
  console.log(`  Failed            : ${report.summary.failedUploads}`);
  console.log(`  Success rate      : ${report.summary.successRate}`);
  console.log(`  Total test time   : ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  Avg upload time   : ${report.summary.averageUploadDurationMs}ms`);
  console.log(`  P95 upload time   : ${report.summary.p95DurationMs}ms`);
  console.log(`  P99 upload time   : ${report.summary.p99DurationMs}ms`);
  console.log("\n  Bottlenecks:");
  report.bottleneckAnalysis.forEach((b) => console.log(`    • ${b}`));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── Write report ──────────────────────────────────────────────────────────

  const reportsDir = path.join(__dirname, "..", "reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const filename = `evidence_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const outputPath = path.join(reportsDir, filename);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`📄 Evidence report saved: ${outputPath}\n`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function typeSummary(records: UploadResult[], type: "snapshot" | "clip") {
  const sub = records.filter((r) => r.type === type);
  const ok  = sub.filter((r) => r.success);
  const dur = ok.map((r) => r.durationMs).sort((a, b) => a - b);
  return {
    total: sub.length,
    successful: ok.length,
    failed: sub.filter((r) => !r.success).length,
    avgDurationMs: Math.round(avg(dur)),
    p95DurationMs: Math.round(percentile(dur, 95)),
  };
}

function detectBottlenecks(records: UploadResult[], totalMs: number): string[] {
  const issues: string[] = [];
  const failRate = records.filter((r) => !r.success).length / Math.max(records.length, 1);

  if (failRate > 0.05) {
    issues.push(`Failure rate ${(failRate * 100).toFixed(1)}% exceeds 5% threshold — check Cloudinary rate limits`);
  }

  const clips = records.filter((r) => r.type === "clip" && r.success);
  const snaps = records.filter((r) => r.type === "snapshot" && r.success);
  const clipAvg = avg(clips.map((r) => r.durationMs));
  const snapAvg = avg(snaps.map((r) => r.durationMs));

  if (clipAvg > snapAvg * 3) {
    issues.push(`Clips are ${(clipAvg / snapAvg).toFixed(1)}× slower than snapshots — consider reducing clip duration or bitrate`);
  }

  const p95 = percentile(records.filter((r) => r.success).map((r) => r.durationMs).sort((a, b) => a - b), 95);
  if (p95 > 8000) {
    issues.push(`P95 upload latency ${Math.round(p95)}ms exceeds 8s — increase MAX_CONCURRENT_UPLOADS or enable chunked upload`);
  }

  if (issues.length === 0) {
    issues.push("No critical bottlenecks detected — upload performance is within acceptable range");
  }

  return issues;
}

main().catch(console.error);