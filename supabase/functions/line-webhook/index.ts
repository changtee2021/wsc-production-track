// LINE webhook receiver — verifies the x-line-signature HMAC before logging events.
// Public endpoint (verify_jwt=false). Requires LINE_CHANNEL_SECRET to be set; if
// absent the webhook returns 503 so a missing secret can't silently allow forged events.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createHmac, timingSafeEqual } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-line-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get("LINE_CHANNEL_SECRET");
  if (!secret) {
    console.error("line-webhook: LINE_CHANNEL_SECRET is not configured");
    return new Response("Server not configured", { status: 503, headers: corsHeaders });
  }

  try {
    const sigHeader = req.headers.get("x-line-signature") ?? "";
    const bodyText = await req.text();
    const expected = createHmac("sha256", secret).update(bodyText).digest("base64");
    const sigBuf = Buffer.from(sigHeader, "base64");
    const expBuf = Buffer.from(expected, "base64");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const body = JSON.parse(bodyText || "{}");
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
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
