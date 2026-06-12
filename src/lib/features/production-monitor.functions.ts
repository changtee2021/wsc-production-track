// Production monitoring server functions:
// - Employee daily timeline & stats (pairs start/finish logs vs. standards)
// - Active production line dashboard data
// - Standards CRUD matrix WITH per-row red-alert threshold
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

// ---------- shared helpers ----------

type LogRow = {
  id: string;
  job_id: string;
  employee_id: string | null;
  step_id: string;
  category_id: string | null;
  action: "start" | "finish";
  created_at: string;
};

type StdEntry = { target_seconds: number; red_threshold: number };

const DEFAULT_RED_THRESHOLD = 3;

async function fetchStandardsMap(): Promise<Map<string, StdEntry>> {
  const { data, error } = await supabaseAdmin
    .from("production_standards")
    .select("step_id, category_id, target_seconds, red_threshold")
    .eq("active", true);
  if (error) throw new Error(error.message);
  const map = new Map<string, StdEntry>();
  for (const r of data ?? []) {
    map.set(`${r.step_id}|${r.category_id ?? ""}`, {
      target_seconds: r.target_seconds,
      red_threshold:
        typeof r.red_threshold === "number" && r.red_threshold > 0
          ? r.red_threshold
          : DEFAULT_RED_THRESHOLD,
    });
  }
  return map;
}

function lookupStd(
  map: Map<string, StdEntry>,
  stepId: string,
  categoryId: string | null,
): StdEntry | null {
  return map.get(`${stepId}|${categoryId ?? ""}`) ?? map.get(`${stepId}|`) ?? null;
}

