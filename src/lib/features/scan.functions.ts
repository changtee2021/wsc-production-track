import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const payload = z.object({
  job_id: z.string().trim().min(1).max(200),
  employee_id: z.string().uuid(),
  step_id: z.string().uuid(),
  category_id: z.string().uuid(),
  action: z.enum(["start", "finish"]),
  note: z.string().trim().max(2000).nullable().optional(),
  note_image_url: z.string().trim().max(2000).nullable().optional(),
});

// In-memory IP rate limit: 60 submissions / minute / IP.
// Mitigates anonymous mass-injection of production logs by external callers.
const submitBuckets = new Map<string, number[]>();
function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}
function checkSubmitLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60_000;
  const arr = (submitBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= 60) { submitBuckets.set(ip, arr); return false; }
  arr.push(now);
  submitBuckets.set(ip, arr);
  return true;
}

export const submitProductionLog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => payload.parse(d))
  .handler(async ({ data }) => {
    if (!checkSubmitLimit(clientIp())) {
      throw new Error("ส่งข้อมูลถี่เกินไป โปรดลองใหม่อีกครั้ง");
    }
    const [emp, step, cat] = await Promise.all([
      supabaseAdmin
        .from("employees")
        .select("id, active")
        .eq("id", data.employee_id)
        .maybeSingle(),
      supabaseAdmin
        .from("steps")
        .select("id, active")
        .eq("id", data.step_id)
        .maybeSingle(),
      supabaseAdmin
        .from("categories")
        .select("id")
        .eq("id", data.category_id)
        .maybeSingle(),
    ]);
    if (!emp.data?.active)
      throw new Error("ไม่พบพนักงาน หรือพนักงานถูกปิดใช้งาน");
    if (!step.data?.active)
      throw new Error("ไม่พบขั้นตอน หรือถูกปิดใช้งาน");
    if (!cat.data) throw new Error("ไม่พบหมวดหมู่");

    const { error } = await supabaseAdmin.from("production_logs").insert({
      job_id: data.job_id,
      employee_id: data.employee_id,
      step_id: data.step_id,
      category_id: data.category_id,
      action: data.action,
      note: data.action === "finish" ? data.note ?? null : null,
      note_image_url:
        data.action === "finish" ? data.note_image_url ?? null : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
