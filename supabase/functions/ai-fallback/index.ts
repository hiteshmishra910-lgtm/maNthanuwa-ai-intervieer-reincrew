import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { callLLM } from "../_shared/aiClient.ts";
import { authenticateRequest, AuthError } from "../_shared/auth.ts";

// Fallback has a higher rate limit than openrouter-proxy since it IS the fallback.
// If openrouter-proxy hit its 30-request cap, the client retries here.
const MAX_REQUESTS_PER_SESSION = 50;

serve(async (req) => {
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Supabase credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Centralized Authentication (Strict Clerk JWKS Verification)
    try {
      await authenticateRequest(req, supabaseAdmin);
    } catch (authErr: any) {
      const status = authErr instanceof AuthError ? authErr.status : 401;
      return new Response(
        JSON.stringify({ error: authErr.message, details: authErr.details }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Parse request body
    const { prompt, purpose, sessionId, traceId, systemPrompt, userPrompt, tier, paidModel, preventAutoEscalation } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (prompt.length > 15000) {
      return new Response(
        JSON.stringify({ error: "Prompt exceeds maximum length of 15,000 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Session ownership validation
    if (sessionId) {
      const { data: sessionRecord, error: sessionError } = await supabaseAdmin
        .from("interview_sessions")
        .select("id")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError || !sessionRecord) {
        return new Response(
          JSON.stringify({ error: "Access Denied: Interview session not found." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4. Rate limiting — server-side free-tier request cap.
      // Only free-tier rows count: paid calls must not exhaust the free budget,
      // otherwise a session that escalated to paid would get blocked here.
      const { count, error: countError } = await supabaseAdmin
        .from("ai_provider_logs")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("provider_tier", "free");

      if (countError) {
        console.error(`[ai-fallback] Database error checking rate limit for session ${sessionId}:`, countError);
        return new Response(
          JSON.stringify({ error: "Service unavailable: Unable to verify rate limits.", code: "RATE_LIMIT_CHECK_FAILED" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (count !== null && count >= MAX_REQUESTS_PER_SESSION) {
        console.warn(`[ai-fallback] Rate limit reached for session ${sessionId}: ${count} free-tier requests`);
        return new Response(
          JSON.stringify({ error: `Rate limit exceeded: maximum ${MAX_REQUESTS_PER_SESSION} free-tier AI requests for this session.`, code: "RATE_LIMITED" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      functionName: "ai-fallback",
      tier: tier === "paid" ? "paid" : "free",
      paidModel,
      preventAutoEscalation,
    });

    // Attach traceId telemetry tag if present
    if (traceId) {
      (data.telemetry as any).traceId = traceId;
    }

    // Log successful call telemetry to ai_provider_logs (non-blocking)
    if (sessionId) {
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
        console.warn("[ai-fallback] Failed to log provider call:", logErr);
      }
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
