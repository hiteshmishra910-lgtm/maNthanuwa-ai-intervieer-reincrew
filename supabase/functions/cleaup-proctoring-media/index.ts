import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCorsHeaders } from "../_shared/cors.ts";

const RETENTION_DAYS = 7;

// These are server-side secrets — safe here, never sent to browser
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─────────────────────────────────────────────
// Extract Cloudinary public_id from URL
// e.g. https://res.cloudinary.com/rskagqpo/image/upload/v123/proctoring-snapshots/abc.jpg
//      → "proctoring-snapshots/abc"
// ─────────────────────────────────────────────
function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Generate Cloudinary auth signature
// Cloudinary needs SHA-1 HMAC signature for deletion
// ─────────────────────────────────────────────
async function generateSignature(
  publicId: string,
  timestamp: number
): Promise<string> {
  const message = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────
// Delete one file from Cloudinary
// ─────────────────────────────────────────────
async function deleteFromCloudinary(
  url: string,
  resourceType: "image" | "video"
): Promise<{ success: boolean; publicId: string | null }> {
  const publicId = extractPublicId(url);
  if (!publicId) {
    console.warn(`[Cleanup] Could not extract public_id from URL: ${url}`);
    return { success: false, publicId: null };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(publicId, timestamp);

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("timestamp", String(timestamp));
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
      { method: "POST", body: formData }
    );

    const result = await response.json();

    if (result.result === "ok" || result.result === "not found") {
      // "not found" means already deleted — treat as success
      console.log(`[Cleanup] Deleted from Cloudinary: ${publicId}`);
      return { success: true, publicId };
    } else {
      console.error(`[Cleanup] Cloudinary rejected deletion:`, result);
      return { success: false, publicId };
    }
  } catch (err) {
    console.error(`[Cleanup] Cloudinary delete error for ${publicId}:`, err);
    return { success: false, publicId };
  }
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
Deno.serve(async (req) => {
  // H-1: this handler previously ignored the request entirely (`_req`) — no token check, no
  // CORS. It runs with the service-role key and permanently deletes proctoring media from
  // Cloudinary, so anyone who knew the URL could force early destruction of evidence and
  // drive up cost. It is a scheduled maintenance job, so it is gated on a shared secret
  // rather than a user JWT.
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const expectedSecret = Deno.env.get("CLEANUP_JOB_SECRET");
  if (!expectedSecret) {
    console.error("[Cleanup] CLEANUP_JOB_SECRET is not configured; refusing to run.");
    return json({ success: false, error: "Server misconfiguration: cleanup secret not set." }, 500);
  }

  const provided =
    req.headers.get("X-Cleanup-Secret") ??
    (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  // Constant-time comparison so the secret cannot be recovered by timing the response.
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expectedSecret);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  if (mismatch !== 0) {
    console.warn("[Cleanup] Rejected unauthorised invocation.");
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Use service role key here — this bypasses RLS safely on server side
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[Cleanup] Starting. Cutoff: ${cutoffISO}`);

    // Fetch expired rows that still have media URLs
    const { data: rows, error } = await supabase
      .from("proctoring_events")
      .select("id, snapshot_url, clip_url, session_id")
      .lte("report_generated_at", cutoffISO)
      .not("report_generated_at", "is", null)
      .or("snapshot_url.not.is.null,clip_url.not.is.null");

    if (error) {
      console.error("[Cleanup] Supabase fetch error:", error.message);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rows || rows.length === 0) {
      console.log("[Cleanup] No expired media found.");
      return new Response(
        JSON.stringify({ success: true, scanned: 0, cleaned: 0, errors: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Cleanup] Found ${rows.length} rows to process.`);

    let cleaned = 0;
    let errors = 0;

    for (const row of rows) {
      let snapshotDeleted = true;
      let clipDeleted = true;

      // Delete snapshot from Cloudinary
      if (row.snapshot_url && !row.snapshot_url.includes("supabase")) {
        const result = await deleteFromCloudinary(row.snapshot_url, "image");
        snapshotDeleted = result.success;
      }

      // Delete clip from Cloudinary
      if (row.clip_url && !row.clip_url.includes("supabase")) {
        const result = await deleteFromCloudinary(row.clip_url, "video");
        clipDeleted = result.success;
      }

      // Only null URLs in Supabase if Cloudinary deletion succeeded
      // This way if Cloudinary fails, we retry next time the function runs
      if (snapshotDeleted && clipDeleted) {
        const { error: updateError } = await supabase
          .from("proctoring_events")
          .update({ snapshot_url: null, clip_url: null })
          .eq("id", row.id);

        if (updateError) {
          console.error(
            `[Cleanup] Failed to null URLs for row ${row.id}:`,
            updateError.message
          );
          errors++;
        } else {
          cleaned++;
        }
      } else {
        // Partial failure — log but don't null the URL, retry next run
        console.warn(
          `[Cleanup] Partial failure for row ${row.id} — will retry next run.`
        );
        errors++;
      }
    }

    console.log(
      `[Cleanup] Done. Scanned: ${rows.length}, Cleaned: ${cleaned}, Errors: ${errors}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        scanned: rows.length,
        cleaned,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Cleanup] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});