// Office Supplies — Requests / Approval / Stock movement server functions.
// Public (office token): submit a request (pending only, never deducts stock).
// Admin (admin token): list / approve / reject / restock / dashboard summary.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";
import { verifyOfficeToken } from "./office-token.server";

const tokenStr = z.string().min(1);

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}
function assertOfficeOrAdmin(token: string | undefined) {
  if (verifyOfficeToken(token)) return;
  if (verifyAdminToken(token)) return;
  throw new Error("Unauthorized");
}

// ============ SUBMIT (public/office) ============
const submitInput = z.object({
  token: tokenStr,
  requester_employee_id: z.string().uuid(),
  items: z.array(z.object({
    asset_id: z.string().uuid(),
    qty: z.number().int().min(1).max(9999),
  })).min(1).max(50),
  note: z.string().trim().max(500).optional(),
});

export const officeSubmitRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitInput.parse(d))
  .handler(async ({ data }) => {
    assertOfficeOrAdmin(data.token);

    // load requester
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("office_employees")
      .select("id, name, active")
      .eq("id", data.requester_employee_id)
      .single();
    if (empErr || !emp) throw new Error("ไม่พบพนักงาน");
    if (!emp.active) throw new Error("พนักงานถูกปิดใช้งาน");

    // load assets (snapshots)
    const ids = Array.from(new Set(data.items.map((i) => i.asset_id)));
    const { data: assets, error: aErr } = await supabaseAdmin
      .from("office_assets")
      .select("id, name, purchase_price, active")
      .in("id", ids);
    if (aErr) throw new Error(aErr.message);
    const map = new Map((assets ?? []).map((a) => [a.id, a]));
    for (const it of data.items) {
      const a = map.get(it.asset_id);
      if (!a) throw new Error("ไม่พบรายการสินค้า");
      if (!a.active) throw new Error(`"${a.name}" ถูกปิดใช้งาน`);
    }

    // create request
    const { data: req, error: rErr } = await supabaseAdmin
      .from("office_requests")
      .insert({
        requester_employee_id: emp.id,
        requester_name: emp.name,
        status: "pending",
        note: data.note ?? null,
      })
      .select("id, req_no")
      .single();
    if (rErr || !req) throw new Error(rErr?.message || "บันทึกคำขอไม่สำเร็จ");

    // items
    const itemsRows = data.items.map((it) => {
      const a = map.get(it.asset_id)!;
      return {
        request_id: req.id,
        asset_id: it.asset_id,
        asset_name_snapshot: a.name,
        unit_price_snapshot: Number(a.purchase_price ?? 0),
        qty: it.qty,
      };
    });
    const { error: iErr } = await supabaseAdmin
      .from("office_request_items").insert(itemsRows);
    if (iErr) {
      // rollback header
      await supabaseAdmin.from("office_requests").delete().eq("id", req.id);
      throw new Error(iErr.message);
    }

    return { ok: true, id: req.id, req_no: req.req_no };
  });

// ============ ADMIN: LIST ============
export const adminListOfficeRequests = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      status: z.enum(["pending", "approved", "rejected", "cancelled", "all"]).default("pending"),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    let q = supabaseAdmin
      .from("office_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: reqs, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (reqs ?? []).map((r) => r.id);
    let items: Array<{
      id: string; request_id: string; asset_id: string;
      asset_name_snapshot: string; unit_price_snapshot: number; qty: number;
    }> = [];
    if (ids.length) {
      const { data: its } = await supabaseAdmin
        .from("office_request_items")
        .select("id, request_id, asset_id, asset_name_snapshot, unit_price_snapshot, qty")
        .in("request_id", ids);
      items = (its ?? []) as typeof items;
    }
    const byReq = new Map<string, typeof items>();
    for (const it of items) {
      const arr = byReq.get(it.request_id) ?? [];
      arr.push(it);
      byReq.set(it.request_id, arr);
    }
    return {
      rows: (reqs ?? []).map((r) => {
        const its = byReq.get(r.id) ?? [];
        const total = its.reduce(
          (s, x) => s + Number(x.unit_price_snapshot) * x.qty, 0,
        );
        return { ...r, items: its, total_value: Math.round(total * 100) / 100 };
      }),
    };
  });

