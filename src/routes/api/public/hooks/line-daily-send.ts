// Public cron endpoint — pg_cron hits this every minute.
// Reads the configured Bangkok HH:MM, and if it matches (within a small
// window) and we haven't already sent today, sends the daily summary.
//
// Auth: caller MUST present the Supabase anon/publishable key in the
// `apikey` header (the standard pg_cron+pg_net pattern). Without this,
// any external party could trigger or suppress the daily LINE summary.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendDailySummary, bangkokNowParts } from "@/lib/integrations/line.server";

function isAuthorized(req: Request): boolean {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!expected) return false;
  const apikey = req.headers.get("apikey") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return apikey === expected || bearer === expected;
}

export const Route = createFileRoute("/api/public/hooks/line-daily-send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response("Forbidden", { status: 403 });
        }

        const { hhmm, ymd } = bangkokNowParts();

        const { data: rows, error } = await supabaseAdmin
          .from("app_settings")
          .select("key, value")
          .in("key", ["line_daily_send_time", "line_daily_last_sent_date"]);
        if (error) {
          return Response.json({ ok: false }, { status: 500 });
        }
        const map = new Map(
          (rows ?? []).map((r) => [r.key as string, r.value as Record<string, unknown>]),
        );
        const conf = map.get("line_daily_send_time") ?? {};
        const lastVal = map.get("line_daily_last_sent_date") ?? {};
        const targetTime = typeof conf.time === "string" ? conf.time : "08:30";
        const enabled = conf.enabled !== false;
        const lastSent = typeof lastVal.date === "string" ? lastVal.date : null;

        // Minimal responses — do not leak scheduling config to callers.
        if (!enabled) return Response.json({ ok: true, skipped: "disabled" });
        if (lastSent === ymd) return Response.json({ ok: true, skipped: "already-sent-today" });
        if (hhmm !== targetTime) return Response.json({ ok: true, skipped: "not-time" });

        try {
          // Mark as sent FIRST to avoid double-send if minute spans two ticks.
          const { error: upErr } = await supabaseAdmin.from("app_settings").upsert({
            key: "line_daily_last_sent_date",
            value: { date: ymd },
            updated_at: new Date().toISOString(),
          });
          if (upErr) throw new Error(upErr.message);

          const result = await sendDailySummary();
          return Response.json({ sent: true, ...result });
        } catch {
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
