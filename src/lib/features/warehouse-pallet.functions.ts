import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWarehouseToken } from "@/lib/auth/warehouse-token.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { loadSettingSection } from "@/lib/features/warehouse-settings.functions";
import { formatAutoNo } from "@/lib/warehouse/format";
import type { PalletStatus, ScanResult } from "@/lib/warehouse/types";

const tokenStr = z.string().min(1);

function requireWorker(token: string): void {
  if (!verifyWarehouseToken(token)) throw new Error("Unauthorized");
}

async function nextPalletNo(): Promise<string> {
  const pallet = await loadSettingSection("pallet");
  const format = String(pallet.pallet_no_format ?? "PLT-{date:YYYYMMDD}-{seq:03d}");
  const { count } = await supabaseAdmin
    .from("wh_pallets")
    .select("id", { count: "exact", head: true });
  return formatAutoNo(format, { seq: (count ?? 0) + 1 });
}

export const whCreatePallet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        receiptId: z.string().uuid(),
        empCode: z.string().min(1).max(64),
        empName: z.string().min(1).max(200),
        boxes_per_layer: z.number().int().positive().max(200).optional(),
        layers: z.number().int().positive().max(50).optional(),
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
    if (receipt.status !== "confirmed") throw new Error("ต้องยืนยันรับของก่อนจัด Pallet");

    const palletSettings = await loadSettingSection("pallet");
    const bpl = data.boxes_per_layer ?? Number(palletSettings.default_boxes_per_layer ?? 12);
    const layers = data.layers ?? Number(palletSettings.default_layers ?? 8);
    const target = bpl * layers;
    const palletNo = await nextPalletNo();

    const { data: row, error } = await supabaseAdmin
      .from("wh_pallets")
      .insert({
        pallet_no: palletNo,
        receipt_id: data.receiptId,
        boxes_per_layer: bpl,
        layers,
        target_boxes: target,
        status: "open",
        opened_by_emp_code: data.empCode.trim(),
        opened_by_name: data.empName.trim(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const whStartPalletCounting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, palletId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("wh_pallets")
      .update({ status: "counting", updated_at: new Date().toISOString() })
      .eq("id", data.palletId)
      .in("status", ["open", "counting"])
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const whScanPalletBox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        palletId: z.string().uuid(),
        boxCode: z.string().min(1).max(128),
        empCode: z.string().min(1).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const scanSettings = await loadSettingSection("scan");
    const palletSettings = await loadSettingSection("pallet");

    const { data: pallet, error: pErr } = await supabaseAdmin
      .from("wh_pallets")
      .select("*, wh_receipts(lot_no, item_code)")
      .eq("id", data.palletId)
      .single();
    if (pErr || !pallet) throw new Error("ไม่พบ Pallet");
    if (!["open", "counting", "incomplete"].includes(pallet.status)) {
      throw new Error("Pallet ปิดแล้ว");
    }

    const { data: box, error: bErr } = await supabaseAdmin
      .from("wh_boxes")
      .select("*")
      .eq("box_code", data.boxCode.trim())
      .maybeSingle();

    let result: ScanResult = "ok";
    let message = "";

    if (!box) {
      result = "not_found";
      message = "ไม่พบกล่องในระบบ";
    } else if (box.receipt_id !== pallet.receipt_id) {
      result = "wrong_product";
      message = "กล่องไม่ตรงกับใบรับของของ Pallet นี้";
    } else if (
      !palletSettings.mixed_lot_allowed &&
      box.lot_no !== (pallet.wh_receipts as { lot_no: string })?.lot_no
    ) {
      result = "wrong_lot";
      message = "Lot ไม่ตรง";
    } else if (box.pallet_id && box.pallet_id !== data.palletId) {
      result = "duplicate";
      message = "กล่องอยู่ใน Pallet อื่นแล้ว";
    } else {
      const { data: dupScan } = await supabaseAdmin
        .from("wh_pallet_scans")
        .select("id")
        .eq("pallet_id", data.palletId)
        .eq("box_id", box.id)
        .eq("scan_result", "ok")
        .maybeSingle();
      if (dupScan) {
        result = "duplicate";
        message = "สแกนซ้ำใน Pallet นี้";
      }
    }

    if (result === "ok" && pallet.counted_boxes >= pallet.target_boxes) {
      result = "over_capacity";
      message = "เกินจำนวนเป้าหมาย";
    }

    const block =
      (result === "duplicate" && scanSettings.duplicate_scan_action === "reject") ||
      (result === "over_capacity" && scanSettings.over_capacity_action === "block") ||
      (result === "wrong_lot" && scanSettings.wrong_lot_action === "block") ||
      (result === "wrong_product" && scanSettings.wrong_lot_action === "block") ||
      result === "not_found";

    await supabaseAdmin.from("wh_pallet_scans").insert({
      pallet_id: data.palletId,
      box_id: box?.id ?? null,
      box_code: data.boxCode.trim(),
      scan_result: result,
      scanned_by_emp_code: data.empCode.trim(),
    });

    if (result !== "ok") {
      return {
        ok: false,
        result,
        message,
        counted_boxes: pallet.counted_boxes,
        target_boxes: pallet.target_boxes,
        blocked: block,
      };
    }

    await supabaseAdmin
      .from("wh_boxes")
      .update({
        pallet_id: data.palletId,
        status: "on_pallet",
        scanned_at: new Date().toISOString(),
        scanned_by_emp_code: data.empCode.trim(),
      })
      .eq("id", box!.id);

    const newCount = pallet.counted_boxes + 1;
    let newStatus: PalletStatus = pallet.status === "open" ? "counting" : pallet.status;
    if (newCount >= pallet.target_boxes) newStatus = "complete";

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("wh_pallets")
      .update({
        counted_boxes: newCount,
        status: newStatus,
        completed_at: newStatus === "complete" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.palletId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    const threshold = Number(scanSettings.almost_full_threshold_pct ?? 80);
    const pct = (newCount / pallet.target_boxes) * 100;
    const almostFull = pct >= threshold && newCount < pallet.target_boxes;

    return {
      ok: true,
      result: "ok" as ScanResult,
      message:
        newStatus === "complete"
          ? "ครบแล้ว!"
          : almostFull
            ? `เหลืออีก ${pallet.target_boxes - newCount} กล่อง`
            : "",
      counted_boxes: newCount,
      target_boxes: pallet.target_boxes,
      pallet: updated,
      almost_full: almostFull,
      blocked: false,
    };
  });

export const whClosePallet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        palletId: z.string().uuid(),
        reasonCode: z.string().max(32).default(""),
        note: z.string().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const palletSettings = await loadSettingSection("pallet");
    const { data: pallet, error } = await supabaseAdmin
      .from("wh_pallets")
      .select("*")
      .eq("id", data.palletId)
      .single();
    if (error || !pallet) throw new Error("ไม่พบ Pallet");

    if (pallet.counted_boxes >= pallet.target_boxes) {
      const { data: updated } = await supabaseAdmin
        .from("wh_pallets")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.palletId)
        .select("*")
        .single();
      return updated;
    }

    if (!palletSettings.allow_manual_close_incomplete) {
      throw new Error("ไม่อนุญาตปิด Pallet ก่อนครบ");
    }

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("wh_pallets")
      .update({
        status: "incomplete",
        closed_reason_code: data.reasonCode,
        closed_note: data.note,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.palletId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);
    return updated;
  });

export const whListPallets = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        status: z
          .enum(["open", "counting", "complete", "incomplete", "loaded", "all"])
          .default("all"),
        limit: z.number().int().max(500).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    let q = supabaseAdmin
      .from("wh_pallets")
      .select("*, wh_receipts(receipt_no, item_code, item_name, lot_no)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const whGetPallet = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, palletId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("wh_pallets")
      .select("*, wh_receipts(receipt_no, item_code, item_name, lot_no)")
      .eq("id", data.palletId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminWhListPallets = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        status: z
          .enum(["open", "counting", "complete", "incomplete", "loaded", "all"])
          .default("all"),
        limit: z.number().int().max(1000).default(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    let q = supabaseAdmin
      .from("wh_pallets")
      .select("*, wh_receipts(receipt_no, item_code, item_name, lot_no)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
