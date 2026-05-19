// LINE webhook receiver — logs incoming events so we can capture group/user IDs
// from the Supabase Edge Function logs. Public endpoint (verify_jwt=false).
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const events = Array.isArray(body?.events) ? body.events : [];

    for (const event of events) {
      const type = event?.type;
      const src = event?.source ?? {};
      console.log("LINE EVENT:", JSON.stringify({ type, source: src }));

      if (type === "join" || type === "message") {
        if (src.groupId) console.log("LINE GROUP ID CAUGHT:", src.groupId);
        if (src.roomId) console.log("LINE ROOM ID CAUGHT:", src.roomId);
        if (src.userId) console.log("LINE USER ID CAUGHT:", src.userId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("line-webhook error:", err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, // LINE expects 200 to avoid retries
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
