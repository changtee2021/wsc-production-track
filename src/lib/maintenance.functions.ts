// Maintenance ("เจ้าหนูแจ้งซ่อม") server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  issueMaintenanceToken,
  verifyMaintenanceToken,
  checkMaintenancePassword,
} from "./maintenance-token.server";
import { verifyAdminToken } from "./admin-token.server";

function assertMaint(token: string | undefined) {
  if (!verifyMaintenanceToken(token)) throw new Error("Unauthorized");
}

// Allows both the maintenance worker token AND the admin token.
// Used for asset/spare-parts/media endpoints that are also reachable from
// the admin "ทรัพย์สิน & อะไหล่" page (_protected/maintenance-master).
function assertMaintOrAdmin(token: string | undefined) {
  if (verifyMaintenanceToken(token)) return;
  if (verifyAdminToken(token)) return;
  throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

// ============ AUTH ============
export const verifyMaintenancePassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!checkMaintenancePassword(data.password)) {
      return { ok: false as const };
    }
    return { ok: true as const, token: issueMaintenanceToken() };
  });

export const checkMaintenanceToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => ({ ok: verifyMaintenanceToken(data.token) }));

// ============ ASSETS ============
const assetInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(50).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  category: z.enum(["machine", "equipment", "tool"]).default("machine"),
  location: z.string().trim().max(200).nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  serial_no: z.string().trim().max(100).nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  purchase_price: z.number().nullable().optional(),
  vendor: z.string().trim().max(200).nullable().optional(),
  warranty_until: z.string().nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  image_url: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().default(true),
});

export const listAssets = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("assets")
      .select("*")
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, asset: assetInput }).parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const a = data.asset;
    const payload = {
      code: a.code ?? null,
      name: a.name,
      category: a.category,
      location: a.location ?? null,
      brand: a.brand ?? null,
      model: a.model ?? null,
      serial_no: a.serial_no ?? null,
      purchase_date: a.purchase_date || null,
      purchase_price: a.purchase_price ?? null,
      vendor: a.vendor ?? null,
      warranty_until: a.warranty_until || null,
      note: a.note ?? null,
      image_url: a.image_url ?? null,
      active: a.active,
    };
    if (a.id) {
      const { error } = await supabaseAdmin.from("assets").update(payload).eq("id", a.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: a.id };
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("assets").insert(payload).select("id").single();
      if (error || !ins) throw new Error(error?.message || "บันทึกไม่สำเร็จ");
      return { ok: true, id: ins.id };
    }
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { error } = await supabaseAdmin.from("assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ SPARE PARTS ============
const partInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(50).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20).default("ชิ้น"),
  stock_qty: z.number().int().min(0).default(0),
  min_qty: z.number().int().min(0).default(0),
  location_bin: z.string().trim().max(100).nullable().optional(),
  unit_cost: z.number().nullable().optional(),
  image_url: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().default(true),
});

export const listSpareParts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("spare_parts").select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertSparePart = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, part: partInput }).parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const p = data.part;
    const payload = {
      code: p.code ?? null,
      name: p.name,
      unit: p.unit,
      stock_qty: p.stock_qty,
      min_qty: p.min_qty,
      location_bin: p.location_bin ?? null,
      unit_cost: p.unit_cost ?? null,
      image_url: p.image_url ?? null,
      note: p.note ?? null,
      active: p.active,
    };
    if (p.id) {
      const { error } = await supabaseAdmin.from("spare_parts").update(payload).eq("id", p.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: p.id };
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("spare_parts").insert(payload).select("id").single();
      if (error || !ins) throw new Error(error?.message || "บันทึกไม่สำเร็จ");
      return { ok: true, id: ins.id };
    }
  });

export const deleteSparePart = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { error } = await supabaseAdmin.from("spare_parts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restockPart = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        spare_part_id: z.string().uuid(),
        delta: z.number().int(),
        reason: z.enum(["restock", "adjust"]),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { data: part, error: e0 } = await supabaseAdmin
      .from("spare_parts").select("stock_qty").eq("id", data.spare_part_id).single();
    if (e0 || !part) throw new Error(e0?.message || "ไม่พบอะไหล่");
    const newQty = part.stock_qty + data.delta;
    if (newQty < 0) throw new Error("สต๊อกติดลบไม่ได้");
    const { error: e1 } = await supabaseAdmin
      .from("spare_parts").update({ stock_qty: newQty }).eq("id", data.spare_part_id);
    if (e1) throw new Error(e1.message);
    await supabaseAdmin.from("spare_part_movements").insert({
      spare_part_id: data.spare_part_id,
      delta: data.delta,
      reason: data.reason,
      note: data.note ?? null,
    });
    return { ok: true };
  });

