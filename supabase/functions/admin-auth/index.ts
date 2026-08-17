import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { resolveCorsHeaders } from "../_shared/cors.ts"

serve(async (req: Request) => {
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "Admin access is now controlled by the Supabase admin_emails setting in system_settings.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
