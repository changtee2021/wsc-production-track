import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const payload = z.object({
  job_id: z.string().trim().min(1).max(200),
  employee_id: z.string().uuid(),
  step_id: z.string().uuid(),
  category_id: z.string().uuid(),
  action: z.enum(["start", "finish"]),
  note: z.string().trim().max(2000).nullable().optional(),
  // Bucket is private and we store the object path (e.g. "abc.jpg"),
  // not a full URL. Just enforce a sane length.
  note_image_url: z.string().trim().max(2000).nullable().optional(),
});

export const submitProductionLog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => payload.parse(d))
  .handler(async ({ data }) => {
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
