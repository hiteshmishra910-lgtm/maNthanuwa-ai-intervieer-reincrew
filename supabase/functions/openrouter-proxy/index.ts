import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { callLLM } from "../_shared/aiClient.ts";
import { authenticateRequest, AuthError } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize supabaseAdmin early
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Supabase credentials." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Centralized Authentication (Strict Clerk JWKS Verification)
    let callerClerkUserId: string;
    try {
      const authResult = await authenticateRequest(req, supabaseAdmin);
      callerClerkUserId = authResult.userId;
    } catch (authErr: any) {
      const status = authErr instanceof AuthError ? authErr.status : 401;
      return new Response(
        JSON.stringify({ error: authErr.message, details: authErr.details }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, purpose, sessionId, systemPrompt, userPrompt, tier, paidModel } = await req.json();

    // 2. Session Ownership Validation
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: sessionId" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Join interview_sessions → candidates to verify session validity
    const { data: sessionRecord, error: sessionError } = await supabaseAdmin
      .from("interview_sessions")
      .select("id, candidates(clerk_user_id)")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !sessionRecord) {
      return new Response(
        JSON.stringify({ error: "Access Denied: Interview session not found." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionOwnerClerkId = (sessionRecord as any)?.candidates?.clerk_user_id;
    if (sessionOwnerClerkId && sessionOwnerClerkId !== callerClerkUserId) {
      console.warn(`[openrouter-proxy] Session caller discrepancy. Caller: ${callerClerkUserId}, Owner: ${sessionOwnerClerkId}`);
    }

    // 3. Rate Limiting — Server-side request cap (30 per session)
    const MAX_REQUESTS_PER_SESSION = 30;
    try {
      const { count, error: countError } = await supabaseAdmin
        .from("ai_provider_logs")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);

      if (countError) {
        console.error(`[openrouter-proxy] Database error checking rate limit for session ${sessionId}:`, countError);
        return new Response(
          JSON.stringify({
            error: "Service unavailable: Unable to verify rate limits due to a database store issue.",
            code: "RATE_LIMIT_CHECK_FAILED",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (count !== null && count >= MAX_REQUESTS_PER_SESSION) {
        console.warn(`[openrouter-proxy] Rate limit reached for session ${sessionId}: ${count} requests`);
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded: You have reached the maximum number of AI requests for this session (30).",
            code: "RATE_LIMITED",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (rateErr) {
      console.error("[openrouter-proxy] Exception during rate limit check:", rateErr);
      return new Response(
        JSON.stringify({
          error: "Service unavailable: Rate limit check failed.",
          code: "RATE_LIMIT_CHECK_FAILED",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate prompt input and sizes (Abuse Protection)
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: prompt" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prompt.length > 15000) {
      return new Response(
        JSON.stringify({ error: "Prompt exceeds safe maximum length of 15,000 characters." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Invoke Unified LLM Client
    const max_tokens = 4000;
    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:3000";
    const data = await callLLM({
      prompt,
      purpose,
      systemPrompt,
      userPrompt,
      maxTokens: max_tokens,
      siteUrl,
      functionName: "openrouter-proxy",
      tier: tier === "paid" ? "paid" : "free",
      paidModel,
    });

    // Log successful call telemetry to ai_provider_logs (non-blocking)
    try {
      await supabaseAdmin.from("ai_provider_logs").insert({
        session_id: sessionId,
        provider_name: data.telemetry.provider,
        model_used: data.telemetry.model,
        purpose: purpose || "unknown",
        response_time_ms: data.telemetry.latencyMs,
        success: true,
        error_type: null,
        response_length: JSON.stringify(data.choices).length,
        provider_tier: data.telemetry.tier || "free",
        fallback_reason: data.telemetry.fallbackReason || null,
      });
    } catch (logErr) {
      console.warn("[openrouter-proxy] Failed to log provider call:", logErr);
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
