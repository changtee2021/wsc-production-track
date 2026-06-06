// Admin-only: read/update the daily LINE send schedule stored in app_settings.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const adminGetLineSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["line_daily_send_time", "line_daily_last_sent_date"]);
    if (error) throw new Error(error.message);
    const map = new Map((rows ?? []).map((r) => [r.key as string, r.value as Record<string, unknown>]));
    const conf = map.get("line_daily_send_time") ?? {};
    const last = map.get("line_daily_last_sent_date") ?? {};
    return {
      time: (typeof conf.time === "string" ? conf.time : "08:30") as string,
      enabled: conf.enabled !== false,
      lastSentDate: (typeof last.date === "string" ? last.date : null) as string | null,
    };
  });

export const adminSetLineSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string(),
        time: z.string().regex(TIME_RE, "เวลาไม่ถูกต้อง (HH:MM)"),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        key: "line_daily_send_time",
        value: { time: data.time, enabled: data.enabled },
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true as const, time: data.time, enabled: data.enabled };
  });
