// QC-facing server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  issueQcToken,
  verifyQcToken,
  checkQcPassword,
} from "./qc-token.server";

function assertQc(token: string | undefined) {
  if (!verifyQcToken(token)) throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

export const verifyQcPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!checkQcPassword(data.password)) {
      return { ok: false as const, error: "รหัสผ่านไม่ถูกต้อง" };
    }
    return { ok: true as const, token: issueQcToken() };
  });

export const checkQcToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => ({ ok: verifyQcToken(data.token) }));

// Fetch finish logs for a job — joined with employee/step/category names.
export const qcFetchJobLogs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        job_id: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertQc(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("production_logs")
      .select(
        "id, job_id, action, created_at, note, employee_id, step_id, category_id, employees(name, emp_code), steps(step_name), categories(name)",
      )
      .eq("job_id", data.job_id)
      .eq("action", "finish")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const mediaItem = z.object({
  url: z.string().url().max(2000),
  type: z.enum(["image", "video"]),
});

// Checklist for a category (active items, ordered).
export const qcFetchChecklist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, category_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertQc(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("qc_checklists")
      .select("id, item_text, item_order")
      .eq("category_id", data.category_id)
      .eq("is_active", true)
      .order("item_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const reportItemInput = z.object({
  checklist_id: z.string().uuid().nullable(),
  item_text_snapshot: z.string().trim().min(1).max(500),
  item_order: z.number().int().min(0).max(10000),
  is_passed: z.boolean(),
  remark: z.string().trim().max(2000).nullable().optional(),
  media: z.array(mediaItem).max(20).default([]),
});

export const qcSubmitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        job_id: z.string().trim().min(1).max(200),
        qc_employee_id: z.string().uuid(),
        production_log_id: z.string().uuid().nullable().optional(),
        step_id: z.string().uuid().nullable().optional(),
        category_id: z.string().uuid().nullable().optional(),
        employee_id: z.string().uuid().nullable().optional(),
        note: z.string().trim().max(2000).nullable().optional(),
        media: z.array(mediaItem).max(20).default([]),
        overall_result: z.enum(["pass", "fail"]).nullable().optional(),
        items: z.array(reportItemInput).max(100).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertQc(data.token);
    const passCount = data.items.filter((i) => i.is_passed).length;
    const total = data.items.length;
    const computedOverall =
      data.overall_result ??
      (total > 0 ? (passCount === total ? "pass" : "fail") : null);
    const summary = total > 0 ? `ผ่าน ${passCount}/${total} ข้อ` : null;

    const { data: inserted, error } = await supabaseAdmin
      .from("qc_reports")
      .insert({
        job_id: data.job_id,
        qc_employee_id: data.qc_employee_id,
        production_log_id: data.production_log_id ?? null,
        step_id: data.step_id ?? null,
        category_id: data.category_id ?? null,
        employee_id: data.employee_id ?? null,
        note: data.note ?? null,
        media: data.media,
        overall_result: computedOverall,
        summary,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message || "บันทึกไม่สำเร็จ");

    if (data.items.length > 0) {
      const itemsRows = data.items.map((it) => ({
        qc_report_id: inserted.id,
        checklist_id: it.checklist_id,
        item_text_snapshot: it.item_text_snapshot,
        item_order: it.item_order,
        is_passed: it.is_passed,
        remark: it.remark ?? null,
        media: it.media,
      }));
      const { error: itemErr } = await supabaseAdmin
        .from("qc_report_items")
        .insert(itemsRows);
      if (itemErr) {
        // Rollback: best-effort delete of the parent report so we don't leave an orphan.
        await supabaseAdmin.from("qc_reports").delete().eq("id", inserted.id);
        throw new Error(itemErr.message);
      }
    }
    return { ok: true, id: inserted.id };
  });


// Signed upload URL for qc-media bucket (images + videos).
const ALLOWED_EXT = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "webm",
  "mov",
  "m4v",
  "quicktime",
] as const;

export const qcCreateUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        ext: z.enum(ALLOWED_EXT),
        kind: z.enum(["image", "video"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertQc(data.token);
    const path = `${data.kind}/${crypto.randomUUID()}.${data.ext.toLowerCase()}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("qc-media")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "ขออัปโหลดไม่สำเร็จ");
    const { data: pub } = supabaseAdmin.storage.from("qc-media").getPublicUrl(path);
    return { path, token: signed.token, publicUrl: pub.publicUrl };
  });
