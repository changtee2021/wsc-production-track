// QC-facing server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueQcToken, verifyQcToken, checkQcPassword } from "@/lib/auth/qc-token.server";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/utils/media-limits";

function assertQc(token: string | undefined) {
  if (!verifyQcToken(token)) throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

export const verifyQcPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
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
  // Storage path inside the private qc-media bucket, not a URL.
  url: z.string().min(1).max(2000),
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
  tag: z.enum(["motor"]).nullable().optional(),
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
      data.overall_result ?? (total > 0 ? (passCount === total ? "pass" : "fail") : null);
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
        result_tag: it.tag ?? null,
        remark: it.remark ?? null,
        media: it.media,
      }));
      const { error: itemErr } = await supabaseAdmin.from("qc_report_items").insert(itemsRows);
      if (itemErr) {
        // Rollback: best-effort delete of the parent report so we don't leave an orphan.
        await supabaseAdmin.from("qc_reports").delete().eq("id", inserted.id);
        throw new Error(itemErr.message);
      }
    }
    return { ok: true, id: inserted.id };
  });

// List active QC employees (token-gated; qc_employees table is no longer
// publicly readable).
export const qcListEmployees = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertQc(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("qc_employees")
      .select("id, name, emp_code")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// Server-side validated media upload for qc-media bucket. The client sends
// base64 bytes; we verify magic bytes for the declared kind before uploading
// with the admin client (the bucket has no public INSERT policy).

type Detected = { mime: string; ext: string };

function detectImage(b: Uint8Array): Detected | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return { mime: "image/png", ext: "png" };
  if (
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  )
    return { mime: "image/gif", ext: "gif" };
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}

function detectVideo(b: Uint8Array): Detected | null {
  if (b.length < 12) return null;
  // WEBM/Matroska EBML: 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return { mime: "video/webm", ext: "webm" };
  // ISO base media (MP4/MOV/M4V): bytes 4-7 == "ftyp"
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov" };
    if (brand.startsWith("M4V")) return { mime: "video/x-m4v", ext: "m4v" };
    // mp4 family: isom, iso2, mp41, mp42, avc1, dash, etc.
    return { mime: "video/mp4", ext: "mp4" };
  }
  return null;
}

export const qcUploadMedia = createServerFn({ method: "POST" })
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
    assertQc(data.token);
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
      .from("qc-media")
      .upload(path, bytes, { contentType: detected.mime, upsert: false });
    if (error) throw new Error(error.message);
    // Bucket is private — return the path (persisted) and a signed URL for
    // immediate preview in the QC UI.
    const { data: signed } = await supabaseAdmin.storage
      .from("qc-media")
      .createSignedUrl(path, 60 * 60);
    return { path, previewUrl: signed?.signedUrl ?? "", type: data.kind };
  });

const videoUploadExt = z.enum(["mp4", "webm", "mov", "m4v"]);

/** Issue a signed upload URL so the client can PUT video bytes directly to Storage. */
export const qcCreateVideoUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        ext: videoUploadExt,
        sizeBytes: z.number().int().min(1).max(MAX_VIDEO_BYTES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertQc(data.token);
    const path = `video/${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("qc-media")
      .createSignedUploadUrl(path);
    if (error || !signed) {
      throw new Error(error?.message ?? "สร้างลิงก์อัปโหลดไม่สำเร็จ");
    }
    return { path: signed.path, token: signed.token };
  });
