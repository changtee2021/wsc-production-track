// Public scoring queries — used by Leaderboard and worker score view.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function sinceFor(range: "today" | "week" | "month"): string {
  if (range === "today") {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = range === "week" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ range: z.enum(["today", "week", "month"]).default("week") }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const since = sinceFor(data.range);
    const { data: scores, error } = await supabaseAdmin
      .from("employee_scores")
      .select("employee_id, points, tier")
      .gte("scored_at", since);
    if (error) throw new Error(error.message);

    const agg = new Map<string, { points: number; jobs: number; on_time: number; late: number; bonus: number }>();
    for (const s of scores ?? []) {
      const cur = agg.get(s.employee_id) ?? { points: 0, jobs: 0, on_time: 0, late: 0, bonus: 0 };
      cur.points += s.points;
      cur.jobs += 1;
      if (s.tier === "on_time") cur.on_time += 1;
      else if (s.tier === "late") cur.late += 1;
      else cur.bonus += 1;
      agg.set(s.employee_id, cur);
    }
    if (agg.size === 0) return { range: data.range, rows: [] };

    const ids = Array.from(agg.keys());
    const { data: emps } = await supabaseAdmin
      .from("employees").select("id, name, avatar_url, emp_code").in("id", ids);
    const { data: badges } = await supabaseAdmin
      .from("employee_badges").select("employee_id, badge_code").in("employee_id", ids);
    const badgeCount = new Map<string, number>();
    for (const b of badges ?? []) badgeCount.set(b.employee_id, (badgeCount.get(b.employee_id) ?? 0) + 1);

    const rows = (emps ?? []).map((e) => {
      const a = agg.get(e.id)!;
      const total = a.on_time + a.late + a.bonus;
      return {
        id: e.id, name: e.name, avatar_url: e.avatar_url, emp_code: e.emp_code,
        points: a.points, jobs: a.jobs,
        on_time_pct: total ? Math.round(((a.on_time + a.bonus) / total) * 100) : 0,
        badges: badgeCount.get(e.id) ?? 0,
      };
    }).sort((a, b) => b.points - a.points);
    return { range: data.range, rows };
  });

export const getEmployeeScoreSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ emp_code: z.string().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: emp } = await supabaseAdmin
      .from("employees").select("id, name, avatar_url, emp_code").eq("emp_code", data.emp_code).maybeSingle();
    if (!emp) return { ok: false as const, error: "ไม่พบรหัสพนักงาน" };

    const today = sinceFor("today");
    const weekAgo = sinceFor("week");
    const yStart = new Date(); yStart.setHours(0, 0, 0, 0); yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(); yEnd.setHours(0, 0, 0, 0);

    const [{ data: todayRows }, { data: weekRows }, { data: yest }, { data: badges }, { data: recent }] = await Promise.all([
      supabaseAdmin.from("employee_scores").select("points, tier").eq("employee_id", emp.id).gte("scored_at", today),
      supabaseAdmin.from("employee_scores").select("points").eq("employee_id", emp.id).gte("scored_at", weekAgo),
      supabaseAdmin.from("employee_scores").select("points").eq("employee_id", emp.id)
        .gte("scored_at", yStart.toISOString()).lt("scored_at", yEnd.toISOString()),
      supabaseAdmin.from("employee_badges").select("badge_code, awarded_at, meta").eq("employee_id", emp.id)
        .order("awarded_at", { ascending: false }).limit(10),
      supabaseAdmin.from("employee_scores")
        .select("points, tier, actual_seconds, target_seconds, scored_at, step_id, steps(step_name)")
        .eq("employee_id", emp.id).order("scored_at", { ascending: false }).limit(10),
    ]);

    const tPoints = (todayRows ?? []).reduce((a, b) => a + b.points, 0);
    const yPoints = (yest ?? []).reduce((a, b) => a + b.points, 0);
    const wPoints = (weekRows ?? []).reduce((a, b) => a + b.points, 0);
    const tCount = (todayRows ?? []).length;
    const tOnTime = (todayRows ?? []).filter((r) => r.tier !== "late").length;

    return {
      ok: true as const,
      employee: emp,
      today_points: tPoints,
      yesterday_points: yPoints,
      week_points: wPoints,
      today_jobs: tCount,
      today_on_time_pct: tCount ? Math.round((tOnTime / tCount) * 100) : 0,
      badges: badges ?? [],
      recent: recent ?? [],
    };
  });
