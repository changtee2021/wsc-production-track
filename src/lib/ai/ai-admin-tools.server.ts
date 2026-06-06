// AI tool definitions for the admin assistant. Each tool queries Supabase
// (via admin client) and returns a compact, serializable result that the
// model can quote in its reply. All tools are READ-ONLY.
import { tool } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  monthlyDepreciation,
  accumulatedDepreciation,
  bookValue,
  type DepreciableAsset,
} from "@/lib/features/depreciation.server";

const sinceISO = (days: number) =>
  new Date(Date.now() - Math.max(1, days) * 86400000).toISOString();

const monthRange = (ym?: string) => {
  const now = new Date();
  const [y, m] = ym
    ? ym.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y, m ?? 1, 1));
  return { start: start.toISOString(), end: end.toISOString(), ym: `${y}-${String(m).padStart(2, "0")}` };
};

export const adminTools = {
  getProductionSummary: tool({
    description:
      "สรุปข้อมูลการผลิตจาก production_logs: จำนวน start/finish, จำนวน job, จำนวนพนักงานที่ทำงาน ตามช่วงวันที่ระบุ",
    inputSchema: z.object({ days: z.number().int().min(1).max(365).default(30) }),
    execute: async ({ days }) => {
      const since = sinceISO(days);
      const { data } = await supabaseAdmin
        .from("production_logs")
        .select("job_id, action, employee_id")
        .gte("created_at", since)
        .limit(5000);
      const rows = data ?? [];
      const jobs = new Set(rows.map((r) => r.job_id));
      const emps = new Set(rows.map((r) => r.employee_id).filter(Boolean));
      return {
        days,
        totalLogs: rows.length,
        uniqueJobs: jobs.size,
        uniqueEmployees: emps.size,
        starts: rows.filter((r) => r.action === "start").length,
        finishes: rows.filter((r) => r.action === "finish").length,
      };
    },
  }),

  getEmployeeStats: tool({
    description: "อันดับพนักงาน: จำนวน step ที่ปิด + เวลาเฉลี่ยต่อ step (นาที) ใน N วัน",
    inputSchema: z.object({
      days: z.number().int().min(1).max(365).default(30),
      limit: z.number().int().min(1).max(50).default(15),
    }),
    execute: async ({ days, limit }) => {
      const since = sinceISO(days);
      const { data } = await supabaseAdmin
        .from("production_logs")
        .select("job_id, action, created_at, employee_id, step_id, employees(name)")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);
      const rows = (data ?? []) as Array<{
        job_id: string; action: string; created_at: string;
        employee_id: string; step_id: string; employees: { name: string } | null;
      }>;
      const starts = new Map<string, string>();
      const agg = new Map<string, { jobs: Set<string>; total: number; count: number }>();
      for (const r of rows) {
        const name = r.employees?.name ?? "?";
        const k = `${r.job_id}|${r.employee_id}|${r.step_id}`;
        if (r.action === "start") starts.set(k, r.created_at);
        else if (r.action === "finish") {
          const s = starts.get(k);
          const mins = s ? Math.max(0, (Date.parse(r.created_at) - Date.parse(s)) / 60000) : 0;
          starts.delete(k);
          const a = agg.get(name) ?? { jobs: new Set(), total: 0, count: 0 };
          a.jobs.add(r.job_id); a.total += mins; a.count += 1;
          agg.set(name, a);
        }
      }
      return [...agg.entries()]
        .map(([name, v]) => ({ name, jobs: v.jobs.size, finished: v.count, avgMin: v.count ? Math.round(v.total / v.count) : 0 }))
        .sort((a, b) => b.finished - a.finished)
        .slice(0, limit);
    },
  }),

  getStepStats: tool({
    description: "สถิติแต่ละขั้นตอนการผลิต: จำนวนครั้งที่ทำเสร็จ + เวลาเฉลี่ย + std_duration เพื่อหา bottleneck",
    inputSchema: z.object({ days: z.number().int().min(1).max(365).default(30) }),
    execute: async ({ days }) => {
      const since = sinceISO(days);
      const [logsRes, stepsRes] = await Promise.all([
        supabaseAdmin
          .from("production_logs")
          .select("job_id, action, created_at, employee_id, step_id, steps(step_name)")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(5000),
        supabaseAdmin.from("steps").select("step_name, std_duration_minutes").eq("active", true),
      ]);
      const rows = (logsRes.data ?? []) as Array<{
        job_id: string; action: string; created_at: string;
        employee_id: string; step_id: string; steps: { step_name: string } | null;
      }>;
      const starts = new Map<string, string>();
      const agg = new Map<string, { count: number; total: number }>();
      for (const r of rows) {
        const name = r.steps?.step_name ?? "?";
        const k = `${r.job_id}|${r.employee_id}|${r.step_id}`;
        if (r.action === "start") starts.set(k, r.created_at);
        else if (r.action === "finish") {
          const s = starts.get(k);
          const mins = s ? Math.max(0, (Date.parse(r.created_at) - Date.parse(s)) / 60000) : 0;
          starts.delete(k);
          const a = agg.get(name) ?? { count: 0, total: 0 };
          a.count += 1; a.total += mins;
          agg.set(name, a);
        }
      }
      const stdMap = new Map(
        (stepsRes.data ?? []).map((s) => [s.step_name, s.std_duration_minutes ?? null] as const),
      );
      return [...agg.entries()]
        .map(([name, v]) => ({
          name, count: v.count,
          avgMin: v.count ? Math.round(v.total / v.count) : 0,
          stdMin: stdMap.get(name) ?? null,
        }))
        .sort((a, b) => b.avgMin - a.avgMin);
    },
  }),

  getQcSummary: tool({
    description: "สรุปรายงาน QC ใน N วัน: จำนวน open/resolved + รายการล่าสุด",
    inputSchema: z.object({
      days: z.number().int().min(1).max(365).default(30),
      status: z.enum(["open", "resolved", "all"]).default("all"),
    }),
    execute: async ({ days, status }) => {
      const since = sinceISO(days);
      let q = supabaseAdmin
        .from("qc_reports")
        .select("id, job_id, status, overall_result, summary, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      const rows = data ?? [];
      return {
        total: rows.length,
        open: rows.filter((r) => r.status === "open").length,
        resolved: rows.filter((r) => r.status === "resolved").length,
        recent: rows.slice(0, 10),
      };
    },
  }),

  getPackingSummary: tool({
    description: "สรุปรายงานการแพ็คสินค้าใน N วัน",
    inputSchema: z.object({ days: z.number().int().min(1).max(365).default(30) }),
    execute: async ({ days }) => {
      const since = sinceISO(days);
      const { data } = await supabaseAdmin
        .from("packing_reports")
        .select("id, job_id, status, overall_result, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = data ?? [];
      return {
        total: rows.length,
        open: rows.filter((r) => r.status === "open").length,
        recent: rows.slice(0, 10),
      };
    },
  }),

  getMaintenanceTickets: tool({
    description: "ใบแจ้งซ่อม: นับตามสถานะ + รายการล่าสุด + MTTR เฉลี่ย (ชม.)",
    inputSchema: z.object({
      days: z.number().int().min(1).max(365).default(60),
      status: z.enum(["open", "in_progress", "done", "all"]).default("all"),
    }),
    execute: async ({ days, status }) => {
      const since = sinceISO(days);
      let q = supabaseAdmin
        .from("maintenance_tickets")
        .select("ticket_no, status, priority, reporter_name, assignee_name, problem_text, reported_at, started_at, done_at")
        .gte("reported_at", since)
        .order("reported_at", { ascending: false })
        .limit(100);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      const rows = data ?? [];
      const done = rows.filter((r) => r.done_at && r.reported_at);
      const mttrH = done.length
        ? Math.round((done.reduce((s, r) => s + (Date.parse(r.done_at!) - Date.parse(r.reported_at)) / 3600000, 0) / done.length) * 10) / 10
        : null;
      return {
        total: rows.length,
        byStatus: {
          open: rows.filter((r) => r.status === "open").length,
          in_progress: rows.filter((r) => r.status === "in_progress").length,
          done: rows.filter((r) => r.status === "done").length,
        },
        mttrHours: mttrH,
        recent: rows.slice(0, 10),
      };
    },
  }),

  getSparePartsLowStock: tool({
    description: "อะไหล่ที่สต๊อกใกล้หมด (stock_qty <= min_qty)",
    inputSchema: z.object({}),
    execute: async () => {
      const { data } = await supabaseAdmin
        .from("spare_parts")
        .select("code, name, stock_qty, min_qty, unit, location_bin")
        .eq("active", true)
        .limit(500);
      const low = (data ?? []).filter((p) => (p.stock_qty ?? 0) <= (p.min_qty ?? 0));
      return { count: low.length, items: low.slice(0, 30) };
    },
  }),

  getOfficeStockLow: tool({
    description: "อุปกรณ์สำนักงาน/วัสดุสิ้นเปลืองที่ใกล้หมด (stock_qty <= min_qty)",
    inputSchema: z.object({}),
    execute: async () => {
      const { data } = await supabaseAdmin
        .from("office_assets")
        .select("code, name, stock_qty, min_qty, unit, location")
        .eq("active", true)
        .limit(500);
      const low = (data ?? []).filter((p) => (p.stock_qty ?? 0) <= (p.min_qty ?? 0));
      return { count: low.length, items: low.slice(0, 30) };
    },
  }),

  getOfficeRequests: tool({
    description: "ใบเบิกของออฟฟิศ: สรุปตามสถานะ + รายการล่าสุด",
    inputSchema: z.object({
      days: z.number().int().min(1).max(365).default(30),
      status: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
    }),
    execute: async ({ days, status }) => {
      const since = sinceISO(days);
      let q = supabaseAdmin
        .from("office_requests")
        .select("req_no, status, requester_name, approver_name, created_at, approved_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      const rows = data ?? [];
      return {
        total: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        approved: rows.filter((r) => r.status === "approved").length,
        rejected: rows.filter((r) => r.status === "rejected").length,
        recent: rows.slice(0, 10),
      };
    },
  }),

  getExpensesSummary: tool({
    description: "สรุปค่าใช้จ่าย: ยอดรวม, VAT, แยกตามสถานะ/หมวด ในเดือนที่ระบุ (YYYY-MM) ค่า default = เดือนปัจจุบัน",
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      status: z.enum(["pending", "approved", "paid", "rejected", "all"]).default("all"),
    }),
    execute: async ({ month, status }) => {
      const { start, end, ym } = monthRange(month);
      let q = supabaseAdmin
        .from("expenses")
        .select("exp_no, status, bill_type, merchant_name, subtotal, vat_amount, total_amount, receipt_date, category_id, expense_categories(name)")
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(500);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      const rows = (data ?? []) as Array<{
        exp_no: string; status: string; bill_type: string;
        subtotal: number; vat_amount: number; total_amount: number;
        expense_categories: { name: string } | null;
      }>;
      const approvedLike = rows.filter((r) => r.status === "approved" || r.status === "paid");
      const sum = (arr: typeof rows, k: "subtotal" | "vat_amount" | "total_amount") =>
        Math.round(arr.reduce((s, r) => s + Number(r[k] ?? 0), 0) * 100) / 100;
      const byCat = new Map<string, number>();
      for (const r of approvedLike) {
        const name = r.expense_categories?.name ?? "ไม่ระบุหมวด";
        byCat.set(name, (byCat.get(name) ?? 0) + Number(r.total_amount ?? 0));
      }
      return {
        month: ym,
        count: rows.length,
        byStatus: {
          pending: rows.filter((r) => r.status === "pending").length,
          approved: rows.filter((r) => r.status === "approved").length,
          paid: rows.filter((r) => r.status === "paid").length,
          rejected: rows.filter((r) => r.status === "rejected").length,
        },
        totals: {
          approvedSubtotal: sum(approvedLike, "subtotal"),
          approvedVat: sum(approvedLike, "vat_amount"),
          approvedTotal: sum(approvedLike, "total_amount"),
        },
        byCategory: [...byCat.entries()]
          .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
          .sort((a, b) => b.total - a.total),
      };
    },
  }),

  getAssetDepreciation: tool({
    description: "ค่าเสื่อมราคาเดือน (วิธีเส้นตรง) สำหรับสินทรัพย์ออฟฟิศ + book value ปัจจุบัน",
    inputSchema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
    execute: async ({ month }) => {
      const { ym } = monthRange(month);
      const { data } = await supabaseAdmin
        .from("office_assets")
        .select("id, code, name, purchase_price, salvage_value, useful_life_months, purchase_date")
        .eq("active", true)
        .limit(1000);
      const rows = (data ?? []) as DepreciableAsset[];
      const items = rows.map((a) => ({
        code: a.code, name: a.name,
        monthly: monthlyDepreciation(a),
        accumulated: accumulatedDepreciation(a),
        bookValue: bookValue(a),
      }));
      const totalMonthly = Math.round(items.reduce((s, i) => s + i.monthly, 0) * 100) / 100;
      return { month: ym, assetCount: rows.length, totalMonthlyDepreciation: totalMonthly, top: items.sort((a, b) => b.monthly - a.monthly).slice(0, 15) };
    },
  }),

  searchJob: tool({
    description: "ดูสถานะของ job เดียว: รายการ logs ล่าสุด + รายงาน QC + รายงาน packing",
    inputSchema: z.object({ jobId: z.string().min(1).max(100) }),
    execute: async ({ jobId }) => {
      const [logsRes, qcRes, packRes] = await Promise.all([
        supabaseAdmin
          .from("production_logs")
          .select("action, created_at, employees(name), steps(step_name), categories(name)")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin.from("qc_reports").select("status, overall_result, summary, created_at").eq("job_id", jobId),
        supabaseAdmin.from("packing_reports").select("status, overall_result, created_at").eq("job_id", jobId),
      ]);
      return {
        jobId,
        logs: logsRes.data ?? [],
        qc: qcRes.data ?? [],
        packing: packRes.data ?? [],
      };
    },
  }),

  getAnnouncements: tool({
    description: "ประกาศที่กำลังแสดงในแอป",
    inputSchema: z.object({}),
    execute: async () => {
      const { data } = await supabaseAdmin
        .from("announcements")
        .select("message, sort_order, created_at")
        .eq("active", true)
        .order("sort_order")
        .limit(20);
      return { items: data ?? [] };
    },
  }),
};