// ============ TICKETS ============
const mediaItem = z.object({
  url: z.string().min(1).max(2000),
  type: z.enum(["image", "video"]),
});

export const listTickets = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        status: z.enum(["open", "in_progress", "done", "cancelled", "all"]).default("all"),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    let q = supabaseAdmin
      .from("maintenance_tickets")
      .select("*, assets(id, code, name, location)")
      .order("reported_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("maintenance_tickets")
      .select("*, assets(id, code, name, location, brand, model)")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error(error?.message || "ไม่พบใบงาน");
    const { data: parts } = await supabaseAdmin
      .from("maintenance_parts_used")
      .select("*, spare_parts(id, code, name, unit, stock_qty)")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });
    return { ticket: row, parts: parts ?? [] };
  });

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        asset_id: z.string().uuid().nullable().optional(),
        reporter_name: z.string().trim().min(1).max(100),
        problem_text: z.string().trim().min(1).max(2000),
        problem_media: z.array(mediaItem).max(20).default([]),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { data: ins, error } = await supabaseAdmin
      .from("maintenance_tickets")
      .insert({
        asset_id: data.asset_id ?? null,
        reporter_name: data.reporter_name,
        problem_text: data.problem_text,
        problem_media: data.problem_media,
        priority: data.priority,
      })
      .select("id, ticket_no")
      .single();
    if (error || !ins) throw new Error(error?.message || "บันทึกไม่สำเร็จ");
    return { ok: true, id: ins.id, ticket_no: ins.ticket_no };
  });

export const updateTicketStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "done", "cancelled"]),
        assignee_name: z.string().trim().max(100).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const patch: {
      status: string;
      assignee_name?: string | null;
      started_at?: string;
      done_at?: string;
    } = { status: data.status };
    if (data.assignee_name !== undefined) patch.assignee_name = data.assignee_name;
    if (data.status === "in_progress") patch.started_at = new Date().toISOString();
    if (data.status === "done") patch.done_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("maintenance_tickets").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid(),
        fix_method: z.string().trim().min(1).max(2000),
        fix_media: z.array(mediaItem).max(20).default([]),
        summary: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { error } = await supabaseAdmin
      .from("maintenance_tickets")
      .update({
        status: "done",
        done_at: new Date().toISOString(),
        fix_method: data.fix_method,
        fix_media: data.fix_media,
        summary: data.summary ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addPartsUsed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        ticket_id: z.string().uuid(),
        spare_part_id: z.string().uuid(),
        qty: z.number().int().min(1).max(10000),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { data: part, error: e0 } = await supabaseAdmin
      .from("spare_parts").select("stock_qty, name").eq("id", data.spare_part_id).single();
    if (e0 || !part) throw new Error(e0?.message || "ไม่พบอะไหล่");
    if (part.stock_qty < data.qty)
      throw new Error(`สต๊อก "${part.name}" ไม่พอ (เหลือ ${part.stock_qty})`);
    const { error } = await supabaseAdmin.from("maintenance_parts_used").insert({
      ticket_id: data.ticket_id,
      spare_part_id: data.spare_part_id,
      qty: data.qty,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePartsUsed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
    const { error } = await supabaseAdmin
      .from("maintenance_parts_used").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ MEDIA UPLOAD ============
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type Detected = { mime: string; ext: string };

function detectImage(b: Uint8Array): Detected | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: "image/gif", ext: "gif" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { mime: "image/webp", ext: "webp" };
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

export const maintenanceUploadMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        kind: z.enum(["image", "video"]),
        dataBase64: z.string().min(1).max(Math.ceil((MAX_VIDEO_BYTES * 4) / 3) + 16),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertMaint(data.token);
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
      .from("maintenance-media")
      .upload(path, bytes, { contentType: detected.mime, upsert: false });
    if (error) throw new Error(error.message);
    const { data: signed } = await supabaseAdmin.storage
      .from("maintenance-media")
      .createSignedUrl(path, 60 * 60);
    return { path, previewUrl: signed?.signedUrl ?? "", type: data.kind };
  });

// ============ ADMIN VIEW ============
export const adminMaintenanceSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    const [tickets, lowStock] = await Promise.all([
      supabaseAdmin
        .from("maintenance_tickets")
        .select("id, ticket_no, status, priority, reported_at, asset_id, assets(name, code)")
        .order("reported_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("spare_parts")
        .select("id, code, name, stock_qty, min_qty, unit")
        .eq("active", true),
    ]);
    const low = (lowStock.data ?? []).filter((p) => p.stock_qty <= p.min_qty);
    const counts = {
      open: 0, in_progress: 0, done: 0, cancelled: 0,
    } as Record<string, number>;
    for (const t of tickets.data ?? []) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return {
      tickets: tickets.data ?? [],
      lowStock: low,
      counts,
    };
  });
