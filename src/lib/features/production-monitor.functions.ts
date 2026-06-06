// Production monitoring server functions:
// - Employee daily timeline & stats (pairs start/finish logs vs. standards)
// - Active production line dashboard data
// - Standards CRUD matrix + red-alert threshold (app_settings)
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

async function fetchStandardsMap() {
  const { data, error } = await supabaseAdmin
    .from("production_standards")
    .select("step_id, category_id, target_seconds")
    .eq("active", true);
  if (error) throw new Error(error.message);
  const map = new Map<string, number>(); // key: `${step}|${category ?? ""}`
  for (const r of data ?? []) {
    map.set(`${r.step_id}|${r.category_id ?? ""}`, r.target_seconds);
  }
  return map;
}

function targetFor(
  map: Map<string, number>,
  stepId: string,
  categoryId: string | null,
): number | null {
  return (
    map.get(`${stepId}|${categoryId ?? ""}`) ??
    map.get(`${stepId}|`) ??
    null
  );
}

function pairLogs(logs: LogRow[]) {
  // pair start+finish for same job+step+employee, ordered by time
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
    arr.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
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
              (new Date(l.created_at).getTime() -
                new Date(pendingStart.created_at).getTime()) /
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

async function getRedThresholdValue(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "production_red_threshold")
    .maybeSingle();
  const v = (data?.value as { count?: number } | null)?.count;
  return typeof v === "number" && v > 0 ? v : 3;
}

// ---------- Employee Profile ----------

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

    const [stdMap, stepsRes, catsRes, empRes, threshold] = await Promise.all([
      fetchStandardsMap(),
      supabaseAdmin.from("steps").select("id, step_name"),
      supabaseAdmin.from("categories").select("id, name"),
      supabaseAdmin
        .from("employees")
        .select("id, name, emp_code, avatar_url, nationality, active")
        .eq("id", data.employee_id)
        .maybeSingle(),
      getRedThresholdValue(),
    ]);
    const stepName = new Map(
      (stepsRes.data ?? []).map((s) => [s.id, s.step_name]),
    );
    const catName = new Map(
      (catsRes.data ?? []).map((c) => [c.id, c.name]),
    );

    const pairs = pairLogs((logs ?? []) as LogRow[]);
    const rows = pairs
      .map((p) => {
        const target = targetFor(stdMap, p.step_id, p.category_id);
        return {
          job_id: p.job_id,
          step_id: p.step_id,
          step_name: stepName.get(p.step_id) ?? "—",
          category_id: p.category_id,
          category_name: p.category_id ? catName.get(p.category_id) ?? null : null,
          started_at: p.started_at,
          finished_at: p.finished_at,
          actual_seconds: p.actual_seconds,
          target_seconds: target,
          exceeded: target != null && p.actual_seconds > target,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.finished_at).getTime() -
          new Date(a.finished_at).getTime(),
      );

    const exceeded_count = rows.filter((r) => r.exceeded).length;
    const total_seconds = rows.reduce((s, r) => s + r.actual_seconds, 0);

    return {
      employee: empRes.data,
      rows,
      stats: {
        finished_count: rows.length,
        total_seconds,
        exceeded_count,
        is_red: exceeded_count >= threshold,
        threshold,
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

    const [logsRes, catsRes, stepsRes, empsRes, stdMap, threshold] =
      await Promise.all([
        supabaseAdmin
          .from("production_logs")
          .select("id, job_id, employee_id, step_id, category_id, action, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabaseAdmin.from("categories").select("id, name").eq("active", true).order("name"),
        supabaseAdmin.from("steps").select("id, step_name").eq("active", true).order("step_name"),
        supabaseAdmin.from("employees").select("id, name, emp_code, avatar_url"),
        fetchStandardsMap(),
        getRedThresholdValue(),
      ]);
    if (logsRes.error) throw new Error(logsRes.error.message);

    const empMap = new Map(
      (empsRes.data ?? []).map((e) => [e.id, e]),
    );

    const logs = (logsRes.data ?? []) as LogRow[];
    const pairs = pairLogs(logs);

    // exceeded counts per employee today
    const exceededByEmp = new Map<string, number>();
    const dayStartMs = new Date(dayStart).getTime();
    for (const p of pairs) {
      if (!p.employee_id) continue;
      if (new Date(p.finished_at).getTime() < dayStartMs) continue;
      const target = targetFor(stdMap, p.step_id, p.category_id);
      if (target != null && p.actual_seconds > target) {
        exceededByEmp.set(
          p.employee_id,
          (exceededByEmp.get(p.employee_id) ?? 0) + 1,
        );
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
      employee_avatar: string | null;
      job_id: string;
      started_at: string;
      elapsed_seconds: number;
      target_seconds: number | null;
      exceeded_today: number;
      is_red: boolean;
    }[] = [];
    const now = Date.now();
    for (const l of logs) {
      if (l.action !== "start") continue;
      const k = `${l.job_id}|${l.step_id}|${l.employee_id ?? ""}`;
      if (finishedKeys.has(k)) continue;
      const emp = l.employee_id ? empMap.get(l.employee_id) : null;
      const elapsed = Math.max(
        1,
        Math.round((now - new Date(l.created_at).getTime()) / 1000),
      );
      const exc = l.employee_id ? exceededByEmp.get(l.employee_id) ?? 0 : 0;
      active.push({
        category_id: l.category_id,
        step_id: l.step_id,
        employee_id: l.employee_id,
        employee_name: emp?.name ?? "—",
        employee_avatar: emp?.avatar_url ?? null,
        job_id: l.job_id,
        started_at: l.created_at,
        elapsed_seconds: elapsed,
        target_seconds: targetFor(stdMap, l.step_id, l.category_id),
        exceeded_today: exc,
        is_red: exc >= threshold,
      });
    }

    return {
      categories: catsRes.data ?? [],
      steps: stepsRes.data ?? [],
      active,
      threshold,
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
        .select("id, step_id, category_id, target_seconds, active"),
      supabaseAdmin.from("categories").select("id, name").eq("active", true).order("name"),
      supabaseAdmin.from("steps").select("id, step_name").eq("active", true).order("step_name"),
    ]);
    if (stdRes.error) throw new Error(stdRes.error.message);
    return {
      standards: stdRes.data ?? [],
      categories: catsRes.data ?? [],
      steps: stepsRes.data ?? [],
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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    // unique key: (step_id, COALESCE(category_id, '00000000-...'))
    const existing = await supabaseAdmin
      .from("production_standards")
      .select("id")
      .eq("step_id", data.step_id)
      .is("category_id", data.category_id === null ? null : (undefined as never));
    // Fallback: do manual match because supabase JS .is() with non-null is awkward
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
    void existing;
    if (existingId) {
      const { error } = await supabaseAdmin
        .from("production_standards")
        .update({ target_seconds: data.target_seconds, active: true })
        .eq("id", existingId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("production_standards")
        .insert({
          step_id: data.step_id,
          category_id: data.category_id,
          target_seconds: data.target_seconds,
        });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteProductionStandard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("production_standards")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Red Threshold ----------

export const adminGetRedThreshold = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    return { count: await getRedThresholdValue() };
  });

export const adminSetRedThreshold = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, count: z.number().int().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        {
          key: "production_red_threshold",
          value: { count: data.count },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
