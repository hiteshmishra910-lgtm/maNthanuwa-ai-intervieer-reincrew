import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = resolveCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, drive_id } = await req.json().catch(() => ({}));

    // Validate inputs
    if (!email || !drive_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, drive_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: verify this email is actually invited to this drive
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from("candidate_assignments")
      .select("id, status")
      .eq("college_email", email.toLowerCase().trim())
      .eq("drive_id", drive_id)
      .in("status", ["INVITED", "VERIFIED", "IN_PROGRESS"])
      .maybeSingle();

    if (assignError || !assignment) {
      return new Response(
        JSON.stringify({ error: "Access denied: no active assignment found for this email and drive." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Cloudinary signature
    const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
    const apiKey = Deno.env.get("CLOUDINARY_API_KEY")!;
    const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET")!;

    const folder = "id_proofs";
    const public_id = `${email.replace(/[@.]/g, "_")}_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    // Params must be sorted alphabetically
    const signatureString = `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;

    const hashBuffer = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(signatureString)
    );
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return new Response(
      JSON.stringify({ cloud_name: cloudName, api_key: apiKey, timestamp, signature, folder, public_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});