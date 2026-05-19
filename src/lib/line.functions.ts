// Admin-only: send a daily QC summary via LINE Messaging API push to a group.
// Queries today's qc_reports for total/passed/failed counts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

function startOfTodayBangkokISO(): string {
  // Bangkok = UTC+7. Compute today's 00:00 in Bangkok, return as ISO UTC.
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear();
  const m = bkk.getUTCMonth();
  const d = bkk.getUTCDate();
  // 00:00 Bangkok == previous day 17:00 UTC
  return new Date(Date.UTC(y, m, d, -7, 0, 0)).toISOString();
}

export const adminSendLineTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetId = process.env.LINE_TARGET_GROUP_ID || process.env.LINE_TARGET_USER_ID;
    if (!accessToken) throw new Error("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN");
    if (!targetId) throw new Error("ยังไม่ได้ตั้งค่า LINE_TARGET_GROUP_ID");

    // Query today's QC stats (Bangkok timezone)
    const since = startOfTodayBangkokISO();
    const { data: rows, error } = await supabaseAdmin
      .from("qc_reports")
      .select("overall_result")
      .gte("created_at", since);
    if (error) throw new Error(`DB error: ${error.message}`);

    const total = rows?.length ?? 0;
    let passed = 0;
    let failed = 0;
    for (const r of rows ?? []) {
      const v = String(r.overall_result ?? "").toLowerCase();
      if (v === "pass" || v === "passed" || v === "ผ่าน") passed++;
      else if (v === "fail" || v === "failed" || v === "ไม่ผ่าน") failed++;
    }

    const text =
      `📊 สรุปยอด QC ประจำวัน\n` +
      `รวมทั้งหมด: ${total} รายการ\n` +
      `✅ ผ่าน: ${passed} รายการ\n` +
      `❌ ไม่ผ่าน: ${failed} รายการ`;

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        // ignore
      }
      throw new Error(`LINE API ${res.status}: ${detail || res.statusText}`);
    }

    return { ok: true as const, sentAt: new Date().toISOString(), total, passed, failed };
  });
