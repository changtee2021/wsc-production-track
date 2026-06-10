// Feedback / Ticket system — worker submit (FAB) + admin manage with comments
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

export type TicketStatus = "open" | "in_progress" | "qa" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "critical";
export type TicketCategory = "bug" | "suggest" | "complain" | "praise" | "other";

export const TICKET_STATUSES: readonly TicketStatus[] = [
  "open", "in_progress", "qa", "resolved", "closed",
];
export const TICKET_PRIORITIES: readonly TicketPriority[] = [
  "low", "normal", "high", "critical",
];
export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  "bug", "suggest", "complain", "praise", "other",
];

export type TicketRow = {
  id: string;
  ticket_no: number | null;
  from_name: string | null;
  from_emp_code: string | null;
  from_phone: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  message: string;
  page_path: string | null;
  status: TicketStatus;
  admin_note: string | null;
  assignee_name: string | null;
  image_paths: string[];
  image_urls: string[];
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketCommentRow = {
  id: string;
  ticket_id: string;
  author_name: string;
  author_role: string;
  body: string;
  image_paths: string[];
  image_urls: string[];
  created_at: string;
};

/* ============= storage helpers ============= */

async function signImagePaths(paths: string[] | null | undefined): Promise<string[]> {
  if (!paths || paths.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("feedback-media")
    .createSignedUrls(paths, 60 * 60);
  return (data ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
}

/** ออก signed upload URL ให้ผู้แจ้ง (anonymous) แนบรูปก่อนส่ง ticket */
export const createFeedbackUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { ext: string }) =>
    z.object({ ext: z.string().regex(/^[a-z0-9]{1,5}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = `submit/${Date.now()}-${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("feedback-media")
      .createSignedUploadUrl(key);
    if (error || !signed) throw new Error(error?.message ?? "create signed url failed");
    return { path: signed.path, token: signed.token };
  });

/** ออก signed upload URL ให้แอดมิน (เพิ่มในคอมเมนต์) */
export const createAdminCommentUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken: string; ext: string }) =>
    z.object({
      adminToken: z.string(),
      ext: z.string().regex(/^[a-z0-9]{1,5}$/),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = `admin/${Date.now()}-${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("feedback-media")
      .createSignedUploadUrl(key);
    if (error || !signed) throw new Error(error?.message ?? "create signed url failed");
    return { path: signed.path, token: signed.token };
  });

/* ============= submit (FAB) ============= */

const submitSchema = z.object({
  from_name: z.string().trim().max(120).optional().nullable(),
  from_emp_code: z.string().trim().max(40).optional().nullable(),
  from_phone: z.string().trim().max(40).optional().nullable(),
  category: z.enum(["bug", "suggest", "complain", "praise", "other"]).default("other"),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(2).max(5000),
  page_path: z.string().trim().max(300).default(""),
  image_paths: z.array(z.string().max(400)).max(6).default([]),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safePaths = (data.image_paths ?? []).filter((p) => p.startsWith("submit/"));
    const { data: row, error } = await supabaseAdmin
      .from("feedbacks")
      .insert({
        from_name: data.from_name || null,
        from_emp_code: data.from_emp_code || null,
        from_phone: data.from_phone || null,
        category: data.category,
        priority: data.priority,
        subject: data.subject,
        message: data.message,
        page_path: data.page_path,
        image_paths: safePaths,
        status: "open",
      })
      .select("id, ticket_no")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, ticket_no: row.ticket_no as number | null };
  });

/* ============= admin list / update / delete ============= */

const adminListSchema = z.object({
  adminToken: z.string(),
  status: z.string().default("all"),
  priority: z.string().default("all"),
  limit: z.number().min(1).max(500).default(200),
});

export const adminListFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminListSchema.parse(d))
  .handler(async ({ data }): Promise<TicketRow[]> => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.priority !== "all") q = q.eq("priority", data.priority);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const out: TicketRow[] = [];
    for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
      const paths = (r.image_paths as string[] | null) ?? [];
      out.push({
        ...(r as unknown as TicketRow),
        image_paths: paths,
        image_urls: await signImagePaths(paths),
      });
    }
    return out;
  });

const adminUpdateSchema = z.object({
  adminToken: z.string(),
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "qa", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  admin_note: z.string().trim().max(2000).optional().nullable(),
  assignee_name: z.string().trim().max(120).optional().nullable(),
});

export const adminUpdateFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminUpdateSchema.parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.status) {
      patch.status = data.status;
      patch.closed_at = data.status === "closed" ? new Date().toISOString() : null;
    }
    if (data.priority) patch.priority = data.priority;
    if (data.admin_note !== undefined) patch.admin_note = data.admin_note;
    if (data.assignee_name !== undefined) patch.assignee_name = data.assignee_name;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("feedbacks").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminToken: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ticket_comments").delete().eq("ticket_id", data.id);
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
      .eq("status", "open");
    return { new: count ?? 0 };
  });

/* ============= comments ============= */

export const adminListComments = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminToken: z.string(), ticket_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<TicketCommentRow[]> => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ticket_comments")
      .select("*")
      .eq("ticket_id", data.ticket_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const out: TicketCommentRow[] = [];
    for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
      const paths = (r.image_paths as string[] | null) ?? [];
      out.push({
        ...(r as unknown as TicketCommentRow),
        image_paths: paths,
        image_urls: await signImagePaths(paths),
      });
    }
    return out;
  });

const addCommentSchema = z.object({
  adminToken: z.string(),
  ticket_id: z.string().uuid(),
  author_name: z.string().trim().max(120).default("แอดมิน"),
  body: z.string().trim().max(2000).default(""),
  image_paths: z.array(z.string().max(400)).max(6).default([]),
}).refine((d) => d.body.length > 0 || d.image_paths.length > 0, {
  message: "กรุณาใส่ข้อความหรือรูปภาพ",
});

export const adminAddComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => addCommentSchema.parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safePaths = (data.image_paths ?? []).filter((p) => p.startsWith("admin/"));
    const { error } = await supabaseAdmin.from("ticket_comments").insert({
      ticket_id: data.ticket_id,
      author_name: data.author_name || "แอดมิน",
      author_role: "admin",
      body: data.body,
      image_paths: safePaths,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminToken: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ticket_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============= labels (UI shared) ============= */

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "เปิด (รอคัดกรอง)",
  in_progress: "กำลังทำ",
  qa: "ทดสอบ",
  resolved: "แก้แล้ว",
  closed: "ปิดงาน",
};
export const STATUS_BADGE: Record<TicketStatus, string> = {
  open: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  qa: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  closed: "bg-secondary text-secondary-foreground",
};
export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "ต่ำ", normal: "ปกติ", high: "สูง", critical: "วิกฤต",
};
export const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critical: "bg-destructive/15 text-destructive",
};
export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  bug: "บั๊ก", suggest: "เสนอแนะ", complain: "ร้องเรียน", praise: "ชมเชย", other: "อื่นๆ",
};
export const NEXT_STATUS: Partial<Record<TicketStatus, TicketStatus>> = {
  open: "in_progress",
  in_progress: "qa",
  qa: "resolved",
  resolved: "closed",
};

// Backwards-compatible aliases (old code)
export type FeedbackRow = TicketRow;
export type FeedbackStatus = TicketStatus;
export type FeedbackCategory = TicketCategory;
