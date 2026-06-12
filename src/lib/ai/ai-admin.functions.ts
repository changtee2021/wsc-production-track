// Admin AI assistant — uses AI SDK with tool calling against Lovable AI Gateway.
// The model picks which Supabase queries to run via the tools defined in
// ai-admin-tools.server.ts, so it can answer about production, QC, packing,
// maintenance, spare parts, office supplies/requests, expenses, depreciation,
// and announcements without us stuffing all data into the context.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { adminTools } from "@/lib/ai/ai-admin-tools.server";

const DAILY_LIMIT = 40;
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
  content: z.string().min(1).max(4000),
});

export const aiAdminAsk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        mode: z.enum(["qa", "plan"]).default("qa"),
        messages: z.array(msgSchema).min(1).max(16),
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

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });
    const model = provider("google/gemini-2.5-flash");

    const modeRule =
      data.mode === "plan"
        ? "โหมดวางแผน: ใช้ตัวเลขจาก tools เพื่อแนะนำการจัดคน/ลำดับงาน/จุดที่ควรปรับปรุง"
        : "โหมดถาม-ตอบ: ตอบคำถามจากผล tools ให้ตรงประเด็น";

    const system = [
      "คุณคือผู้ช่วยแอดมินของระบบ WSC ProductionTrack — แอปจัดการโรงงานผลิตม่าน",
      "ใช้ tools ที่มีเพื่อดึงข้อมูลจริงก่อนตอบ ห้ามเดาตัวเลข ห้ามแต่งข้อมูล",
      "ขอบเขตข้อมูล: การผลิต, QC, packing, ซ่อมบำรุง, อะไหล่, สินทรัพย์ออฟฟิศ, ใบเบิกของ, ค่าใช้จ่าย/VAT, ค่าเสื่อมราคา, ประกาศ",
      "ถ้าผู้ใช้ถามนอกขอบเขต ให้ตอบสั้นๆ ว่า 'ขออภัย ตอบได้เฉพาะเรื่องในระบบ WSC เท่านั้น'",
      "ตอบเป็นภาษาไทย กระชับ ใช้ markdown (bullet/ตาราง) เมื่อช่วยให้อ่านง่าย ไม่เกิน 12 บรรทัด",
      "ถ้าข้อมูลที่ tool คืนมาเป็น 0 หรือว่าง ให้บอกตรงๆ ไม่ต้องคาดเดา",
      modeRule,
    ].join("\n");

    try {
      const modelMessages: ModelMessage[] = data.messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await generateText({
        model,
        system,
        messages: modelMessages,
        tools: adminTools,
        stopWhen: stepCountIs(50),
      });

      const toolsUsed = Array.from(
        new Set(result.steps.flatMap((s) => s.toolCalls?.map((c) => c.toolName) ?? [])),
      );
      const reply = result.text?.trim() || "(ไม่มีคำตอบ)";
      return { ok: true as const, reply, remaining: quota.remaining, toolsUsed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "เรียก AI ไม่สำเร็จ";
      console.error("aiAdminAsk error", e);
      if (/429/.test(msg)) return { ok: false as const, error: "AI ใช้งานหนัก ลองใหม่อีกครู่" };
      if (/402/.test(msg))
        return { ok: false as const, error: "เครดิต AI หมด — เพิ่มเครดิตที่ Settings → Workspace" };
      return { ok: false as const, error: msg };
    }
  });
