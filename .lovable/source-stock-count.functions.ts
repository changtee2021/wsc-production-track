// Server functions for stock counting (worker-side scan + admin reports).
// Adapted from the Curtain Flow stock-count module to WSC's worker-code / token auth.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueStockToken, readStockToken, verifyStockToken } from "./stock-token.server";
import { verifyAdminToken } from "./admin-token.server";

export type CountStatus = "match" | "short" | "over";

export type StockCountRow = {
  id: string;
  batch_id: string;
  item_id: string | null;
  item_code: string;
  item_name: string;
  unit: string;
  counted_qty: number;
  system_qty: number;
  variance: number;
  status: CountStatus;
  note: string;
  created_at: string;
};

export type BatchStats = {
  total: number;
  match: number;
  short: number;
  over: number;
  mismatch: number;
};

export type StockCountBatch = {
  id: string;
  batch_no: number;
  status: "draft" | "submitted";
  note: string;
  counted_by_emp_id: string | null;
  counted_by_emp_code: string | null;
  counted_by_name: string | null;
  submitted_at: string | null;
  created_at: string;
  stats: BatchStats;
};

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function computeStats(rows: { status: CountStatus }[]): BatchStats {
  const total = rows.length;
  const match = rows.filter((r) => r.status === "match").length;
  const short = rows.filter((r) => r.status === "short").length;
  const over = rows.filter((r) => r.status === "over").length;
  return { total, match, short, over, mismatch: short + over };
}

function requireWorker(token: string | undefined): { company: "wsc" | "wp" } {
  const t = readStockToken(token);
  if (!t) throw new Error("Unauthorized");
  return t;
}

const tokenStr = z.string().min(1);
const companySchema = z.enum(["wsc", "wp"]).optional();

// ───────────────────────────────────────────────────────────────
// Auth: issue a stock-count token (no password — auto-issue like packing)
// ───────────────────────────────────────────────────────────────
export const issueStockSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ company: companySchema }).parse(d ?? {}))
  .handler(async ({ data }) => ({ token: issueStockToken(data.company ?? "wsc") }));

export const checkStockToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => ({ ok: verifyStockToken(data.token) }));

// ───────────────────────────────────────────────────────────────
// Worker: get-or-create draft batch tied to emp_code
// ───────────────────────────────────────────────────────────────
export const getOrCreateDraftBatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        empCode: z.string().min(1).max(64),
        empName: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { company } = requireWorker(data.token);

    // resolve employee id (search across employee tables by emp_code)
    const empCode = data.empCode.trim();
    let empId: string | null = null;
    for (const table of [
      "employees",
      "qc_employees",
      "packing_employees",
      "maintenance_employees",
      "office_employees",
    ] as const) {
      const { data: row } = await supabaseAdmin
        .from(table)
        .select("id")
        .eq("company_id", company)
        .eq("emp_code", empCode)
        .eq("active", true)
        .maybeSingle();
      if (row?.id) {
        empId = row.id;
        break;
      }
    }

    const { data: existing } = await supabaseAdmin
      .from("stock_count_batches")
      .select(
        "id, batch_no, status, note, counted_by_emp_id, counted_by_emp_code, counted_by_name, submitted_at, created_at",
      )
      .eq("company_id", company)
      .eq("counted_by_emp_code", empCode)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;

    const { data: created, error } = await supabaseAdmin
      .from("stock_count_batches")
      .insert({
        company_id: company,
        counted_by_emp_id: empId,
        counted_by_emp_code: empCode,
        counted_by_name: data.empName.trim(),
        status: "draft",
      })
      .select(
        "id, batch_no, status, note, counted_by_emp_id, counted_by_emp_code, counted_by_name, submitted_at, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

// ───────────────────────────────────────────────────────────────
// Worker: add line to a batch (lookup SKU → inventory_items)
// ───────────────────────────────────────────────────────────────
export const addCountLine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        batchId: z.string().uuid(),
        sku: z.string().min(1).max(120),
        countedQty: z.number().min(0).max(100_000_000),
        note: z.string().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { company } = requireWorker(data.token);

    // Verify the batch is still draft and belongs to same company
    const { data: batch, error: bErr } = await supabaseAdmin
      .from("stock_count_batches")
      .select("id, company_id, status, counted_by_emp_id, counted_by_name")
      .eq("id", data.batchId)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!batch || batch.company_id !== company) throw new Error("ไม่พบชุดการนับ");
    if (batch.status !== "draft") throw new Error("ชุดนี้ถูกส่งและล็อกแล้ว");

    const sku = data.sku.trim();
    const { data: item, error: itemErr } = await supabaseAdmin
      .from("inventory_items")
      .select("id, item_code, item_name, unit, total_qty")
      .eq("company_id", company)
      .eq("item_code", sku)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error(`ไม่พบสินค้ารหัส "${sku}" ในคลัง`);

    const systemQty = num(item.total_qty);
    const variance = +(data.countedQty - systemQty).toFixed(4);
    const status: CountStatus = variance === 0 ? "match" : variance < 0 ? "short" : "over";

    const { data: row, error } = await supabaseAdmin
      .from("stock_counts")
      .insert({
        batch_id: data.batchId,
        company_id: company,
        item_id: item.id,
        item_code: item.item_code,
        item_name: item.item_name,
        unit: item.unit ?? "",
        counted_qty: data.countedQty,
        system_qty: systemQty,
        variance,
        status,
        note: data.note ?? "",
        counted_by_emp_id: batch.counted_by_emp_id,
        counted_by_name: batch.counted_by_name,
      })
      .select(
        "id, batch_id, item_id, item_code, item_name, unit, counted_qty, system_qty, variance, status, note, created_at",
      )
      .single();
    if (error) throw new Error(error.message);

    return {
      ...row,
      counted_qty: num(row.counted_qty),
      system_qty: num(row.system_qty),
      variance: num(row.variance),
    } as StockCountRow;
  });

