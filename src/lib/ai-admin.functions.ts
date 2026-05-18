// Admin AI assistant server function — calls Lovable AI Gateway with a small
// summarized context from Supabase. Limits replies short and tracks per-token
// daily message quota in memory.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";

const DAILY_LIMIT = 20;
const usage = new Map<string, { date: string; count: number }>();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function bump(token: string): { ok: boolean; remaining: number } {
  const d = today();
  const cur = usage.get(token);
  if (!cur || cur.date !== d) {
    usage.set(token, { date: d, count: 1 });
    return { ok: true, remaining: DAILY_LIMIT - 1 };
  }
  if (cur.count >= DAILY_LIMIT) return { ok: false, remaining: 0 };
  cur.count += 1;
  return { ok: true, remaining: DAILY_LIMIT - cur.count };
}

const msgSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

async function buildContext() {
  // 30-day window
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [logsRes, qcRes, empRes, stepRes, catRes] = await Promise.all([
    supabaseAdmin
      .from("production_logs")
      .select(
        "job_id, action, created_at, employee_id, step_id, category_id, employees(name), steps(step_name), categories(name)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin
      .from("qc_reports")
      .select("status, created_at, job_id")
      .gte("created_at", since),
    supabaseAdmin.from("employees").select("name, active").eq("active", true),
    supabaseAdmin.from("steps").select("step_name, std_duration_minutes").eq("active", true),
    supabaseAdmin.from("categories").select("name").eq("active", true),
  ]);

  const logs = (logsRes.data ?? []) as Array<{
    job_id: string;
    action: string;
    created_at: string;
    employee_id: string;
    step_id: string;
    employees: { name: string } | null;
    steps: { step_name: string } | null;
    categories: { name: string } | null;
  }>;

  // Pair start/finish per job+employee+step to compute durations.
  type Key = string;
  const starts = new Map<Key, string>();
  const perEmployee = new Map<string, { jobs: Set<string>; totalMin: number; count: number }>();
  const perStep = new Map<string, { count: number; totalMin: number }>();
  const perCategory = new Map<string, number>();

  // Process oldest first
  const sorted = [...logs].reverse();
  for (const r of sorted) {
    const empName = r.employees?.name ?? "?";
    const stepName = r.steps?.step_name ?? "?";
    const catName = r.categories?.name ?? "ไม่ระบุ";
    const k: Key = `${r.job_id}|${r.employee_id}|${r.step_id}`;
    if (r.action === "start") {
      starts.set(k, r.created_at);
    } else if (r.action === "finish") {
      const startedAt = starts.get(k);
      const mins = startedAt
        ? Math.max(0, (new Date(r.created_at).getTime() - new Date(startedAt).getTime()) / 60000)
        : 0;
      starts.delete(k);
      const e = perEmployee.get(empName) ?? { jobs: new Set(), totalMin: 0, count: 0 };
      e.jobs.add(r.job_id);
      e.totalMin += mins;
      e.count += 1;
      perEmployee.set(empName, e);
      const s = perStep.get(stepName) ?? { count: 0, totalMin: 0 };
      s.count += 1;
      s.totalMin += mins;
      perStep.set(stepName, s);
      perCategory.set(catName, (perCategory.get(catName) ?? 0) + 1);
    }
  }

  const employees = [...perEmployee.entries()]
    .map(([name, v]) => ({
      name,
      jobs: v.jobs.size,
      finished: v.count,
      avgMin: v.count ? Math.round(v.totalMin / v.count) : 0,
    }))
    .sort((a, b) => b.finished - a.finished)
    .slice(0, 20);

  const steps = [...perStep.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      avgMin: v.count ? Math.round(v.totalMin / v.count) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const categories = [...perCategory.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const qcRows = (qcRes.data ?? []) as Array<{ status: string }>;
  const qc = {
    total: qcRows.length,
    open: qcRows.filter((r) => r.status === "open").length,
    resolved: qcRows.filter((r) => r.status === "resolved").length,
  };

  return {
    period: "30 วันล่าสุด",
    activeEmployees: (empRes.data ?? []).length,
    activeSteps: (stepRes.data ?? []).length,
    activeCategories: (catRes.data ?? []).length,
    employees,
    steps,
    categories,
    qc,
  };
}

export const aiAdminAsk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        mode: z.enum(["qa", "plan"]).default("qa"),
        messages: z.array(msgSchema).min(1).max(12),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) {
      return { ok: false as const, error: "Unauthorized" };
    }
    const quota = bump(data.token);
    if (!quota.ok) {
      return {
        ok: false as const,
        error: `เกินโควต้าวันนี้ (${DAILY_LIMIT} ข้อความ/วัน) ลองใหม่พรุ่งนี้`,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "LOVABLE_API_KEY ไม่ได้ตั้งค่า" };

    let ctx: unknown = {};
    try {
      ctx = await buildContext();
    } catch (e) {
      console.error("buildContext error", e);
    }

    const modeRule =
      data.mode === "plan"
        ? "โหมดวางแผน: แนะนำการจัดคน/ลำดับงาน/จุดที่ควรปรับปรุง โดยอ้างอิงตัวเลขจาก context"
        : "โหมดถาม-ตอบ: ตอบคำถามจาก context ให้ชัด ตรงประเด็น";

    const system = [
      "คุณคือผู้ช่วยแอดมินของระบบติดตามการผลิตม่าน WSC ProductionTrack",
      "ตอบเฉพาะเรื่องในแอปนี้ (พนักงาน, ขั้นตอนผลิต, หมวดหมู่งาน, จำนวนชุด, เวลา, รายงาน QC)",
      "ถ้าผู้ใช้ถามนอกเรื่อง ให้ตอบสั้นๆ ว่า 'ขออภัย ตอบได้เฉพาะเรื่องในระบบ WSC เท่านั้น'",
      "ตอบเป็นภาษาไทย สั้น กระชับ ใช้ bullet ไม่เกิน 6 บรรทัด",
      modeRule,
      "ข้อมูลสรุปจากระบบ (JSON):",
      JSON.stringify(ctx),
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          max_tokens: 400,
          messages: [
            { role: "system", content: system },
            ...data.messages.slice(-6),
          ],
        }),
      });
      if (res.status === 429) {
        return { ok: false as const, error: "AI ใช้งานหนาก ลองใหม่อีกครู่" };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "เครดิต AI หมด — เพิ่มเครดิตที่ Settings → Workspace" };
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: `AI error ${res.status}` };
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = json.choices?.[0]?.message?.content?.trim() ?? "(ไม่มีคำตอบ)";
      return { ok: true as const, reply, remaining: quota.remaining };
    } catch (e) {
      console.error("AI fetch error", e);
      return { ok: false as const, error: "เรียก AI ไม่สำเร็จ" };
    }
  });
