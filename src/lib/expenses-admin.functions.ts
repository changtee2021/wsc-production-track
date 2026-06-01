// Admin-side expense workflow: list / approve / reject / mark paid / badge / monthly report.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";
import { notifyExpenseStatusChanged } from "./line-notify.server";
import {
  monthlyDepreciation, accumulatedDepreciation, bookValue,
  type DepreciableAsset,
} from "./depreciation.server";

const tokenStr = z.string().min(1);
function assertAdmin(t: string | undefined) {
  if (!verifyAdminToken(t)) throw new Error("Unauthorized");
}

// ============ BADGE COUNTS ============
export const adminExpenseBadgeCounts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const [pending, dup] = await Promise.all([
      supabaseAdmin.from("expenses").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("expenses").select("id", { count: "exact", head: true })
        .eq("status", "pending").not("duplicate_of", "is", null),
    ]);
    return { pending: pending.count ?? 0, duplicates: dup.count ?? 0 };
  });

// ============ LIST ============
export const adminExpenseList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      status: z.enum(["pending", "approved", "rejected", "paid", "all"]).default("pending"),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    let q = supabaseAdmin.from("expenses").select("*")
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Sign image urls
    const allPaths = Array.from(new Set((rows ?? []).flatMap((r) => r.image_paths ?? [])));
    const urlMap: Record<string, string> = {};
    if (allPaths.length) {
      const { data: signed } = await supabaseAdmin.storage
        .from("expense-receipts").createSignedUrls(allPaths, 60 * 60);
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) urlMap[allPaths[i]] = s.signedUrl;
      });
    }
    // Load category names
    const catIds = Array.from(new Set((rows ?? []).map((r) => r.category_id).filter(Boolean) as string[]));
    const cats: Record<string, string> = {};
    if (catIds.length) {
      const { data: c } = await supabaseAdmin
        .from("expense_categories").select("id, name").in("id", catIds);
      (c ?? []).forEach((x) => { cats[x.id] = x.name; });
    }
    return { rows: rows ?? [], urlMap, categories: cats };
  });

// ============ APPROVE ============
export const adminExpenseApprove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      id: z.string().uuid(),
      approver_employee_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: row } = await supabaseAdmin
      .from("expenses").select("*").eq("id", data.id).single();
    if (!row) throw new Error("ไม่พบรายการ");
    if (row.status !== "pending") throw new Error("รายการนี้ถูกดำเนินการแล้ว");

    const { data: ap } = await supabaseAdmin
      .from("office_employees").select("name").eq("id", data.approver_employee_id).maybeSingle();
    const approverName = ap?.name ?? null;

    const { error } = await supabaseAdmin.from("expenses").update({
      status: "approved",
      approver_employee_id: data.approver_employee_id,
      approver_name: approverName,
      approved_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("expense_status_history").insert({
      expense_id: data.id, from_status: "pending", to_status: "approved",
      changed_by: approverName, note: null,
    });

    notifyExpenseStatusChanged({
      exp_no: row.exp_no, requester_name: row.requester_name,
      status: "approved", approver_name: approverName,
      total: Number(row.total_amount),
    }).catch(() => {});
    return { ok: true };
  });

// ============ REJECT ============
export const adminExpenseReject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      id: z.string().uuid(),
      approver_employee_id: z.string().uuid().optional(),
      reason: z.string().trim().min(1).max(300),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: row } = await supabaseAdmin
      .from("expenses").select("*").eq("id", data.id).single();
    if (!row) throw new Error("ไม่พบรายการ");
    if (row.status !== "pending") throw new Error("รายการนี้ถูกดำเนินการแล้ว");

    let approverName: string | null = null;
    if (data.approver_employee_id) {
      const { data: ap } = await supabaseAdmin
        .from("office_employees").select("name").eq("id", data.approver_employee_id).maybeSingle();
      approverName = ap?.name ?? null;
    }
    const { error } = await supabaseAdmin.from("expenses").update({
      status: "rejected",
      approver_employee_id: data.approver_employee_id ?? null,
      approver_name: approverName,
      approved_at: new Date().toISOString(),
      reject_reason: data.reason,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("expense_status_history").insert({
      expense_id: data.id, from_status: "pending", to_status: "rejected",
      changed_by: approverName, note: data.reason,
    });

    notifyExpenseStatusChanged({
      exp_no: row.exp_no, requester_name: row.requester_name,
      status: "rejected", approver_name: approverName,
      reason: data.reason, total: Number(row.total_amount),
    }).catch(() => {});
    return { ok: true };
  });

// ============ MARK PAID ============
export const adminExpenseMarkPaid = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      id: z.string().uuid(),
      paid_by: z.string().trim().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: row } = await supabaseAdmin
      .from("expenses").select("*").eq("id", data.id).single();
    if (!row) throw new Error("ไม่พบรายการ");
    if (row.status !== "approved") throw new Error("ต้องอนุมัติก่อนถึงจะจ่ายได้");

    const { error } = await supabaseAdmin.from("expenses").update({
      status: "paid", paid_at: new Date().toISOString(), paid_by: data.paid_by,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("expense_status_history").insert({
      expense_id: data.id, from_status: "approved", to_status: "paid",
      changed_by: data.paid_by, note: null,
    });
    notifyExpenseStatusChanged({
      exp_no: row.exp_no, requester_name: row.requester_name,
      status: "paid", approver_name: data.paid_by,
      total: Number(row.total_amount),
    }).catch(() => {});
    return { ok: true };
  });

