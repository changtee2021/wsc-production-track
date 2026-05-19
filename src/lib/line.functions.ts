// Admin-only: send a comprehensive daily business overview via LINE Messaging
// API push to a group. Aggregates Production (overall + per category) + QC stats
// for today (Bangkok TZ).
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

type ProdStats = { newJobs: number; inProgress: number; finished: number };

// Friendly display name (Thai) — strips leading "1." numbering and
// Burmese translation that may follow in the categories.name column.
function prettyCategoryName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^\d+\.\s*/, "");
  // Take the first whitespace-delimited Thai chunk
  const parts = s.split(/\s+/);
  return parts[0] || s;
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

    // --- Categories ---
    const { data: catRows, error: catErr } = await supabaseAdmin
      .from("categories")
      .select("id, name, active")
      .eq("active", true)
      .order("name");
    if (catErr) throw new Error(`DB error (categories): ${catErr.message}`);
    const categories = (catRows ?? []).map((c) => ({
      id: c.id as string,
      name: prettyCategoryName(String(c.name)),
    }));

    // --- Production: today's logs (start/finish) ---
    const { data: prodRows, error: prodErr } = await supabaseAdmin
      .from("production_logs")
      .select("job_id, action, created_at, category_id")
      .gte("created_at", since);
    if (prodErr) throw new Error(`DB error (production_logs): ${prodErr.message}`);

    // Compute prior job_ids in one query (only for today's job_ids)
    const todayAllJobs = Array.from(
      new Set((prodRows ?? []).map((r) => r.job_id).filter(Boolean) as string[]),
    );
    let priorJobSet = new Set<string>();
    if (todayAllJobs.length > 0) {
      const { data: priorRows, error: priorErr } = await supabaseAdmin
        .from("production_logs")
        .select("job_id")
        .in("job_id", todayAllJobs)
        .lt("created_at", since);
      if (priorErr) throw new Error(`DB error (prior jobs): ${priorErr.message}`);
      priorJobSet = new Set((priorRows ?? []).map((r) => r.job_id as string));
    }

    function computeStats(rows: typeof prodRows): ProdStats {
      const started = new Set<string>();
      const finished = new Set<string>();
      for (const r of rows ?? []) {
        if (!r.job_id) continue;
        if (r.action === "start") started.add(r.job_id);
        else if (r.action === "finish") finished.add(r.job_id);
      }
      const todayJobs = Array.from(new Set([...started, ...finished]));
      const newJobs = todayJobs.filter((j) => !priorJobSet.has(j)).length;
      const finishedCount = finished.size;
      const inProgress = Array.from(started).filter((j) => !finished.has(j)).length;
      return { newJobs, inProgress, finished: finishedCount };
    }

    // Overall
    const overallStats = computeStats(prodRows);

    // Per-category (filter the same prodRows we already loaded)
    const perCategory: Array<{ name: string; stats: ProdStats }> = categories.map((c) => ({
      name: c.name,
      stats: computeStats((prodRows ?? []).filter((r) => r.category_id === c.id)),
    }));

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
        ? `⚠️ แจ้งเตือนพิเศษ:\n${failedDetails.join("\n")}`
        : `⚠️ แจ้งเตือนพิเศษ: ไม่มี`;

    // --- AI Daily Analysis (Lovable AI Gateway) ---
    let aiAnalysis = "";
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (lovableKey) {
      try {
        const stats = {
          date: dateStr,
          overall: overallStats,
          perCategory,
          qc: { total: qcTotal, passed: qcPassed, failed: qcFailed },
          failedDetails,
        };
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "คุณเป็นผู้ช่วยวิเคราะห์ข้อมูลการผลิตและ QC ของโรงงานม่าน/มู่ลี่ ให้สรุปภาพรวมประจำวันแบบกระชับ 3-5 บรรทัด ภาษาไทย เน้น: (1) ภาพรวมโดยรวม (2) ข้อสังเกตหมวดที่โดดเด่นหรือน่าห่วง (3) คำแนะนำเชิงปฏิบัติสั้นๆ ห้ามใส่หัวข้อ ห้ามใส่ markdown ห้ามใส่ bullet",
              },
              {
                role: "user",
                content: `ข้อมูลวันนี้: ${JSON.stringify(stats)}`,
              },
            ],
          }),
        });
        if (aiRes.ok) {
          const j = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
          aiAnalysis = j.choices?.[0]?.message?.content?.trim() ?? "";
        }
      } catch {
        // AI optional - skip on error
      }
    }

    const aiSection = aiAnalysis ? `\n\n🧠 บทวิเคราะห์ประจำวัน (AI)\n${aiAnalysis}` : "";

    // Per-category sections
    const categorySections = perCategory
      .map(
        (c) =>
          `📦 การผลิตหมวด${c.name}\n` +
          `- งานใหม่วันนี้: ${c.stats.newJobs} รายการ\n` +
          `- กำลังดำเนินการ: ${c.stats.inProgress} รายการ\n` +
          `- ผลิตเสร็จสิ้น: ${c.stats.finished} รายการ`,
      )
      .join("\n\n");

    const text =
      `🚀 [WSC Production]\n` +
      `สรุปภาพรวมประจำวันที่ ${dateStr}\n` +
      `\n` +
      `📦 ภาพรวมการผลิต (Production)\n` +
      `- งานใหม่วันนี้: ${overallStats.newJobs} รายการ\n` +
      `- กำลังดำเนินการ: ${overallStats.inProgress} รายการ\n` +
      `- ผลิตเสร็จสิ้น: ${overallStats.finished} รายการ\n` +
      `\n` +
      `${categorySections}\n` +
      `\n` +
      `🔍 หมวดตรวจสอบ (QC)\n` +
      `- ตรวจสอบแล้ว: ${qcTotal} รายการ\n` +
      `- ✅ ผ่านมาตรฐาน: ${qcPassed}\n` +
      `- ❌ พบจุดบกพร่อง: ${qcFailed}\n` +
      `\n` +
      `${alertSection}\n` +
      `\n` +
      `📱 ลิงก์เข้าดูระบบ: ${appUrl}` +
      aiSection;

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
      overall: overallStats,
      perCategory,
      qc: { total: qcTotal, passed: qcPassed, failed: qcFailed },
    };
  });