// ============ ADMIN: APPROVE ============
export const adminApproveOfficeRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      id: z.string().uuid(),
      approver_employee_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);

    const { data: req, error: rErr } = await supabaseAdmin
      .from("office_requests").select("*").eq("id", data.id).single();
    if (rErr || !req) throw new Error("ไม่พบคำขอ");
    if (req.status !== "pending") throw new Error("คำขอถูกดำเนินการแล้ว");

    const { data: approver, error: apErr } = await supabaseAdmin
      .from("office_employees").select("id, name, active").eq("id", data.approver_employee_id).single();
    if (apErr || !approver) throw new Error("ไม่พบพนักงานผู้อนุมัติ");

    const { data: items, error: iErr } = await supabaseAdmin
      .from("office_request_items").select("*").eq("request_id", data.id);
    if (iErr) throw new Error(iErr.message);
    if (!items || items.length === 0) throw new Error("คำขอนี้ไม่มีรายการ");

    // re-check stock
    const ids = Array.from(new Set(items.map((i) => i.asset_id)));
    const { data: assets, error: aErr } = await supabaseAdmin
      .from("office_assets").select("id, name, stock_qty").in("id", ids);
    if (aErr) throw new Error(aErr.message);
    const stockMap = new Map((assets ?? []).map((a) => [a.id, a]));
    // aggregate needed
    const need = new Map<string, number>();
    for (const it of items) need.set(it.asset_id, (need.get(it.asset_id) ?? 0) + it.qty);
    for (const [aid, q] of need.entries()) {
      const a = stockMap.get(aid);
      if (!a) throw new Error("ไม่พบสินค้า");
      if ((a.stock_qty ?? 0) < q) throw new Error(`สต๊อกไม่พอ: ${a.name} (เหลือ ${a.stock_qty}, ต้องการ ${q})`);
    }

    // deduct stock + log movements
    for (const [aid, q] of need.entries()) {
      const a = stockMap.get(aid)!;
      const newQty = (a.stock_qty ?? 0) - q;
      const { error: uErr } = await supabaseAdmin
        .from("office_assets").update({ stock_qty: newQty }).eq("id", aid);
      if (uErr) throw new Error(uErr.message);
    }

    const movements = items.map((it) => ({
      asset_id: it.asset_id,
      delta: -it.qty,
      reason: "issue",
      request_id: req.id,
      unit_price_snapshot: Number(it.unit_price_snapshot ?? 0),
      note: `เบิกตามคำขอ ${req.req_no}`,
    }));
    const { error: mErr } = await supabaseAdmin
      .from("office_stock_movements").insert(movements);
    if (mErr) throw new Error(mErr.message);

    const { error: upErr } = await supabaseAdmin
      .from("office_requests")
      .update({
        status: "approved",
        approver_employee_id: approver.id,
        approver_name: approver.name,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

// ============ ADMIN: REJECT ============
export const adminRejectOfficeRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      id: z.string().uuid(),
      approver_employee_id: z.string().uuid().optional(),
      reason: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: req } = await supabaseAdmin
      .from("office_requests").select("status").eq("id", data.id).single();
    if (!req) throw new Error("ไม่พบคำขอ");
    if (req.status !== "pending") throw new Error("คำขอถูกดำเนินการแล้ว");

    let approverName: string | null = null;
    if (data.approver_employee_id) {
      const { data: ap } = await supabaseAdmin
        .from("office_employees").select("name").eq("id", data.approver_employee_id).single();
      approverName = ap?.name ?? null;
    }

    const { error } = await supabaseAdmin
      .from("office_requests")
      .update({
        status: "rejected",
        approver_employee_id: data.approver_employee_id ?? null,
        approver_name: approverName,
        approved_at: new Date().toISOString(),
        reject_reason: data.reason ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ADMIN: RESTOCK ============
export const adminOfficeRestock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      asset_id: z.string().uuid(),
      qty: z.number().int().min(1).max(99999),
      note: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: a } = await supabaseAdmin
      .from("office_assets").select("id, name, stock_qty, purchase_price").eq("id", data.asset_id).single();
    if (!a) throw new Error("ไม่พบสินค้า");
    const newQty = (a.stock_qty ?? 0) + data.qty;
    const { error: uErr } = await supabaseAdmin
      .from("office_assets").update({ stock_qty: newQty }).eq("id", data.asset_id);
    if (uErr) throw new Error(uErr.message);
    const { error: mErr } = await supabaseAdmin
      .from("office_stock_movements").insert({
        asset_id: data.asset_id,
        delta: data.qty,
        reason: "restock",
        unit_price_snapshot: Number(a.purchase_price ?? 0),
        note: data.note ?? null,
      });
    if (mErr) throw new Error(mErr.message);
    return { ok: true, new_stock: newQty };
  });