// ============ BULK APPROVE ============
export const adminExpenseBulkApprove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      ids: z.array(z.string().uuid()).min(1).max(100),
      approver_employee_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: ap } = await supabaseAdmin
      .from("office_employees").select("name").eq("id", data.approver_employee_id).maybeSingle();
    const approverName = ap?.name ?? null;
    let ok = 0; let fail = 0;
    for (const id of data.ids) {
      const { data: row } = await supabaseAdmin
        .from("expenses").select("status, exp_no, requester_name, total_amount").eq("id", id).single();
      if (!row || row.status !== "pending") { fail++; continue; }
      const { error } = await supabaseAdmin.from("expenses").update({
        status: "approved", approver_employee_id: data.approver_employee_id,
        approver_name: approverName, approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) { fail++; continue; }
      await supabaseAdmin.from("expense_status_history").insert({
        expense_id: id, from_status: "pending", to_status: "approved",
        changed_by: approverName, note: "bulk approve",
      });
      notifyExpenseStatusChanged({
        exp_no: row.exp_no, requester_name: row.requester_name,
        status: "approved", approver_name: approverName,
        total: Number(row.total_amount),
      }).catch(() => {});
      ok++;
    }
    return { ok, fail };
  });

// ============ MONTHLY REPORT ============
export const adminExpenseMonthlyReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      year: z.number().int().min(2000).max(2100),
      month: z.number().int().min(1).max(12),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const start = new Date(Date.UTC(data.year, data.month - 1, 1));
    const end = new Date(Date.UTC(data.year, data.month, 1));
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("expenses").select("*")
      .gte("created_at", startISO).lt("created_at", endISO)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const approvedOrPaid = list.filter((r) => r.status === "approved" || r.status === "paid");

    const totalExpense = approvedOrPaid.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const vatTotal = approvedOrPaid.reduce((s, r) => s + Number(r.vat_amount ?? 0), 0);
    const subtotalTotal = approvedOrPaid.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);

    // by status
    const byStatus: Record<string, { count: number; total: number }> = {};
    for (const r of list) {
      const s = r.status;
      byStatus[s] = byStatus[s] ?? { count: 0, total: 0 };
      byStatus[s].count++;
      byStatus[s].total += Number(r.total_amount ?? 0);
    }
    // by category
    const catIds = Array.from(new Set(approvedOrPaid.map((r) => r.category_id).filter(Boolean) as string[]));
    const catMap: Record<string, string> = {};
    if (catIds.length) {
      const { data: c } = await supabaseAdmin
        .from("expense_categories").select("id, name").in("id", catIds);
      (c ?? []).forEach((x) => { catMap[x.id] = x.name; });
    }
    const byCategory: Record<string, { name: string; count: number; total: number }> = {};
    for (const r of approvedOrPaid) {
      const id = r.category_id ?? "uncat";
      const name = id === "uncat" ? "ไม่ระบุหมวด" : (catMap[id] ?? "—");
      byCategory[id] = byCategory[id] ?? { name, count: 0, total: 0 };
      byCategory[id].count++;
      byCategory[id].total += Number(r.total_amount ?? 0);
    }
    // by bill type
    const byBillType: Record<string, { count: number; total: number; vat: number }> = {};
    for (const r of approvedOrPaid) {
      const t = r.bill_type;
      byBillType[t] = byBillType[t] ?? { count: 0, total: 0, vat: 0 };
      byBillType[t].count++;
      byBillType[t].total += Number(r.total_amount ?? 0);
      byBillType[t].vat += Number(r.vat_amount ?? 0);
    }
    // by requester
    const byRequester: Record<string, { name: string; count: number; total: number }> = {};
    for (const r of approvedOrPaid) {
      const k = r.requester_employee_id ?? r.requester_name;
      byRequester[k] = byRequester[k] ?? { name: r.requester_name, count: 0, total: 0 };
      byRequester[k].count++;
      byRequester[k].total += Number(r.total_amount ?? 0);
    }

    // Depreciation: monthly straight-line for all office_assets
    const { data: assets } = await supabaseAdmin
      .from("office_assets")
      .select("id, name, code, purchase_price, salvage_value, useful_life_months, purchase_date")
      .eq("active", true);
    const depRows = (assets ?? [])
      .map((a) => {
        const da: DepreciableAsset = {
          id: a.id, name: a.name, code: a.code,
          purchase_price: a.purchase_price ?? null,
          salvage_value: a.salvage_value ?? null,
          useful_life_months: a.useful_life_months ?? null,
          purchase_date: a.purchase_date ?? null,
        };
        const monthly = monthlyDepreciation(da);
        return monthly > 0 ? {
          id: a.id, name: a.name, code: a.code,
          purchase_price: Number(a.purchase_price ?? 0),
          monthly,
          accumulated: accumulatedDepreciation(da, end),
          book_value: bookValue(da, end),
        } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const depMonthlyTotal = depRows.reduce((s, r) => s + r.monthly, 0);

    return {
      period: { year: data.year, month: data.month },
      totals: {
        total_expense: Math.round(totalExpense * 100) / 100,
        vat: Math.round(vatTotal * 100) / 100,
        subtotal: Math.round(subtotalTotal * 100) / 100,
        depreciation_monthly: Math.round(depMonthlyTotal * 100) / 100,
        grand_total: Math.round((totalExpense + depMonthlyTotal) * 100) / 100,
        record_count: list.length,
        approved_count: approvedOrPaid.length,
      },
      by_status: byStatus,
      by_category: Object.values(byCategory).sort((a, b) => b.total - a.total),
      by_bill_type: byBillType,
      by_requester: Object.values(byRequester).sort((a, b) => b.total - a.total),
      depreciation_rows: depRows.sort((a, b) => b.monthly - a.monthly),
      rows: list,
    };
  });

// ============ LINK TO OFFICE REQUEST ============
export const adminExpenseLinkRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      id: z.string().uuid(),
      linked_office_request_id: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin.from("expenses")
      .update({ linked_office_request_id: data.linked_office_request_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
