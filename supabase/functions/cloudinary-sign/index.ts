import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, AuthError } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT — only authenticated users can upload
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Centralized Authentication (Strict Clerk JWKS Verification)
    let callerClerkUserId: string;
    try {
      const authResult = await authenticateRequest(req, supabaseAdmin);
      callerClerkUserId = authResult.userId;
    } catch (authErr: any) {
      const status = authErr instanceof AuthError ? authErr.status : 401;
      return new Response(
        JSON.stringify({ error: authErr.message, details: authErr.details }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { public_id, folder, context, resource_type, sessionId } = body;

    // Authorization: caller must own the session the upload is filed under
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: sessionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: sessionRecord, error: sessionError } = await supabaseAdmin
      .from("interview_sessions")
      .select("id, candidates!inner(clerk_user_id)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionRecord) {
      return new Response(
        JSON.stringify({ error: "Access Denied: Interview session not found." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if ((sessionRecord as any).candidates?.clerk_user_id !== callerClerkUserId) {
      console.warn(`[cloudinary-sign] Ownership mismatch. Caller: ${callerClerkUserId}`);
      return new Response(
        JSON.stringify({ error: "Access Denied: You do not own this interview session." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // The signed public_id must live under this session's namespace
    if (typeof public_id !== "string" || !public_id.includes(sessionId)) {
      return new Response(
        JSON.stringify({ error: "public_id must be scoped to the caller's sessionId." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!public_id || !folder) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: public_id, folder" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
    const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

    if (!cloudName || !apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: "Cloudinary credentials not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build signature params (sorted alphabetically)
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      folder,
      public_id,
      timestamp: String(timestamp),
    };
    if (context) params.context = context;

    const sortedKeys = Object.keys(params).sort();
    const signatureStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("&") + apiSecret;

    // Compute SHA-1 signature
    const msgBuffer = new TextEncoder().encode(signatureStr);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return new Response(
      JSON.stringify({
        signature,
        timestamp,
        api_key: apiKey,
        cloud_name: cloudName,
        folder,
        public_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[cloudinary-sign] Internal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