// ============ ADMIN: DASHBOARD ============
export const adminOfficeStockDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [pendings, lowStock, monthMoves, allIssueMoves] = await Promise.all([
      supabaseAdmin.from("office_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("office_assets")
        .select("id, code, name, stock_qty, min_qty, unit, image_url, category_id")
        .eq("active", true)
        .order("stock_qty"),
      supabaseAdmin.from("office_stock_movements")
        .select("delta, unit_price_snapshot, reason, asset_id, created_at")
        .gte("created_at", monthStart),
      supabaseAdmin.from("office_stock_movements")
        .select("delta, unit_price_snapshot, reason, asset_id")
        .eq("reason", "issue"),
    ]);

    if (pendings.error) throw new Error(pendings.error.message);
    if (lowStock.error) throw new Error(lowStock.error.message);
    if (monthMoves.error) throw new Error(monthMoves.error.message);
    if (allIssueMoves.error) throw new Error(allIssueMoves.error.message);

    const lowList = (lowStock.data ?? []).filter(
      (a) => (a.stock_qty ?? 0) <= (a.min_qty ?? 0),
    );

    // monthly spend = sum(|delta| * unit_price) for issues this month
    let monthSpend = 0;
    for (const m of monthMoves.data ?? []) {
      if (m.reason === "issue") {
        monthSpend += Math.abs(m.delta) * Number(m.unit_price_snapshot ?? 0);
      }
    }

    // lifetime spend + top consumed
    let totalSpend = 0;
    const consumeByAsset = new Map<string, number>();
    for (const m of allIssueMoves.data ?? []) {
      const qty = Math.abs(m.delta);
      totalSpend += qty * Number(m.unit_price_snapshot ?? 0);
      consumeByAsset.set(m.asset_id, (consumeByAsset.get(m.asset_id) ?? 0) + qty);
    }
    const topIds = Array.from(consumeByAsset.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 10);
    let topConsumed: Array<{ id: string; name: string; code: string; qty: number }> = [];
    if (topIds.length) {
      const { data: ta } = await supabaseAdmin
        .from("office_assets").select("id, name, code").in("id", topIds.map(([id]) => id));
      const nameMap = new Map((ta ?? []).map((a) => [a.id, a]));
      topConsumed = topIds.map(([id, qty]) => {
        const a = nameMap.get(id);
        return { id, qty, name: a?.name ?? "—", code: a?.code ?? "" };
      });
    }

    return {
      pending_count: pendings.count ?? 0,
      low_stock_count: lowList.length,
      month_spend: Math.round(monthSpend * 100) / 100,
      total_spend: Math.round(totalSpend * 100) / 100,
      low_stock: lowList,
      top_consumed: topConsumed,
    };
  });

// ============ ADMIN: RECENT MOVEMENTS ============
export const adminOfficeMovements = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      limit: z.number().int().min(1).max(500).default(50),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: moves, error } = await supabaseAdmin
      .from("office_stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((moves ?? []).map((m) => m.asset_id)));
    let names = new Map<string, { name: string; code: string }>();
    if (ids.length) {
      const { data: a } = await supabaseAdmin
        .from("office_assets").select("id, name, code").in("id", ids);
      names = new Map((a ?? []).map((x) => [x.id, { name: x.name, code: x.code }]));
    }
    return {
      rows: (moves ?? []).map((m) => ({
        ...m,
        asset_name: names.get(m.asset_id)?.name ?? "—",
        asset_code: names.get(m.asset_id)?.code ?? "",
      })),
    };
  });

// ============ PUBLIC: list office employees (for request form) ============
export const officeListEmployees = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertOfficeOrAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("office_employees")
      .select("id, name, emp_code, avatar_url, active")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