// ───────────────────────────────────────────────────────────────
// Worker: update / delete line (only while draft)
// ───────────────────────────────────────────────────────────────
export const updateCountLine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid(),
        countedQty: z.number().min(0).max(100_000_000),
        note: z.string().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { company } = requireWorker(data.token);

    const { data: cur, error: curErr } = await supabaseAdmin
      .from("stock_counts")
      .select("id, system_qty, batch_id, company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (curErr || !cur) throw new Error("ไม่พบรายการ");
    if (cur.company_id !== company) throw new Error("Unauthorized");

    const { data: b } = await supabaseAdmin
      .from("stock_count_batches")
      .select("status")
      .eq("id", cur.batch_id)
      .maybeSingle();
    if (b?.status !== "draft") throw new Error("ชุดถูกล็อกแล้ว");

    const systemQty = num(cur.system_qty);
    const variance = +(data.countedQty - systemQty).toFixed(4);
    const status: CountStatus = variance === 0 ? "match" : variance < 0 ? "short" : "over";

    const { error } = await supabaseAdmin
      .from("stock_counts")
      .update({ counted_qty: data.countedQty, variance, status, note: data.note ?? "" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, status, variance };
  });

export const deleteCountLine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { company } = requireWorker(data.token);

    const { data: cur } = await supabaseAdmin
      .from("stock_counts")
      .select("id, batch_id, company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur || cur.company_id !== company) throw new Error("ไม่พบรายการ");
    const { data: b } = await supabaseAdmin
      .from("stock_count_batches")
      .select("status")
      .eq("id", cur.batch_id)
      .maybeSingle();
    if (b?.status !== "draft") throw new Error("ชุดถูกล็อกแล้ว");

    const { error } = await supabaseAdmin.from("stock_counts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ───────────────────────────────────────────────────────────────
// Worker: list lines in a batch
// ───────────────────────────────────────────────────────────────
export const listBatchLines = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, batchId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { company } = requireWorker(data.token);

    const { data: rows, error } = await supabaseAdmin
      .from("stock_counts")
      .select(
        "id, batch_id, item_id, item_code, item_name, unit, counted_qty, system_qty, variance, status, note, created_at",
      )
      .eq("company_id", company)
      .eq("batch_id", data.batchId)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      ...r,
      counted_qty: num(r.counted_qty),
      system_qty: num(r.system_qty),
      variance: num(r.variance),
    })) as StockCountRow[];
  });

// ───────────────────────────────────────────────────────────────
// Worker: submit batch (lock)
// ───────────────────────────────────────────────────────────────
export const submitBatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        batchId: z.string().uuid(),
        note: z.string().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { company } = requireWorker(data.token);

    const { data: b } = await supabaseAdmin
      .from("stock_count_batches")
      .select("id, company_id, status")
      .eq("id", data.batchId)
      .maybeSingle();
    if (!b || b.company_id !== company) throw new Error("ไม่พบชุดการนับ");
    if (b.status !== "draft") throw new Error("ชุดนี้ถูกส่งแล้ว");

    const { count } = await supabaseAdmin
      .from("stock_counts")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", data.batchId);
    if (!count || count === 0) throw new Error("ยังไม่มีรายการในชุดนี้");

    const { error } = await supabaseAdmin
      .from("stock_count_batches")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        note: data.note ?? "",
      })
      .eq("id", data.batchId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ───────────────────────────────────────────────────────────────
// Worker: list my submitted batches (today)
// ───────────────────────────────────────────────────────────────
export const listMyBatches = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        empCode: z.string().min(1).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { company } = requireWorker(data.token);

    const { data: batches, error } = await supabaseAdmin
      .from("stock_count_batches")
      .select(
        "id, batch_no, status, note, counted_by_emp_id, counted_by_emp_code, counted_by_name, submitted_at, created_at",
      )
      .eq("company_id", company)
      .eq("counted_by_emp_code", data.empCode.trim())
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const list = batches ?? [];
    if (!list.length) return [] as StockCountBatch[];

    const ids = list.map((b) => b.id);
    const { data: lines } = await supabaseAdmin
      .from("stock_counts")
      .select("batch_id, status")
      .in("batch_id", ids);
    const byBatch: Record<string, { status: CountStatus }[]> = {};
    for (const l of lines ?? []) {
      if (!l.batch_id) continue;
      (byBatch[l.batch_id] ??= []).push({ status: l.status as CountStatus });
    }

    return list.map((b) => ({
      ...b,
      stats: computeStats(byBatch[b.id] ?? []),
    })) as StockCountBatch[];
  });

