// Packing-facing server functions (mirror of qc.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  issuePackingToken,
  verifyPackingToken,
  checkPackingPassword,
} from "./packing-token.server";

function assertPacking(token: string | undefined) {
  if (!verifyPackingToken(token)) throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

// ยกเลิกรหัสผ่านแพ็คของ — ออก token ให้ทันทีโดยไม่ตรวจรหัสผ่าน
export const verifyPackingPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: z.string().max(200).optional() }).parse(d ?? {}),
  )
  .handler(async () => {
    return { ok: true as const, token: issuePackingToken() };
  });

export const issuePackingSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async () => ({ token: issuePackingToken() }));

export const checkPackingToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => ({ ok: verifyPackingToken(data.token) }));

export const packingFetchJobLogs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        job_id: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertPacking(data.token);
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
  url: z.string().min(1).max(2000),
  type: z.enum(["image", "video"]),
});

export const packingFetchChecklist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, category_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPacking(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("packing_checklists")
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

export const packingSubmitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        job_id: z.string().trim().min(1).max(200),
        packing_employee_id: z.string().uuid(),
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
    assertPacking(data.token);
    const passCount = data.items.filter((i) => i.is_passed).length;
    const total = data.items.length;
    const computedOverall =
      data.overall_result ?? (total > 0 ? (passCount === total ? "pass" : "fail") : null);
    const summary = total > 0 ? `ผ่าน ${passCount}/${total} ข้อ` : null;

    const { data: inserted, error } = await supabaseAdmin
      .from("packing_reports")
      .insert({
        job_id: data.job_id,
        packing_employee_id: data.packing_employee_id,
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
        packing_report_id: inserted.id,
        checklist_id: it.checklist_id,
        item_text_snapshot: it.item_text_snapshot,
        item_order: it.item_order,
        is_passed: it.is_passed,
        remark: it.remark ?? null,
        media: it.media,
      }));
      const { error: itemErr } = await supabaseAdmin
        .from("packing_report_items")
        .insert(itemsRows);
      if (itemErr) {
        await supabaseAdmin.from("packing_reports").delete().eq("id", inserted.id);
        throw new Error(itemErr.message);
      }
    }
    return { ok: true, id: inserted.id };
  });

export const packingListEmployees = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertPacking(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("packing_employees")
      .select("id, name, emp_code")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// Media upload — mirrors qcUploadMedia but uploads into the packing-media bucket.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type Detected = { mime: string; ext: string };

function detectImage(b: Uint8Array): Detected | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return { mime: "image/png", ext: "png" };
  if (
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61
  ) return { mime: "image/gif", ext: "gif" };
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return { mime: "image/webp", ext: "webp" };
  return null;
}

function detectVideo(b: Uint8Array): Detected | null {
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return { mime: "video/webm", ext: "webm" };
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov" };
    if (brand.startsWith("M4V")) return { mime: "video/x-m4v", ext: "m4v" };
    return { mime: "video/mp4", ext: "mp4" };
  }
  return null;
}

export const packingUploadMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        kind: z.enum(["image", "video"]),
        dataBase64: z
          .string()
          .min(1)
          .max(Math.ceil((MAX_VIDEO_BYTES * 4) / 3) + 16),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertPacking(data.token);
    const bytes = Uint8Array.from(Buffer.from(data.dataBase64, "base64"));
    if (bytes.length === 0) throw new Error("ไฟล์ว่างเปล่า");
    const max = data.kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (bytes.length > max) throw new Error(`ไฟล์ใหญ่เกิน ${Math.round(max / (1024 * 1024))}MB`);

    const detected = data.kind === "image" ? detectImage(bytes) : detectVideo(bytes);
    if (!detected)
      throw new Error(
        data.kind === "image"
          ? "รองรับเฉพาะรูปภาพ JPG, PNG, WEBP, GIF"
          : "รองรับเฉพาะวิดีโอ MP4, WEBM, MOV, M4V",
      );

    const path = `${data.kind}/${crypto.randomUUID()}.${detected.ext}`;
    const { error } = await supabaseAdmin.storage
      .from("packing-media")
      .upload(path, bytes, { contentType: detected.mime, upsert: false });
    if (error) throw new Error(error.message);
    const { data: signed } = await supabaseAdmin.storage
      .from("packing-media")
      .createSignedUrl(path, 60 * 60);
    return { path, previewUrl: signed?.signedUrl ?? "", type: data.kind };
  });
