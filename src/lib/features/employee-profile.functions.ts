// Aggregated employee profile across all 5 departments.
// Resolves a staff identity by (name, emp_code) then loads activity
// from production_logs / qc_reports / packing_reports / maintenance_tickets
// / office_requests / expenses within a chosen date range.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

type LogRow = {
  id: string;
  job_id: string;
  employee_id: string | null;
  step_id: string;
  category_id: string | null;
  action: "start" | "finish";
  created_at: string;
};

function pairLogs(logs: LogRow[]) {
  const byKey = new Map<string, LogRow[]>();
  for (const l of logs) {
    const k = `${l.job_id}|${l.step_id}|${l.employee_id ?? ""}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(l);
  }
  const pairs: {
    job_id: string;
    step_id: string;
    category_id: string | null;
    started_at: string;
    finished_at: string;
    actual_seconds: number;
  }[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let pending: LogRow | null = null;
    for (const l of arr) {
      if (l.action === "start") pending = l;
      else if (l.action === "finish" && pending) {
        pairs.push({
          job_id: l.job_id,
          step_id: l.step_id,
          category_id: l.category_id ?? pending.category_id,
          started_at: pending.created_at,
          finished_at: l.created_at,
          actual_seconds: Math.max(
            1,
            Math.round(
              (new Date(l.created_at).getTime() - new Date(pending.created_at).getTime()) / 1000,
            ),
          ),
        });
        pending = null;
      }
    }
  }
  return pairs;
}

function rangeBounds(range: "day" | "week" | "month", anchor: string) {
  // anchor is YYYY-MM-DD in local TH timezone semantics — we treat it as UTC day boundary
  const d = new Date(`${anchor}T00:00:00.000Z`);
  let start: Date, end: Date;
  if (range === "day") {
    start = d;
    end = new Date(d.getTime() + 24 * 3600 * 1000 - 1);
  } else if (range === "week") {
    // ISO week starting Monday relative to anchor
    const day = d.getUTCDay(); // 0=Sun
    const diffToMon = (day + 6) % 7;
    start = new Date(d.getTime() - diffToMon * 24 * 3600 * 1000);
    end = new Date(start.getTime() + 7 * 24 * 3600 * 1000 - 1);
  } else {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1);
  }
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

async function getRedThreshold(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings").select("value").eq("key", "production_red_threshold").maybeSingle();
  const v = (data?.value as { count?: number } | null)?.count;
  return typeof v === "number" && v > 0 ? v : 3;
}

const DEPT_TABLES = [
  { dept: "production", table: "employees", extra: "nationality" },
  { dept: "qc", table: "qc_employees", extra: null },
  { dept: "packing", table: "packing_employees", extra: null },
  { dept: "maintenance", table: "maintenance_employees", extra: null },
  { dept: "office", table: "office_employees", extra: null },
] as const;

type DeptName = (typeof DEPT_TABLES)[number]["dept"];

async function resolveStaff(name: string, emp_code: string | null) {
  const found: {
    departments: DeptName[];
    ids: Partial<Record<DeptName, string>>;
    avatar_url: string | null;
    nationality: string | null;
    name: string;
    emp_code: string | null;
  } = { departments: [], ids: {}, avatar_url: null, nationality: null, name, emp_code };

  await Promise.all(
    DEPT_TABLES.map(async ({ dept, table, extra }) => {
      const cols = extra ? `id, name, emp_code, avatar_url, ${extra}` : `id, name, emp_code, avatar_url`;
      const q = (supabaseAdmin.from(table as never) as unknown as {
        select: (s: string) => {
          eq: (a: string, b: string) => {
            is: (a: string, b: null) => Promise<{ data: Record<string, unknown>[] | null }>;
            eq: (a: string, b: string) => Promise<{ data: Record<string, unknown>[] | null }>;
          };
        };
      }).select(cols).eq("name", name);
      const res = emp_code === null ? await q.is("emp_code", null) : await q.eq("emp_code", emp_code);
      const row = (res.data ?? [])[0];
      if (row) {
        found.departments.push(dept);
        found.ids[dept] = row.id as string;
        if (!found.avatar_url && row.avatar_url) found.avatar_url = row.avatar_url as string;
        if (extra && !found.nationality && row[extra]) found.nationality = row[extra] as string;
      }
    }),
  );

  return found;
}

export const adminGetEmployeeAggregateProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: tokenStr,
      name: z.string().min(1).max(200),
      emp_code: z.string().max(50).nullable(),
      range: z.enum(["day", "week", "month"]).default("day"),
      anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);

    const staff = await resolveStaff(data.name, data.emp_code);
    const { startISO, endISO } = rangeBounds(data.range, data.anchor);

    // ---- Production timeline (only if person is in production) ----
    let production: {
      finished_count: number;
      total_seconds: number;
      exceeded_count: number;
      threshold: number;
      is_red: boolean;
      rows: Array<{
        job_id: string;
        step_name: string;
        category_name: string | null;
        started_at: string;
        finished_at: string;
        actual_seconds: number;
        target_seconds: number | null;
        exceeded: boolean;
      }>;
    } = { finished_count: 0, total_seconds: 0, exceeded_count: 0, threshold: 3, is_red: false, rows: [] };

    const threshold = await getRedThreshold();
    production.threshold = threshold;

    if (staff.ids.production) {
      const [logsRes, stdRes, stepsRes, catsRes] = await Promise.all([
        supabaseAdmin
          .from("production_logs")
          .select("id, job_id, employee_id, step_id, category_id, action, created_at")
          .eq("employee_id", staff.ids.production)
          .gte("created_at", startISO).lte("created_at", endISO)
          .order("created_at", { ascending: true }),
        supabaseAdmin.from("production_standards")
          .select("step_id, category_id, target_seconds").eq("active", true),
        supabaseAdmin.from("steps").select("id, step_name"),
        supabaseAdmin.from("categories").select("id, name"),
      ]);
      const stdMap = new Map<string, number>();
      for (const r of stdRes.data ?? [])
        stdMap.set(`${r.step_id}|${r.category_id ?? ""}`, r.target_seconds);
      const stepName = new Map((stepsRes.data ?? []).map((s) => [s.id, s.step_name]));
      const catName = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]));

      const pairs = pairLogs((logsRes.data ?? []) as LogRow[]);
      const rows = pairs.map((p) => {
        const target =
          stdMap.get(`${p.step_id}|${p.category_id ?? ""}`) ??
          stdMap.get(`${p.step_id}|`) ?? null;
        return {
          job_id: p.job_id,
          step_name: stepName.get(p.step_id) ?? "—",
          category_name: p.category_id ? catName.get(p.category_id) ?? null : null,
          started_at: p.started_at,
          finished_at: p.finished_at,
          actual_seconds: p.actual_seconds,
          target_seconds: target,
          exceeded: target != null && p.actual_seconds > target,
        };
      }).sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime());

      const exc = rows.filter((r) => r.exceeded).length;
      const tot = rows.reduce((s, r) => s + r.actual_seconds, 0);
      production = {
        finished_count: rows.length,
        total_seconds: tot,
        exceeded_count: exc,
        threshold,
        is_red: exc >= threshold,
        rows,
      };
    }

    // ---- QC reports ----
    let qc: { count: number; rows: Array<{ id: string; job_id: string; created_at: string; overall_result: string | null }> } =
      { count: 0, rows: [] };
    if (staff.ids.qc) {
      const { data } = await supabaseAdmin.from("qc_reports")
        .select("id, job_id, created_at, overall_result")
        .eq("qc_employee_id", staff.ids.qc)
        .gte("created_at", startISO).lte("created_at", endISO)
        .order("created_at", { ascending: false }).limit(50);
      qc = { count: (data ?? []).length, rows: data ?? [] };
    }

    // ---- Packing reports ----
    let packing: typeof qc = { count: 0, rows: [] };
    if (staff.ids.packing) {
      const { data } = await supabaseAdmin.from("packing_reports")
        .select("id, job_id, created_at, overall_result")
        .eq("packing_employee_id", staff.ids.packing)
        .gte("created_at", startISO).lte("created_at", endISO)
        .order("created_at", { ascending: false }).limit(50);
      packing = { count: (data ?? []).length, rows: data ?? [] };
    }

    // ---- Maintenance (assignee_name / reporter_name match) ----
    let maintenance: { count: number; rows: Array<{ id: string; ticket_no: string; status: string; reported_at: string; problem_text: string }> } =
      { count: 0, rows: [] };
    {
      const mtRes = await supabaseAdmin.from("maintenance_tickets")
        .select("id, ticket_no, status, reported_at, problem_text, assignee_name, reporter_name")
        .or(`assignee_name.eq.${data.name},reporter_name.eq.${data.name}`)
        .gte("reported_at", startISO).lte("reported_at", endISO)
        .order("reported_at", { ascending: false }).limit(50);
      const list = mtRes.data ?? [];
      maintenance = {
        count: list.length,
        rows: list.map((r) => ({
          id: r.id, ticket_no: r.ticket_no, status: r.status, reported_at: r.reported_at, problem_text: r.problem_text,
        })),
      };
    }

    // ---- Office requests ----
    let office: { count: number; rows: Array<{ id: string; req_no: string; status: string; created_at: string }> } =
      { count: 0, rows: [] };
    if (staff.ids.office) {
      const { data } = await supabaseAdmin.from("office_requests")
        .select("id, req_no, status, created_at")
        .eq("requester_employee_id", staff.ids.office)
        .gte("created_at", startISO).lte("created_at", endISO)
        .order("created_at", { ascending: false }).limit(50);
      office = { count: (data ?? []).length, rows: data ?? [] };
    }

    // ---- Expenses (by requester name OR linked office employee id) ----
    let expenses: { count: number; total: number; rows: Array<{ id: string; exp_no: string; status: string; total_amount: number; created_at: string; merchant_name: string | null }> } =
      { count: 0, total: 0, rows: [] };
    {
      const q = supabaseAdmin.from("expenses")
        .select("id, exp_no, status, total_amount, created_at, merchant_name")
        .eq("requester_name", data.name)
        .gte("created_at", startISO).lte("created_at", endISO)
        .order("created_at", { ascending: false }).limit(50);
      const { data: rows } = await q;
      const list = rows ?? [];
      expenses = {
        count: list.length,
        total: list.reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
        rows: list,
      };
    }

    return {
      employee: {
        name: staff.name,
        emp_code: staff.emp_code,
        avatar_url: staff.avatar_url,
        nationality: staff.nationality,
        departments: staff.departments,
      },
      range: { type: data.range, anchor: data.anchor, start: startISO, end: endISO },
      production,
      qc,
      packing,
      maintenance,
      office,
      expenses,
    };
  });
