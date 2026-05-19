// Public cron endpoint — pg_cron hits this every minute.
// Reads the configured Bangkok HH:MM, and if it matches (within a small
// window) and we haven't already sent today, sends the daily summary.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendDailySummary, bangkokNowParts } from "@/lib/line.server";

export const Route = createFileRoute("/api/public/hooks/line-daily-send")({
  server: {
    handlers: {
      POST: async () => {
        const { hhmm, ymd } = bangkokNowParts();

        const { data: rows, error } = await supabaseAdmin
          .from("app_settings")
          .select("key, value")
          .in("key", ["line_daily_send_time", "line_daily_last_sent_date"]);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        const map = new Map(
          (rows ?? []).map((r) => [r.key as string, r.value as Record<string, unknown>]),
        );
        const conf = map.get("line_daily_send_time") ?? {};
        const lastVal = map.get("line_daily_last_sent_date") ?? {};
        const targetTime = typeof conf.time === "string" ? conf.time : "08:30";
        const enabled = conf.enabled !== false;
        const lastSent = typeof lastVal.date === "string" ? lastVal.date : null;

        if (!enabled) {
          return Response.json({ ok: true, skipped: "disabled", now: hhmm });
        }
        if (lastSent === ymd) {
          return Response.json({ ok: true, skipped: "already-sent-today", now: hhmm });
        }
        // Tolerate a small drift (cron may fire a few seconds late).
        if (hhmm !== targetTime) {
          return Response.json({ ok: true, skipped: "not-time", now: hhmm, target: targetTime });
        }

        try {
          // Mark as sent FIRST to avoid double-send if minute spans two ticks.
          const { error: upErr } = await supabaseAdmin.from("app_settings").upsert({
            key: "line_daily_last_sent_date",
            value: { date: ymd },
            updated_at: new Date().toISOString(),
          });
          if (upErr) throw new Error(upErr.message);

          const result = await sendDailySummary();
          return Response.json({ ok: true, sent: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
