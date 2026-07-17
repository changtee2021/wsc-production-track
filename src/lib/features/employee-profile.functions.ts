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

async function fetchAllEmployeeLogs(employeeId: string): Promise<LogRow[]> {
  const PAGE = 1000;
  const all: LogRow[] = [];
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("production_logs")
      .select("id, job_id, employee_id, step_id, category_id, action, created_at")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LogRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

function calendarDate(anchor: string): Date {
  const [y, m, d] = anchor.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

function addCalendarDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function toBangkokBounds(start: Date, endExclusive: Date) {
  const startISO = new Date(`${dateKey(start)}T00:00:00+07:00`).toISOString();
  const endISO = new Date(
    new Date(`${dateKey(endExclusive)}T00:00:00+07:00`).getTime() - 1,
  ).toISOString();
  return { startISO, endISO };
}

function rangeBounds(range: "day" | "week" | "month", anchor: string) {
  // Treat anchor as a Thailand calendar date, then emit UTC instants for Bangkok boundaries.
  const d = calendarDate(anchor);
  let start: Date;
  let endExclusive: Date;
  if (range === "day") {
    start = d;
    endExclusive = addCalendarDays(d, 1);
  } else if (range === "week") {
    const day = d.getUTCDay(); // 0=Sun
    const diffToMon = (day + 6) % 7;
    start = addCalendarDays(d, -diffToMon);
    endExclusive = addCalendarDays(start, 7);
  } else {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    endExclusive = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  return toBangkokBounds(start, endExclusive);
}

function resolveProfileBounds(opts: {
  range: "day" | "week" | "month";
  anchor: string;
  from?: string | null;
  to?: string | null;
}): { startISO: string; endISO: string } {
  if (opts.range === "day" && opts.from && opts.to) {
    const a = opts.from <= opts.to ? opts.from : opts.to;
    const b = opts.from <= opts.to ? opts.to : opts.from;
    return toBangkokBounds(calendarDate(a), addCalendarDays(calendarDate(b), 1));
  }
  return rangeBounds(opts.range, opts.anchor);
}

function comparisonBounds(anchor: string) {
  const d = calendarDate(anchor);
  const weekStart = addCalendarDays(d, -((d.getUTCDay() + 6) % 7));
  const previousWeekStart = addCalendarDays(weekStart, -7);
  const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return {
    week: {
      current: toBangkokBounds(weekStart, addCalendarDays(weekStart, 7)),
      previous: toBangkokBounds(previousWeekStart, weekStart),
    },
    month: {
      current: toBangkokBounds(
        monthStart,
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
      ),
      previous: toBangkokBounds(previousMonthStart, monthStart),
    },
  };
}

const DEFAULT_RED_THRESHOLD = 3;

const DEPT_TABLES = [
  { dept: "production", table: "employees", extra: "nationality" },
  { dept: "qc", table: "qc_employees", extra: null },
  { dept: "packing", table: "packing_employees", extra: null },
  { dept: "maintenance", table: "maintenance_employees", extra: null },
  { dept: "office", table: "office_employees", extra: null },
  { dept: "stock", table: "stock_employees", extra: null },
  { dept: "warehouse", table: "wh_employees", extra: null },
  { dept: "transport", table: "transport_employees", extra: null },
] as const;

type DeptName = (typeof DEPT_TABLES)[number]["dept"];

export async function resolveStaff(name: string, emp_code: string | null) {
  const found: {
    departments: DeptName[];
    ids: Partial<Record<DeptName, string>>;
    names: Partial<Record<DeptName, string>>;
    avatar_url: string | null;
    nationality: string | null;
    name: string;
    emp_code: string | null;
  } = {
    departments: [],
    ids: {},
    names: {},
    avatar_url: null,
    nationality: null,
    name,
    emp_code,
  };

  await Promise.all(
    DEPT_TABLES.map(async ({ dept, table, extra }) => {
      const cols =
        dept === "warehouse"
          ? "id, name, emp_code"
          : extra
            ? `id, name, emp_code, avatar_url, ${extra}`
            : `id, name, emp_code, avatar_url`;
      const base = (
        supabaseAdmin.from(table as never) as unknown as {
          select: (s: string) => {
            eq: (
              a: string,
              b: string,
            ) => {
              is: (a: string, b: null) => Promise<{ data: Record<string, unknown>[] | null }>;
              eq: (a: string, b: string) => Promise<{ data: Record<string, unknown>[] | null }>;
            };
          };
        }
      ).select(cols);
      // Prefer emp_code-only match so slight name drift across dept tables still resolves.
      const res =
        emp_code === null
          ? await base.eq("name", name).is("emp_code", null)
          : await base.eq("emp_code", emp_code);
      const row = (res.data ?? [])[0];
      if (row) {
        found.departments.push(dept);
        found.ids[dept] = row.id as string;
        found.names[dept] = String(row.name ?? name);
        if (!found.avatar_url && row.avatar_url) found.avatar_url = row.avatar_url as string;
        if (extra && !found.nationality && row[extra]) found.nationality = row[extra] as string;
      }
    }),
  );

  // Canonical display name: production first, else first matched dept, else input.
  if (found.names.production) found.name = found.names.production;
  else if (found.departments.length > 0) {
    const first = found.departments[0];
    found.name = found.names[first] ?? name;
  }

  return found;
}

export async function loadEmployeeAggregateProfile(opts: {
  name: string;
  emp_code: string | null;
  range: "day" | "week" | "month";
  anchor: string;
  from?: string | null;
  to?: string | null;
}) {
  const staff = await resolveStaff(opts.name, opts.emp_code);
  const { startISO, endISO } = resolveProfileBounds(opts);

  // ---- Production timeline (only if person is in production) ----
  type ProdRow = {
    job_id: string;
    step_id: string;
    category_id: string | null;
    step_name: string;
    category_name: string | null;
    started_at: string;
    finished_at: string;
    actual_seconds: number;
    target_seconds: number | null;
    red_threshold: number | null;
    exceeded: boolean;
  };
  let production: {
    finished_count: number;
    total_seconds: number;
    exceeded_count: number;
    is_red: boolean;
    rows: ProdRow[];
    steps: Array<{
      step_id: string;
      step_name: string;
      jobs: number;
      total_seconds: number;
      average_seconds: number;
    }>;
    insights: {
      all_time: {
        jobs: number;
        total_seconds: number;
        steps: number;
        first_finished_at: string | null;
        last_finished_at: string | null;
      };
      week: {
        current_jobs: number;
        previous_jobs: number;
        current_seconds: number;
        previous_seconds: number;
      };
      month: {
        current_jobs: number;
        previous_jobs: number;
        current_seconds: number;
        previous_seconds: number;
      };
    };
  } = {
    finished_count: 0,
    total_seconds: 0,
    exceeded_count: 0,
    is_red: false,
    rows: [],
    steps: [],
    insights: {
      all_time: {
        jobs: 0,
        total_seconds: 0,
        steps: 0,
        first_finished_at: null,
        last_finished_at: null,
      },
      week: {
        current_jobs: 0,
        previous_jobs: 0,
        current_seconds: 0,
        previous_seconds: 0,
      },
      month: {
        current_jobs: 0,
        previous_jobs: 0,
        current_seconds: 0,
        previous_seconds: 0,
      },
    },
  };

  if (staff.ids.production) {
    const [logsRes, stdRes, stepsRes, catsRes] = await Promise.all([
      fetchAllEmployeeLogs(staff.ids.production),
      supabaseAdmin
        .from("production_standards")
        .select("step_id, category_id, target_seconds, red_threshold")
        .eq("active", true),
      supabaseAdmin.from("steps").select("id, step_name"),
      supabaseAdmin.from("categories").select("id, name"),
    ]);
    type Std = { target_seconds: number; red_threshold: number };
    const stdMap = new Map<string, Std>();
    for (const r of stdRes.data ?? [])
      stdMap.set(`${r.step_id}|${r.category_id ?? ""}`, {
        target_seconds: r.target_seconds,
        red_threshold:
          typeof r.red_threshold === "number" && r.red_threshold > 0
            ? r.red_threshold
            : DEFAULT_RED_THRESHOLD,
      });
    const lookup = (sid: string, cid: string | null) =>
      stdMap.get(`${sid}|${cid ?? ""}`) ?? stdMap.get(`${sid}|`) ?? null;
    const stepName = new Map((stepsRes.data ?? []).map((s) => [s.id, s.step_name]));
    const catName = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]));

    const allPairs = pairLogs(logsRes);
    const allRows: ProdRow[] = allPairs.map((p) => {
      const std = lookup(p.step_id, p.category_id);
      return {
        job_id: p.job_id,
        step_id: p.step_id,
        category_id: p.category_id,
        step_name: stepName.get(p.step_id) ?? "—",
        category_name: p.category_id ? (catName.get(p.category_id) ?? null) : null,
        started_at: p.started_at,
        finished_at: p.finished_at,
        actual_seconds: p.actual_seconds,
        target_seconds: std?.target_seconds ?? null,
        red_threshold: std?.red_threshold ?? null,
        exceeded: std != null && p.actual_seconds > std.target_seconds,
      };
    });
    const inBounds = (r: ProdRow, bounds: { startISO: string; endISO: string }) => {
      const t = new Date(r.finished_at).getTime();
      return t >= new Date(bounds.startISO).getTime() && t <= new Date(bounds.endISO).getTime();
    };
    const rows = allRows
      .filter((r) => inBounds(r, { startISO, endISO }))
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime());

    // per-(step,category) exceed counts vs. each row's own threshold
    const excByKey = new Map<string, { count: number; threshold: number }>();
    for (const r of rows) {
      if (!r.exceeded || r.red_threshold == null) continue;
      const k = `${r.step_id}|${r.category_id ?? ""}`;
      const cur = excByKey.get(k) ?? { count: 0, threshold: r.red_threshold };
      cur.count += 1;
      excByKey.set(k, cur);
    }
    const exc = rows.filter((r) => r.exceeded).length;
    const tot = rows.reduce((s, r) => s + r.actual_seconds, 0);
    const isRed = Array.from(excByKey.values()).some((v) => v.count >= v.threshold);
    const stepMap = new Map<
      string,
      { step_id: string; step_name: string; jobs: number; total_seconds: number }
    >();
    for (const r of rows) {
      const step = stepMap.get(r.step_id) ?? {
        step_id: r.step_id,
        step_name: r.step_name,
        jobs: 0,
        total_seconds: 0,
      };
      step.jobs += 1;
      step.total_seconds += r.actual_seconds;
      stepMap.set(r.step_id, step);
    }
    const steps = Array.from(stepMap.values())
      .map((s) => ({
        ...s,
        average_seconds: s.jobs > 0 ? Math.round(s.total_seconds / s.jobs) : 0,
      }))
      .sort((a, b) => b.jobs - a.jobs);

    const compare = comparisonBounds(opts.anchor);
    const periodSummary = (bounds: { startISO: string; endISO: string }) => {
      const periodRows = allRows.filter((r) => inBounds(r, bounds));
      return {
        jobs: periodRows.length,
        seconds: periodRows.reduce((sum, r) => sum + r.actual_seconds, 0),
      };
    };
    const currentWeek = periodSummary(compare.week.current);
    const previousWeek = periodSummary(compare.week.previous);
    const currentMonth = periodSummary(compare.month.current);
    const previousMonth = periodSummary(compare.month.previous);
    const sortedAllRows = [...allRows].sort(
      (a, b) => new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime(),
    );
    production = {
      finished_count: rows.length,
      total_seconds: tot,
      exceeded_count: exc,
      is_red: isRed,
      rows,
      steps,
      insights: {
        all_time: {
          jobs: allRows.length,
          total_seconds: allRows.reduce((sum, r) => sum + r.actual_seconds, 0),
          steps: new Set(allRows.map((r) => r.step_id)).size,
          first_finished_at: sortedAllRows[0]?.finished_at ?? null,
          last_finished_at: sortedAllRows.at(-1)?.finished_at ?? null,
        },
        week: {
          current_jobs: currentWeek.jobs,
          previous_jobs: previousWeek.jobs,
          current_seconds: currentWeek.seconds,
          previous_seconds: previousWeek.seconds,
        },
        month: {
          current_jobs: currentMonth.jobs,
          previous_jobs: previousMonth.jobs,
          current_seconds: currentMonth.seconds,
          previous_seconds: previousMonth.seconds,
        },
      },
    };
  }

  // ---- QC reports ----
  let qc: {
    count: number;
    rows: Array<{
      id: string;
      job_id: string;
      created_at: string;
      overall_result: string | null;
    }>;
  } = { count: 0, rows: [] };
  if (staff.ids.qc) {
    const { data } = await supabaseAdmin
      .from("qc_reports")
      .select("id, job_id, created_at, overall_result")
      .eq("qc_employee_id", staff.ids.qc)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(50);
    qc = { count: (data ?? []).length, rows: data ?? [] };
  }

  // ---- Packing reports ----
  let packing: typeof qc = { count: 0, rows: [] };
  if (staff.ids.packing) {
    const { data } = await supabaseAdmin
      .from("packing_reports")
      .select("id, job_id, created_at, overall_result")
      .eq("packing_employee_id", staff.ids.packing)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(50);
    packing = { count: (data ?? []).length, rows: data ?? [] };
  }

  // ---- Maintenance (assignee_name / reporter_name match) ----
  let maintenance: {
    count: number;
    rows: Array<{
      id: string;
      ticket_no: string;
      status: string;
      reported_at: string;
      problem_text: string;
    }>;
  } = { count: 0, rows: [] };
  {
    const mtRes = await supabaseAdmin
      .from("maintenance_tickets")
      .select("id, ticket_no, status, reported_at, problem_text, assignee_name, reporter_name")
      .or(`assignee_name.eq.${opts.name},reporter_name.eq.${opts.name}`)
      .gte("reported_at", startISO)
      .lte("reported_at", endISO)
      .order("reported_at", { ascending: false })
      .limit(50);
    const list = mtRes.data ?? [];
    maintenance = {
      count: list.length,
      rows: list.map((r) => ({
        id: r.id,
        ticket_no: r.ticket_no,
        status: r.status,
        reported_at: r.reported_at,
        problem_text: r.problem_text,
      })),
    };
  }

  // ---- Office requests ----
  let office: {
    count: number;
    rows: Array<{ id: string; req_no: string; status: string; created_at: string }>;
  } = { count: 0, rows: [] };
  if (staff.ids.office) {
    const { data } = await supabaseAdmin
      .from("office_requests")
      .select("id, req_no, status, created_at")
      .eq("requester_employee_id", staff.ids.office)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(50);
    office = { count: (data ?? []).length, rows: data ?? [] };
  }

  // ---- Expenses (by requester name OR linked office employee id) ----
  let expenses: {
    count: number;
    total: number;
    rows: Array<{
      id: string;
      exp_no: string;
      status: string;
      total_amount: number;
      created_at: string;
      merchant_name: string | null;
    }>;
  } = { count: 0, total: 0, rows: [] };
  {
    const q = supabaseAdmin
      .from("expenses")
      .select("id, exp_no, status, total_amount, created_at, merchant_name")
      .eq("requester_name", opts.name)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(50);
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
    range: {
      type: opts.range,
      anchor: opts.anchor,
      from: opts.from ?? null,
      to: opts.to ?? null,
      start: startISO,
      end: endISO,
    },
    production,
    qc,
    packing,
    maintenance,
    office,
    expenses,
  };
}

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const adminGetEmployeeAggregateProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        name: z.string().min(1).max(200),
        emp_code: z.string().max(50).nullable(),
        range: z.enum(["day", "week", "month"]).default("day"),
        anchor: dateYmd,
        from: dateYmd.nullable().optional(),
        to: dateYmd.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    return loadEmployeeAggregateProfile({
      name: data.name,
      emp_code: data.emp_code,
      range: data.range,
      anchor: data.anchor,
      from: data.from,
      to: data.to,
    });
  });
