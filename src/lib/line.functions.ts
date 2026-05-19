// Admin-only: send a comprehensive daily business overview via LINE Messaging
// API push to a group. Aggregates Production + QC stats for today (Bangkok TZ).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

function startOfTodayBangkokISO(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear();
  const m = bkk.getUTCMonth();
  const d = bkk.getUTCDate();
  return new Date(Date.UTC(y, m, d, -7, 0, 0)).toISOString();
}

function formatBangkokDate(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = bkk.getUTCFullYear() + 543; // Buddhist year
  return `${dd}/${mm}/${yyyy}`;
}

export const adminSendLineTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetId = process.env.LINE_TARGET_GROUP_ID || process.env.LINE_TARGET_USER_ID;
    if (!accessToken) throw new Error("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN");
    if (!targetId) throw new Error("ยังไม่ได้ตั้งค่า LINE_TARGET_GROUP_ID");

    const since = startOfTodayBangkokISO();

    // --- Production: fetch today's logs (start/finish) ---
    const { data: prodRows, error: prodErr } = await supabaseAdmin
      .from("production_logs")
      .select("job_id, action, created_at")
      .gte("created_at", since);
    if (prodErr) throw new Error(`DB error (production_logs): ${prodErr.message}`);

    const startedJobs = new Set<string>();
    const finishedJobs = new Set<string>();
    for (const r of prodRows ?? []) {
      if (!r.job_id) continue;
      if (r.action === "start") startedJobs.add(r.job_id);
      else if (r.action === "finish") finishedJobs.add(r.job_id);
    }

    // "งานใหม่วันนี้" = job_ids that appear today but never existed before today
    const todayJobIds = Array.from(new Set([...startedJobs, ...finishedJobs]));
    let newJobsCount = 0;
    if (todayJobIds.length > 0) {
      const { data: priorRows, error: priorErr } = await supabaseAdmin
        .from("production_logs")
        .select("job_id")
        .in("job_id", todayJobIds)
        .lt("created_at", since);
      if (priorErr) throw new Error(`DB error (prior jobs): ${priorErr.message}`);
      const priorSet = new Set((priorRows ?? []).map((r) => r.job_id));
      newJobsCount = todayJobIds.filter((j) => !priorSet.has(j)).length;
    }
    const finishedCount = finishedJobs.size;
    // In-progress = started today (or new) but not finished today
    const inProgressCount = Array.from(startedJobs).filter(
      (j) => !finishedJobs.has(j),
    ).length;

    // --- QC: today's reports ---
    const { data: qcRows, error: qcErr } = await supabaseAdmin
      .from("qc_reports")
      .select("overall_result, summary, note, job_id")
      .gte("created_at", since);
    if (qcErr) throw new Error(`DB error (qc_reports): ${qcErr.message}`);

    const qcTotal = qcRows?.length ?? 0;
    let qcPassed = 0;
    let qcFailed = 0;
    const failedDetails: string[] = [];
    for (const r of qcRows ?? []) {
      const v = String(r.overall_result ?? "").toLowerCase();
      if (v === "pass" || v === "passed" || v === "ผ่าน") qcPassed++;
      else if (v === "fail" || v === "failed" || v === "ไม่ผ่าน") {
        qcFailed++;
        const detail = r.summary || r.note;
        if (detail && failedDetails.length < 5) {
          failedDetails.push(`• งาน ${r.job_id}: ${String(detail).slice(0, 80)}`);
        } else if (failedDetails.length < 5) {
          failedDetails.push(`• งาน ${r.job_id}`);
        }
      }
    }

    const appUrl = "https://wsc-production-track.lovable.app";
    const dateStr = formatBangkokDate();

    const alertSection =
      qcFailed > 0
        ? `\n⚠️ แจ้งเตือนพิเศษ:\n${failedDetails.join("\n")}`
        : `\n⚠️ แจ้งเตือนพิเศษ: ไม่มี`;

    const text =
      `🚀 [Blacksmith SAAS] สรุปภาพรวมประจำวันที่ ${dateStr}\n\n` +
      `📦 หมวดการผลิต (Production)\n` +
      `- งานใหม่วันนี้: ${newJobsCount} รายการ\n` +
      `- กำลังดำเนินการ: ${inProgressCount} รายการ\n` +
      `- ผลิตเสร็จสิ้น: ${finishedCount} รายการ\n\n` +
      `🔍 หมวดตรวจสอบ (QC)\n` +
      `- ตรวจสอบแล้ว: ${qcTotal} รายการ\n` +
      `- ✅ ผ่านมาตรฐาน: ${qcPassed}\n` +
      `- ❌ พบจุดบกพร่อง: ${qcFailed}\n` +
      `${alertSection}\n\n` +
      `📱 ลิงก์เข้าดูระบบ: ${appUrl}`;

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

    return {
      ok: true as const,
      sentAt: new Date().toISOString(),
      production: { newJobs: newJobsCount, inProgress: inProgressCount, finished: finishedCount },
      qc: { total: qcTotal, passed: qcPassed, failed: qcFailed },
    };
  });
