import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCorsHeaders } from "../_shared/cors.ts";

import { loadSession } from "./sessionLoader.ts";
import { callOpenRouter } from "./openRouterClient.ts";
import { parseEvaluationResult } from "./evaluationParser.ts";
import { saveEvaluationResults, markJobFailed } from "./databaseUpdater.ts";

import { buildBatchEvaluationPrompt } from "../_shared_generated/promptBuilder.ts";
import { buildHybridReport } from "../_shared_generated/hybridReportBuilder.ts";

serve(async (req) => {
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase credentials." }), { status: 500, headers: corsHeaders });
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let sessionId = "";
  try {
    const body = await req.json();
    sessionId = body.record?.session_id || body.sessionId || body.session_id;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId in request payload." }), { status: 400, headers: corsHeaders });
    }

    console.log(`[Hybrid] Processing job for session ${sessionId}`);

    // 1. Load Data
    console.log(`[Hybrid] Step 1: Loading session data...`);
    const { session, responses, integrityScore } = await loadSession(supabaseAdmin, sessionId);
    console.log(`[Hybrid] Step 1a: Loaded ${responses?.length || 0} responses, integrityScore=${integrityScore}`);
    if (!responses || responses.length === 0) {
      console.warn(`[Hybrid] No responses found for session ${sessionId}`);
      await markJobFailed(supabaseAdmin, sessionId, "No candidate responses found to evaluate.", false);
      return new Response(JSON.stringify({ error: "No candidate responses found to evaluate." }), { status: 400, headers: corsHeaders });
    }

    // 2. Prompt Builder
    console.log(`[Hybrid] Prompt generated`);
    const promptData = {
      items: responses.map((r: any) => ({
        question: r.question_text ?? r.question,
        ideal_answer: r.ideal_answer,
        type: r.type,
        checklist: r.checklist,
        answer: r.candidate_answer ?? r.transcript ?? r.answer ?? "UNATTEMPTED"
      }))
    };
    const { systemPrompt, userPrompt, promptVersion } = buildBatchEvaluationPrompt(promptData);

    // 3. Call OpenRouter with retries
    console.log(`[Hybrid] Step 3: Calling OpenRouter LLM...`);
    let aiResult: any = null;
    let isRetryable = true;
    try {
      aiResult = await callOpenRouter(systemPrompt, userPrompt);
      console.log(`[Hybrid] Step 3a: ✅ LLM response received (${aiResult.content?.length || 0} chars)`);
    } catch (err: any) {
      console.warn(`[Hybrid] LLM invocation failed:`, err);
      const msg = err.message || "AI invocation failed";

      // Surface API key / credit issues clearly so the team can act on them
      let userFacingMsg = msg;
      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Invalid API key')) {
        userFacingMsg = 'OPENROUTER_API_KEY is invalid or missing. Set it via: supabase secrets set OPENROUTER_API_KEY=your_key';
        isRetryable = false;
      } else if (msg.includes('402') || msg.includes('credits') || msg.includes('payment') || msg.includes('quota')) {
        userFacingMsg = 'OpenRouter account has no credits remaining. Top up at https://openrouter.ai/settings/credits';
        isRetryable = false;
      } else if (msg.includes('429') || msg.includes('Rate limit')) {
        userFacingMsg = 'OpenRouter rate limit hit. Will retry automatically.';
        isRetryable = true;
      } else if (msg.includes('permanent error')) {
        isRetryable = false;
      }

      console.error(`[Hybrid] LLM ERROR: ${userFacingMsg}`);
      await markJobFailed(supabaseAdmin, sessionId, userFacingMsg, isRetryable);
      return new Response(JSON.stringify({ error: userFacingMsg }), { status: 500, headers: corsHeaders });
    }

    // 4. Parse & Validate JSON
    console.log(`[Hybrid] Step 4: Parsing LLM response...`);
    const parsedResults = parseEvaluationResult(aiResult.content);
    console.log(`[Hybrid] Step 4a: Parsed ${parsedResults.length} question results`);

    // 5. Build Final Report
    // Pass original response data so buildHybridReport can populate
    // questionText, userAnswer, and difficulty in questionBreakdown.
    const responsesData = responses.map((r: any) => ({
      questionText: r.question_text ?? r.question,
      type: r.type,
      answer: r.candidate_answer ?? r.transcript ?? r.answer ?? "UNATTEMPTED",
    }));
    console.log(`[Hybrid] Step 5: Building hybrid report...`);
    // `accuracy` is a per-question score on a 0-10 scale; every downstream consumer
    // (overall_score, total_score, technicalScore, computeRecommendation thresholds) expects
    // the 0-100 aggregate scale. buildHybridReport owns that conversion and is unit-tested
    // in tests/scoringPolicy.test.ts.
    const report: any = buildHybridReport(parsedResults, integrityScore, responsesData);
    
    // Embed evaluation metadata 
    report.metadata = {
      ...report.metadata,
      hybridSynthesis: 'success',
      promptVersion,
      ...(aiResult.metadata || {})
    };

    // 6. Save Results
    console.log(`[Hybrid] Step 6: Saving results to database...`);
    await saveEvaluationResults(supabaseAdmin, sessionId, report, report.metadata);

    console.log(`[Hybrid] ✅ Processing complete for ${sessionId}`);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("[Hybrid] Edge Function Unhandled Error:", err);
    if (sessionId) {
      await markJobFailed(supabaseAdmin, sessionId, err.message || "Unknown error", true);
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