// ───────────────────────────────────────────────────────────────
// Admin: list batches in a date range (reports)
// ───────────────────────────────────────────────────────────────
export const adminListBatches = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        adminToken: tokenStr,
        company: z.enum(["wsc", "wp"]).default("wsc"),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        status: z.enum(["draft", "submitted", "all"]).optional().default("submitted"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");

    let q = supabaseAdmin
      .from("stock_count_batches")
      .select(
        "id, batch_no, status, note, counted_by_emp_id, counted_by_emp_code, counted_by_name, submitted_at, created_at",
      )
      .eq("company_id", data.company)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: batches, error } = await q;
    if (error) throw new Error(error.message);
    const list = batches ?? [];
    if (!list.length) return [] as StockCountBatch[];

    const ids = list.map((b) => b.id);
    const { data: lines } = await supabaseAdmin
      .from("stock_counts")
      .select("batch_id, status")
      .in("batch_id", ids)
      .limit(50000);
    const byBatch: Record<string, { status: CountStatus }[]> = {};
    for (const l of lines ?? []) {
      if (!l.batch_id) continue;
      (byBatch[l.batch_id] ??= []).push({ status: l.status as CountStatus });
    }

    return list.map((b) => ({
      ...b,
      stats: computeStats(byBatch[b.id] ?? []),
    })) as StockCountBatch[];
  });

// Admin: list lines in a batch
export const adminListBatchLines = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminToken: tokenStr, batchId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");

    const { data: rows, error } = await supabaseAdmin
      .from("stock_counts")
      .select(
        "id, batch_id, item_id, item_code, item_name, unit, counted_qty, system_qty, variance, status, note, created_at",
      )
      .eq("batch_id", data.batchId)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      counted_qty: num(r.counted_qty),
      system_qty: num(r.system_qty),
      variance: num(r.variance),
    })) as StockCountRow[];
  });

// Admin: reopen a submitted batch
export const adminReopenBatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminToken: tokenStr, batchId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { error } = await supabaseAdmin
      .from("stock_count_batches")
      .update({ status: "draft", submitted_at: null })
      .eq("id", data.batchId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ───────────────────────────────────────────────────────────────
// Admin: inventory items CRUD
// ───────────────────────────────────────────────────────────────
export const adminListInventory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        adminToken: tokenStr,
        company: z.enum(["wsc", "wp"]).default("wsc"),
        search: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    let q = supabaseAdmin
      .from("inventory_items")
      .select(
        "id, item_code, item_name, unit, total_qty, min_safety_stock, max_stock_level, category, location, note, image_url, active, created_at, updated_at",
      )
      .eq("company_id", data.company)
      .order("item_code", { ascending: true })
      .limit(1000);
    const s = data.search?.trim();
    if (s) q = q.or(`item_code.ilike.%${s}%,item_name.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      total_qty: num(r.total_qty),
      min_safety_stock: num(r.min_safety_stock),
      max_stock_level: num(r.max_stock_level),
    }));
  });

export const adminUpsertInventory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        adminToken: tokenStr,
        company: z.enum(["wsc", "wp"]).default("wsc"),
        id: z.string().uuid().optional(),
        item_code: z.string().min(1).max(120),
        item_name: z.string().min(1).max(300),
        unit: z.string().max(40).default("ชิ้น"),
        total_qty: z.number().min(0).max(100_000_000).default(0),
        min_safety_stock: z.number().min(0).max(100_000_000).default(0),
        max_stock_level: z.number().min(0).max(100_000_000).default(0),
        category: z.string().max(120).optional().nullable(),
        location: z.string().max(120).optional().nullable(),
        note: z.string().max(1000).optional().nullable(),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const payload = {
      company_id: data.company,
      item_code: data.item_code.trim(),
      item_name: data.item_name.trim(),
      unit: data.unit.trim() || "ชิ้น",
      total_qty: data.total_qty,
      min_safety_stock: data.min_safety_stock,
      max_stock_level: data.max_stock_level,
      category: data.category ?? null,
      location: data.location ?? null,
      note: data.note ?? null,
      active: data.active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("inventory_items")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("inventory_items")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteInventory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ adminToken: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.adminToken)) throw new Error("Unauthorized");
    const { error } = await supabaseAdmin.from("inventory_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