function pairLogs(logs: LogRow[]) {
  const byKey = new Map<string, LogRow[]>();
  for (const l of logs) {
    const k = `${l.job_id}|${l.step_id}|${l.employee_id ?? ""}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(l);
  }
  const pairs: {
    job_id: string;
    employee_id: string | null;
    step_id: string;
    category_id: string | null;
    started_at: string;
    finished_at: string;
    actual_seconds: number;
  }[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let pendingStart: LogRow | null = null;
    for (const l of arr) {
      if (l.action === "start") pendingStart = l;
      else if (l.action === "finish" && pendingStart) {
        pairs.push({
          job_id: l.job_id,
          employee_id: l.employee_id,
          step_id: l.step_id,
          category_id: l.category_id ?? pendingStart.category_id,
          started_at: pendingStart.created_at,
          finished_at: l.created_at,
          actual_seconds: Math.max(
            1,
            Math.round(
              (new Date(l.created_at).getTime() - new Date(pendingStart.created_at).getTime()) /
                1000,
            ),
          ),
        });
        pendingStart = null;
      }
    }
  }
  return pairs;
}

// ---------- Employee Profile (single-day) ----------

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const adminGetEmployeeTimeline = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        employee_id: z.string().uuid(),
        date: dateStr,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const day = data.date ?? new Date().toISOString().slice(0, 10);
    const start = `${day}T00:00:00.000Z`;
    const end = `${day}T23:59:59.999Z`;

    const { data: logs, error } = await supabaseAdmin
      .from("production_logs")
      .select("id, job_id, employee_id, step_id, category_id, action, created_at")
      .eq("employee_id", data.employee_id)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const [stdMap, stepsRes, catsRes, empRes] = await Promise.all([
      fetchStandardsMap(),
      supabaseAdmin.from("steps").select("id, step_name"),
      supabaseAdmin.from("categories").select("id, name"),
      supabaseAdmin
        .from("employees")
        .select("id, name, emp_code, avatar_url, nationality, active")
        .eq("id", data.employee_id)
        .maybeSingle(),
    ]);
    const stepName = new Map((stepsRes.data ?? []).map((s) => [s.id, s.step_name]));
    const catName = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]));

    const pairs = pairLogs((logs ?? []) as LogRow[]);
    const rows = pairs
      .map((p) => {
        const std = lookupStd(stdMap, p.step_id, p.category_id);
        return {
          job_id: p.job_id,
          step_id: p.step_id,
          step_name: stepName.get(p.step_id) ?? "—",
          category_id: p.category_id,
          category_name: p.category_id ? (catName.get(p.category_id) ?? null) : null,
          started_at: p.started_at,
          finished_at: p.finished_at,
          actual_seconds: p.actual_seconds,
          target_seconds: std?.target_seconds ?? null,
          red_threshold: std?.red_threshold ?? null,
          exceeded: std != null && p.actual_seconds > std.target_seconds,
        };
      })
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime());

    // per-(step,category) exceeded counts vs. each row's own red_threshold
    const excByKey = new Map<string, { count: number; threshold: number }>();
    for (const r of rows) {
      if (!r.exceeded || r.red_threshold == null) continue;
      const k = `${r.step_id}|${r.category_id ?? ""}`;
      const cur = excByKey.get(k) ?? { count: 0, threshold: r.red_threshold };
      cur.count += 1;
      excByKey.set(k, cur);
    }
    const exceeded_count = rows.filter((r) => r.exceeded).length;
    const is_red = Array.from(excByKey.values()).some((v) => v.count >= v.threshold);
    const total_seconds = rows.reduce((s, r) => s + r.actual_seconds, 0);

    return {
      employee: empRes.data,
      rows,
      stats: {
        finished_count: rows.length,
        total_seconds,
        exceeded_count,
        is_red,
      },
    };
  });

// ---------- Live Production Dashboard ----------

export const adminGetProductionDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const lookbackStart = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const since = dayStart < lookbackStart ? lookbackStart : dayStart;

    const [logsRes, catsRes, stepsRes, empsRes, stdMap] = await Promise.all([
      supabaseAdmin
        .from("production_logs")
        .select("id, job_id, employee_id, step_id, category_id, action, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("categories").select("id, name").eq("active", true).order("name"),
      supabaseAdmin.from("steps").select("id, step_name").eq("active", true).order("step_name"),
      supabaseAdmin.from("employees").select("id, name, emp_code, avatar_url"),
      fetchStandardsMap(),
    ]);
    if (logsRes.error) throw new Error(logsRes.error.message);

    const empMap = new Map((empsRes.data ?? []).map((e) => [e.id, e]));

    const logs = (logsRes.data ?? []) as LogRow[];
    const pairs = pairLogs(logs);

    // exceeded counts per (employee, step, category) today
    const excByKey = new Map<string, number>();
    const dayStartMs = new Date(dayStart).getTime();
    for (const p of pairs) {
      if (!p.employee_id) continue;
      if (new Date(p.finished_at).getTime() < dayStartMs) continue;
      const std = lookupStd(stdMap, p.step_id, p.category_id);
      if (std && p.actual_seconds > std.target_seconds) {
        const k = `${p.employee_id}|${p.step_id}|${p.category_id ?? ""}`;
        excByKey.set(k, (excByKey.get(k) ?? 0) + 1);
      }
    }

    // Active = start without matching finish in window
    const finishedKeys = new Set(
      logs
        .filter((l) => l.action === "finish")
        .map((l) => `${l.job_id}|${l.step_id}|${l.employee_id ?? ""}`),
    );
    const active: {
      category_id: string | null;
      step_id: string;
      employee_id: string | null;
      employee_name: string;
      employee_emp_code: string | null;
      employee_avatar: string | null;
      job_id: string;
      started_at: string;
      elapsed_seconds: number;
      target_seconds: number | null;
      red_threshold: number | null;
      exceeded_today: number;
      is_red: boolean;
    }[] = [];
    const now = Date.now();
    for (const l of logs) {
      if (l.action !== "start") continue;
      const k = `${l.job_id}|${l.step_id}|${l.employee_id ?? ""}`;
      if (finishedKeys.has(k)) continue;
      const emp = l.employee_id ? empMap.get(l.employee_id) : null;
      const elapsed = Math.max(1, Math.round((now - new Date(l.created_at).getTime()) / 1000));
      const std = lookupStd(stdMap, l.step_id, l.category_id);
      const excKey = `${l.employee_id ?? ""}|${l.step_id}|${l.category_id ?? ""}`;
      const exc = excByKey.get(excKey) ?? 0;
      const threshold = std?.red_threshold ?? null;
      active.push({
        category_id: l.category_id,
        step_id: l.step_id,
        employee_id: l.employee_id,
        employee_name: emp?.name ?? "—",
        employee_emp_code: emp?.emp_code ?? null,
        employee_avatar: emp?.avatar_url ?? null,
        job_id: l.job_id,
        started_at: l.created_at,
        elapsed_seconds: elapsed,
        target_seconds: std?.target_seconds ?? null,
        red_threshold: threshold,
        exceeded_today: exc,
        is_red: threshold != null && exc >= threshold,
      });
    }

    return {
      categories: catsRes.data ?? [],
      steps: stepsRes.data ?? [],
      active,
    };
  });

// ---------- Historical Production Dashboard (range) ----------

const rangeEnum = z.enum(["day", "week", "month", "year", "custom"]);

export const adminGetProductionHistory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        range: rangeEnum,
        anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        category_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const anchor = new Date(`${data.anchor}T00:00:00.000Z`);
    let start: Date, end: Date;
    if (data.range === "day") {
      start = anchor;
      end = new Date(anchor.getTime() + 86_400_000 - 1);
    } else if (data.range === "week") {
      const day = anchor.getUTCDay();
      const diff = (day + 6) % 7; // Monday start
      start = new Date(anchor.getTime() - diff * 86_400_000);
      end = new Date(start.getTime() + 7 * 86_400_000 - 1);
    } else if (data.range === "month") {
      start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
      end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1) - 1);
    } else if (data.range === "year") {
      start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
      end = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1) - 1);
    } else {
      start = anchor;
      end = new Date(`${data.end ?? data.anchor}T23:59:59.999Z`);
    }
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const [logsRes, stdMap, stepsRes, catsRes, empsRes] = await Promise.all([
      supabaseAdmin
        .from("production_logs")
        .select("id, job_id, employee_id, step_id, category_id, action, created_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: true }),
      fetchStandardsMap(),
      supabaseAdmin.from("steps").select("id, step_name"),
      supabaseAdmin.from("categories").select("id, name").eq("active", true).order("name"),
      supabaseAdmin.from("employees").select("id, name, emp_code, avatar_url"),
    ]);
    if (logsRes.error) throw new Error(logsRes.error.message);

    const stepName = new Map((stepsRes.data ?? []).map((s) => [s.id, s.step_name]));
    const catName = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]));
    const empMap = new Map((empsRes.data ?? []).map((e) => [e.id, e]));

    const pairs = pairLogs((logsRes.data ?? []) as LogRow[]).filter(
      (p) => !data.category_id || p.category_id === data.category_id,
    );

    type TL = {
      employee_id: string | null;
      employee_name: string;
      emp_code: string | null;
      job_id: string;
      step_id: string;
      step_name: string;
      category_id: string | null;
      category_name: string | null;
      started_at: string;
      finished_at: string;
      actual_seconds: number;
      target_seconds: number | null;
      exceeded: boolean;
    };
    const timeline: TL[] = pairs
      .map((p) => {
        const std = lookupStd(stdMap, p.step_id, p.category_id);
        const emp = p.employee_id ? empMap.get(p.employee_id) : null;
        return {
          employee_id: p.employee_id,
          employee_name: emp?.name ?? "—",
          emp_code: emp?.emp_code ?? null,
          job_id: p.job_id,
          step_id: p.step_id,
          step_name: stepName.get(p.step_id) ?? "—",
          category_id: p.category_id,
          category_name: p.category_id ? (catName.get(p.category_id) ?? null) : null,
          started_at: p.started_at,
          finished_at: p.finished_at,
          actual_seconds: p.actual_seconds,
          target_seconds: std?.target_seconds ?? null,
          exceeded: std != null && p.actual_seconds > std.target_seconds,
        };
      })
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime());

    // per-employee aggregates
    const byEmp = new Map<
      string,
      {
        employee_id: string | null;
        employee_name: string;
        emp_code: string | null;
        avatar_url: string | null;
        finished_count: number;
        total_seconds: number;
        exceeded_count: number;
        exceeded_by_day: Record<string, number>;
        // (step|cat|day) → count, threshold
        excPerDay: Map<string, { count: number; threshold: number }>;
      }
    >();
    for (const t of timeline) {
      const key = `${t.employee_id ?? "__"}|${t.employee_name}`;
      const emp = t.employee_id ? empMap.get(t.employee_id) : null;
      let agg = byEmp.get(key);
      if (!agg) {
        agg = {
          employee_id: t.employee_id,
          employee_name: t.employee_name,
          emp_code: t.emp_code,
          avatar_url: emp?.avatar_url ?? null,
          finished_count: 0,
          total_seconds: 0,
          exceeded_count: 0,
          exceeded_by_day: {},
          excPerDay: new Map(),
        };
        byEmp.set(key, agg);
      }
      agg.finished_count += 1;
      agg.total_seconds += t.actual_seconds;
      if (t.exceeded) {
        agg.exceeded_count += 1;
        const day = t.finished_at.slice(0, 10);
        agg.exceeded_by_day[day] = (agg.exceeded_by_day[day] ?? 0) + 1;
        const std = lookupStd(stdMap, t.step_id, t.category_id);
        const threshold = std?.red_threshold ?? DEFAULT_RED_THRESHOLD;
        const k = `${t.step_id}|${t.category_id ?? ""}|${day}`;
        const cur = agg.excPerDay.get(k) ?? { count: 0, threshold };
        cur.count += 1;
        agg.excPerDay.set(k, cur);
      }
    }
    const by_employee = Array.from(byEmp.values())
      .map((a) => ({
        employee_id: a.employee_id,
        employee_name: a.employee_name,
        emp_code: a.emp_code,
        avatar_url: a.avatar_url,
        finished_count: a.finished_count,
        total_seconds: a.total_seconds,
        exceeded_count: a.exceeded_count,
        exceeded_by_day: a.exceeded_by_day,
        is_red: Array.from(a.excPerDay.values()).some((v) => v.count >= v.threshold),
      }))
      .sort((a, b) => b.exceeded_count - a.exceeded_count || b.finished_count - a.finished_count);

    return {
      range: { type: data.range, anchor: data.anchor, start: startISO, end: endISO },
      categories: catsRes.data ?? [],
      by_employee,
      timeline,
      totals: {
        finished_count: timeline.length,
        exceeded_count: timeline.filter((t) => t.exceeded).length,
        employees_red: by_employee.filter((e) => e.is_red).length,
        total_seconds: timeline.reduce((s, t) => s + t.actual_seconds, 0),
      },
    };
  });

// ---------- Standards (matrix) ----------

export const adminListProductionStandards = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const [stdRes, catsRes, stepsRes] = await Promise.all([
      supabaseAdmin
        .from("production_standards")
        .select("id, step_id, category_id, target_seconds, red_threshold, active"),
      supabaseAdmin.from("categories").select("id, name").eq("active", true).order("name"),
      supabaseAdmin.from("steps").select("id, step_name").eq("active", true).order("step_name"),
    ]);
    if (stdRes.error) throw new Error(stdRes.error.message);
    return {
      standards: stdRes.data ?? [],
      categories: catsRes.data ?? [],
      steps: stepsRes.data ?? [],
      default_red_threshold: DEFAULT_RED_THRESHOLD,
    };
  });

export const adminUpsertProductionStandard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        step_id: z.string().uuid(),
        category_id: z.string().uuid().nullable(),
        target_seconds: z.number().int().min(1).max(86400),
        red_threshold: z.number().int().min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    let existingId: string | null = null;
    if (data.category_id === null) {
      const { data: rows } = await supabaseAdmin
        .from("production_standards")
        .select("id, category_id")
        .eq("step_id", data.step_id);
      existingId = (rows ?? []).find((r) => r.category_id === null)?.id ?? null;
    } else {
      const { data: rows } = await supabaseAdmin
        .from("production_standards")
        .select("id")
        .eq("step_id", data.step_id)
        .eq("category_id", data.category_id);
      existingId = rows?.[0]?.id ?? null;
    }
    if (existingId) {
      const { error } = await supabaseAdmin
        .from("production_standards")
        .update({
          target_seconds: data.target_seconds,
          red_threshold: data.red_threshold,
          active: true,
        })
        .eq("id", existingId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("production_standards").insert({
        step_id: data.step_id,
        category_id: data.category_id,
        target_seconds: data.target_seconds,
        red_threshold: data.red_threshold,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteProductionStandard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin.from("production_standards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
