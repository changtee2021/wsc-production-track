// Admin server functions for production scoring standards and dashboard.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";

function assertAdmin(token: string) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

export const adminListStandards = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("production_standards")
      .select("*, steps(step_name), categories(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const adminUpsertStandard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        category_id: z.string().uuid().nullable(),
        step_id: z.string().uuid(),
        target_seconds: z.number().int().min(1).max(86400),
        fast_seconds: z.number().int().min(1).max(86400).nullable(),
        on_time_points: z.number().int().min(0).max(1000),
        late_points: z.number().int().min(0).max(1000),
        bonus_points: z.number().int().min(0).max(1000),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { token, id, ...payload } = data;
    void token;
    if (id) {
      const { error } = await supabaseAdmin
        .from("production_standards")
        .update(payload)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("production_standards")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id };
  });

export const adminDeleteStandard = createServerFn({ method: "POST" })
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
    return { ok: true as const };
  });

export const adminScoringOverview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        range: z.enum(["today", "week", "month"]).default("week"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const days = data.range === "today" ? 1 : data.range === "week" ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    const { data: scores, error } = await supabaseAdmin
      .from("employee_scores")
      .select("employee_id, step_id, tier, points, actual_seconds, target_seconds, scored_at")
      .gte("scored_at", since);
    if (error) throw new Error(error.message);

    const [{ data: emps }, { data: steps }] = await Promise.all([
      supabaseAdmin.from("employees").select("id, name, avatar_url"),
      supabaseAdmin.from("steps").select("id, step_name"),
    ]);
    const empMap = new Map((emps ?? []).map((e) => [e.id, e]));
    const stepMap = new Map((steps ?? []).map((s) => [s.id, s.step_name]));

    type EmpAgg = { id: string; name: string; avatar_url: string | null; points: number; on_time: number; late: number; bonus: number; count: number };
    const byEmp = new Map<string, EmpAgg>();
    type StepAgg = { id: string; name: string; total: number; late: number };
    const byStep = new Map<string, StepAgg>();

    for (const s of scores ?? []) {
      const e = empMap.get(s.employee_id);
      if (e) {
        const cur = byEmp.get(e.id) ?? { id: e.id, name: e.name, avatar_url: e.avatar_url, points: 0, on_time: 0, late: 0, bonus: 0, count: 0 };
        cur.points += s.points;
        cur.count += 1;
        if (s.tier === "on_time") cur.on_time += 1;
        else if (s.tier === "late") cur.late += 1;
        else cur.bonus += 1;
        byEmp.set(e.id, cur);
      }
      const stepName = stepMap.get(s.step_id) ?? "?";
      const sc = byStep.get(s.step_id) ?? { id: s.step_id, name: stepName, total: 0, late: 0 };
      sc.total += 1;
      if (s.tier === "late") sc.late += 1;
      byStep.set(s.step_id, sc);
    }

    const leaderboard = Array.from(byEmp.values()).sort((a, b) => b.points - a.points);
    const bottlenecks = Array.from(byStep.values())
      .filter((s) => s.total >= 3)
      .map((s) => ({ ...s, late_pct: Math.round((s.late / s.total) * 100) }))
      .sort((a, b) => b.late_pct - a.late_pct)
      .slice(0, 8);

    const totalPoints = leaderboard.reduce((a, b) => a + b.points, 0);
    const totalCount = leaderboard.reduce((a, b) => a + b.count, 0);
    const onTimeCount = leaderboard.reduce((a, b) => a + b.on_time + b.bonus, 0);

    return {
      range: data.range,
      total_points: totalPoints,
      total_scored: totalCount,
      on_time_pct: totalCount ? Math.round((onTimeCount / totalCount) * 100) : 0,
      leaderboard,
      bottlenecks,
    };
  });

export const adminBackfillScores = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, days: z.number().int().min(1).max(90).default(30) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const since = new Date(Date.now() - data.days * 24 * 3600 * 1000).toISOString();
    // Re-insert finish logs to fire trigger? Use SQL function instead.
    const { data: finishes, error } = await supabaseAdmin
      .from("production_logs")
      .select("id, job_id, step_id, employee_id, category_id, created_at, action")
      .eq("action", "finish")
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: standards } = await supabaseAdmin.from("production_standards").select("*").eq("active", true);
    const stdByStep = new Map<string, Array<{ category_id: string | null; target_seconds: number; fast_seconds: number | null; on_time_points: number; late_points: number; bonus_points: number }>>();
    for (const s of standards ?? []) {
      const arr = stdByStep.get(s.step_id) ?? [];
      arr.push(s);
      stdByStep.set(s.step_id, arr);
    }

    let inserted = 0;
    for (const f of finishes ?? []) {
      if (!f.employee_id) continue;
      const { data: existing } = await supabaseAdmin
        .from("employee_scores").select("id").eq("finish_log_id", f.id).maybeSingle();
      if (existing) continue;
      const { data: starts } = await supabaseAdmin
        .from("production_logs")
        .select("id, created_at")
        .eq("job_id", f.job_id).eq("step_id", f.step_id).eq("employee_id", f.employee_id)
        .eq("action", "start").lte("created_at", f.created_at)
        .order("created_at", { ascending: false }).limit(1);
      const start = starts?.[0];
      if (!start) continue;
      const stds = stdByStep.get(f.step_id) ?? [];
      const std = stds.find((s) => s.category_id === f.category_id) ?? stds.find((s) => s.category_id === null);
      if (!std) continue;
      const actual = Math.max(1, Math.round((new Date(f.created_at).getTime() - new Date(start.created_at).getTime()) / 1000));
      let tier: "bonus" | "on_time" | "late";
      let points: number;
      if (std.fast_seconds && actual <= std.fast_seconds) { tier = "bonus"; points = std.on_time_points + std.bonus_points; }
      else if (actual <= std.target_seconds) { tier = "on_time"; points = std.on_time_points; }
      else { tier = "late"; points = std.late_points; }
      const { error: insErr } = await supabaseAdmin.from("employee_scores").insert({
        employee_id: f.employee_id, job_id: f.job_id, step_id: f.step_id, category_id: f.category_id,
        start_log_id: start.id, finish_log_id: f.id,
        actual_seconds: actual, target_seconds: std.target_seconds, points, tier,
      });
      if (!insErr) inserted += 1;
    }
    return { ok: true as const, inserted };
  });
