import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWarehouseToken } from "@/lib/auth/warehouse-token.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { loadSettingSection } from "@/lib/features/warehouse-settings.functions";
import { formatAutoNo } from "@/lib/warehouse/format";
import { forwardReceiptConfirmed } from "@/lib/warehouse-forward.server";
import type { WhReceipt } from "@/lib/warehouse/types";

const tokenStr = z.string().min(1);

function requireWorker(token: string): void {
  if (!verifyWarehouseToken(token)) throw new Error("Unauthorized");
}

async function nextReceiptNo(): Promise<string> {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const { count } = await supabaseAdmin
    .from("wh_receipts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00`);
  return `RCV-${date}-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

function makeBoxCode(format: string, receiptNo: string, seq: number): string {
  return formatAutoNo(format, { receipt_no: receiptNo, seq });
}

export const whCreateReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        empCode: z.string().min(1).max(64),
        empName: z.string().min(1).max(200),
        po_number: z.string().max(100).default(""),
        backoffice_po_id: z.string().uuid().nullable().optional(),
        backoffice_item_id: z.string().uuid().nullable().optional(),
        item_code: z.string().min(1).max(64),
        item_name: z.string().max(200).default(""),
        lot_no: z.string().max(100).default(""),
        mfg_date: z.string().nullable().optional(),
        exp_date: z.string().nullable().optional(),
        expected_boxes: z.number().int().min(0).max(100_000),
        qty_per_box: z.number().positive().max(1_000_000).default(1),
        barcode_mode: z.enum(["system", "supplier", "ask_each_receipt"]).optional(),
        note: z.string().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const receiving = await loadSettingSection("receiving");
    if (receiving.po_required && !data.po_number && !data.backoffice_po_id) {
      throw new Error("ต้องระบุ PO");
    }
    if (receiving.lot_no_required && !data.lot_no?.trim()) {
      throw new Error("ต้องระบุ Lot No.");
    }
    const barcodeMode =
      data.barcode_mode ??
      (receiving.default_barcode_mode as "system" | "supplier" | "ask_each_receipt");

    const receiptNo = await nextReceiptNo();
    const { data: row, error } = await supabaseAdmin
      .from("wh_receipts")
      .insert({
        receipt_no: receiptNo,
        po_number: data.po_number.trim(),
        backoffice_po_id: data.backoffice_po_id ?? null,
        backoffice_item_id: data.backoffice_item_id ?? null,
        item_code: data.item_code.trim(),
        item_name: data.item_name.trim(),
        lot_no: data.lot_no.trim(),
        mfg_date: data.mfg_date || null,
        exp_date: data.exp_date || null,
        expected_boxes: data.expected_boxes,
        qty_per_box: data.qty_per_box,
        barcode_mode: barcodeMode,
        received_by_emp_code: data.empCode.trim(),
        received_by_name: data.empName.trim(),
        note: data.note,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as WhReceipt;
  });

export const whAddBox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        receiptId: z.string().uuid(),
        empCode: z.string().min(1).max(64),
        boxCode: z.string().max(128).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: receipt, error: rErr } = await supabaseAdmin
      .from("wh_receipts")
      .select("*")
      .eq("id", data.receiptId)
      .single();
    if (rErr || !receipt) throw new Error("ไม่พบใบรับของ");
    if (receipt.status !== "draft") throw new Error("ใบรับของถูกยืนยันแล้ว");

    const receiving = await loadSettingSection("receiving");
    const format = String(receiving.box_code_format ?? "BOX-{receipt_no}-{seq:04d}");

    let boxCode = data.boxCode?.trim();
    if (!boxCode) {
      if (receipt.barcode_mode === "supplier") {
        throw new Error("โหมดซัพพลายเออร์ — ต้องสแกน barcode กล่อง");
      }
      const { count } = await supabaseAdmin
        .from("wh_boxes")
        .select("id", { count: "exact", head: true })
        .eq("receipt_id", data.receiptId);
      const seq = (count ?? 0) + 1;
      boxCode = makeBoxCode(format, receipt.receipt_no, seq);
    }

    const { data: existing } = await supabaseAdmin
      .from("wh_boxes")
      .select("id")
      .eq("box_code", boxCode)
      .maybeSingle();
    if (existing) throw new Error(`Barcode ซ้ำ: ${boxCode}`);

    const { count: seqCount } = await supabaseAdmin
      .from("wh_boxes")
      .select("id", { count: "exact", head: true })
      .eq("receipt_id", data.receiptId);

    const { data: box, error } = await supabaseAdmin
      .from("wh_boxes")
      .insert({
        box_code: boxCode,
        receipt_id: data.receiptId,
        lot_no: receipt.lot_no,
        seq_no: (seqCount ?? 0) + 1,
        scanned_by_emp_code: data.empCode.trim(),
        scanned_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const received = (receipt.received_boxes ?? 0) + 1;
    await supabaseAdmin
      .from("wh_receipts")
      .update({ received_boxes: received, updated_at: new Date().toISOString() })
      .eq("id", data.receiptId);

    return { box, received_boxes: received };
  });

export const whBulkGenerateBoxes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        receiptId: z.string().uuid(),
        empCode: z.string().min(1).max(64),
        count: z.number().int().positive().max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: receipt, error: rErr } = await supabaseAdmin
      .from("wh_receipts")
      .select("*")
      .eq("id", data.receiptId)
      .single();
    if (rErr || !receipt) throw new Error("ไม่พบใบรับของ");
    if (receipt.barcode_mode === "supplier") {
      throw new Error("โหมดซัพพลายเออร์ — ต้องสแกนทีละกล่อง");
    }

    const receiving = await loadSettingSection("receiving");
    const format = String(receiving.box_code_format ?? "BOX-{receipt_no}-{seq:04d}");
    const { count: start } = await supabaseAdmin
      .from("wh_boxes")
      .select("id", { count: "exact", head: true })
      .eq("receipt_id", data.receiptId);
    const base = start ?? 0;
    const rows = Array.from({ length: data.count }, (_, i) => ({
      box_code: makeBoxCode(format, receipt.receipt_no, base + i + 1),
      receipt_id: data.receiptId,
      lot_no: receipt.lot_no,
      seq_no: base + i + 1,
      scanned_by_emp_code: data.empCode.trim(),
      scanned_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("wh_boxes").insert(rows);
    if (error) throw new Error(error.message);

    const received = base + data.count;
    await supabaseAdmin
      .from("wh_receipts")
      .update({ received_boxes: received, updated_at: new Date().toISOString() })
      .eq("id", data.receiptId);
    return { received_boxes: received };
  });

export const whConfirmReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        receiptId: z.string().uuid(),
        vision_checks: z
          .array(
            z.object({
              item_id: z.string().uuid(),
              label: z.string(),
              result: z.enum(["pass", "fail"]),
            }),
          )
          .optional()
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: receipt, error } = await supabaseAdmin
      .from("wh_receipts")
      .select("*")
      .eq("id", data.receiptId)
      .single();
    if (error || !receipt) throw new Error("ไม่พบใบรับของ");
    if (receipt.status === "confirmed") return receipt;

    const vision = await loadSettingSection("vision");
    if (vision.enabled) {
      const { data: items } = await supabaseAdmin
        .from("wh_vision_check_items")
        .select("id, label, required")
        .eq("active", true);
      const checks = data.vision_checks ?? [];
      for (const it of items ?? []) {
        if (!it.required) continue;
        const hit = checks.find((c) => c.item_id === it.id);
        if (!hit || hit.result !== "pass") {
          throw new Error(`ต้องเช็ควิสให้ครบ: ${it.label}`);
        }
      }
    }

    const confirmedAt = new Date().toISOString();
    const general = await loadSettingSection("general");
    const fwd = await forwardReceiptConfirmed({
      event: "receipt_confirmed",
      receipt_no: receipt.receipt_no,
      backoffice_po_id: receipt.backoffice_po_id,
      backoffice_item_id: receipt.backoffice_item_id,
      item_code: receipt.item_code,
      lot_no: receipt.lot_no,
      mfg_date: receipt.mfg_date,
      exp_date: receipt.exp_date,
      box_count: receipt.received_boxes,
      qty_per_box: Number(receipt.qty_per_box),
      company_id: String(general.company_code ?? "WSC"),
    });

    await supabaseAdmin.from("wh_sync_logs").insert({
      direction: "outbound",
      event_type: "receipt_confirmed",
      ref_id: receipt.id,
      ref_no: receipt.receipt_no,
      status: fwd.ok ? "ok" : "error",
      payload: {
        receipt_no: receipt.receipt_no,
        box_count: receipt.received_boxes,
      },
      response: fwd.error ?? "ok",
    });

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("wh_receipts")
      .update({
        status: "confirmed",
        confirmed_at: confirmedAt,
        vision_checks: data.vision_checks ?? [],
        backoffice_synced_at: fwd.ok ? confirmedAt : null,
        backoffice_sync_error: fwd.error ?? "",
        updated_at: confirmedAt,
      })
      .eq("id", data.receiptId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);
    return updated;
  });

export const whListReceipts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        status: z.enum(["draft", "confirmed", "cancelled", "all"]).default("all"),
        limit: z.number().int().max(500).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    let q = supabaseAdmin
      .from("wh_receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const whLookupBox = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, boxCode: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: box, error } = await supabaseAdmin
      .from("wh_boxes")
      .select("*, wh_receipts(receipt_no, item_code, item_name, lot_no, status)")
      .eq("box_code", data.boxCode.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!box) return null;
    let pallet = null;
    if (box.pallet_id) {
      const { data: p } = await supabaseAdmin
        .from("wh_pallets")
        .select("pallet_no, status, counted_boxes, target_boxes")
        .eq("id", box.pallet_id)
        .maybeSingle();
      pallet = p;
    }
    return { box, pallet };
  });

export const adminWhListReceipts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        status: z.enum(["draft", "confirmed", "cancelled", "all"]).default("all"),
        limit: z.number().int().max(1000).default(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    let q = supabaseAdmin
      .from("wh_receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
