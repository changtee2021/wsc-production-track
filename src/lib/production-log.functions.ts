import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  job_id: z.string().min(1).max(128),
  employee_id: z.string().uuid(),
  step_id: z.string().uuid(),
  category_id: z.string().uuid(),
  action: z.enum(["start", "finish"]),
  note: z.string().max(2000).nullable().optional(),
  note_image_url: z.string().max(512).nullable().optional(),
});

export const submitProductionLog = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("production_logs").insert({
      job_id: data.job_id,
      employee_id: data.employee_id,
      step_id: data.step_id,
      category_id: data.category_id,
      action: data.action,
      note: data.action === "finish" ? data.note ?? null : null,
      note_image_url: data.action === "finish" ? data.note_image_url ?? null : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
