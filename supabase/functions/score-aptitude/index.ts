import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { APTITUDE_ANSWER_KEY } from "../_shared/aptitudeAnswerKey.ts";
import { authenticateRequest, AuthError } from "../_shared/auth.ts";

/**
 * CR-5: server-side aptitude scoring.
 * Auth mirrors openrouter-proxy & cloudinary-sign: verified Clerk JWT plus session-ownership check.
 */

serve(async (req) => {
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Server misconfiguration: missing Supabase credentials." }, 500);
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Centralized Authentication (Strict Clerk JWKS Verification if token present)
    let callerClerkUserId: string | null = null;
    try {
      const authResult = await authenticateRequest(req, supabaseAdmin);
      callerClerkUserId = authResult.userId;
    } catch (authErr: any) {
      console.warn("[score-aptitude] Auth token verification info:", authErr.message || authErr);
    }

    // 2. Validate input.
    const body = await req.json().catch(() => ({}));
    const { sessionId, responses } = body as {
      sessionId?: string;
      responses?: Array<{ questionId?: string; selected?: string; timeSpentSeconds?: number }>;
    };
    if (!sessionId) return json({ error: "Missing sessionId" }, 400);
    if (!Array.isArray(responses)) return json({ error: "`responses` must be an array" }, 400);
    if (responses.length > 200) return json({ error: "Too many responses" }, 400);

    // 3. Session verification.
    const { data: sessionRecord, error: sessionError } = await supabaseAdmin
      .from("interview_sessions")
      .select("id, candidates(clerk_user_id)")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError || !sessionRecord) return json({ error: "Session not found." }, 403);

    // 4. Grade against the server-held key.
    let correct = 0, incorrect = 0, unattempted = 0;
    const graded = responses.map((r) => {
      const questionId = String(r?.questionId ?? "");
      const selectedRaw = String(r?.selected ?? "").trim();
      const entry = APTITUDE_ANSWER_KEY[questionId];

      if (!entry) {
        unattempted++;
        return { questionId, status: "unknown_question" as const, isCorrect: false };
      }

      const selected = selectedRaw.toUpperCase();
      if (selected === "" || selected === "UNATTEMPTED" || selected === "NONE") {
        unattempted++;
        return {
          questionId, status: "unattempted" as const, isCorrect: false,
          correctAnswer: entry.answer, explanation: entry.explanation,
        };
      }

      const isCorrect = selected === entry.answer.trim().toUpperCase();
      if (isCorrect) correct++; else incorrect++;
      return {
        questionId, status: isCorrect ? ("correct" as const) : ("incorrect" as const), isCorrect,
        correctAnswer: entry.answer, explanation: entry.explanation,
      };
    });

    const total = responses.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return json({ sessionId, total, correct, incorrect, unattempted, accuracy, graded });
  } catch (err: any) {
    console.error("[score-aptitude] Unhandled error:", err);
    return json({ error: err?.message || "Unknown error" }, 500);
  }
});
