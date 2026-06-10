// Feedback system — worker submit + admin manage
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

export type FeedbackCategory = "bug" | "suggest" | "complain" | "praise" | "other";
export type FeedbackStatus = "new" | "read" | "done";

export type FeedbackRow = {
  id: string;
  from_name: string | null;
  from_emp_code: string | null;
  from_phone: string | null;
  category: FeedbackCategory;
  subject: string;
  message: string;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

const submitSchema = z.object({
  from_name: z.string().trim().max(120).optional().nullable(),
  from_emp_code: z.string().trim().max(40).optional().nullable(),
  from_phone: z.string().trim().max(40).optional().nullable(),
  category: z.enum(["bug", "suggest", "complain", "praise", "other"]).default("other"),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(5).max(5000),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("feedbacks")
      .insert({
        from_name: data.from_name || null,
        from_emp_code: data.from_emp_code || null,
        from_phone: data.from_phone || null,
        category: data.category,
        subject: data.subject,
        message: data.message,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const adminListSchema = z.object({
  adminToken: z.string(),
  status: z.enum(["all", "new", "read", "done"]).default("all"),
  limit: z.number().min(1).max(500).default(200),
});

export const adminListFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminListSchema.parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as FeedbackRow[];
  });

const adminUpdateSchema = z.object({
  adminToken: z.string(),
  id: z.string().uuid(),
  status: z.enum(["new", "read", "done"]).optional(),
  admin_note: z.string().trim().max(2000).optional().nullable(),
});

export const adminUpdateFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminUpdateSchema.parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status?: FeedbackStatus; admin_note?: string | null } = {};
    if (data.status) patch.status = data.status;
    if (data.admin_note !== undefined) patch.admin_note = data.admin_note;
    const { error } = await supabaseAdmin.from("feedbacks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const adminDeleteSchema = z.object({
  adminToken: z.string(),
  id: z.string().uuid(),
});

export const adminDeleteFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminDeleteSchema.parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedbacks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminFeedbackCounts = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken: string }) => d)
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("feedbacks")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    return { new: count ?? 0 };
  });
