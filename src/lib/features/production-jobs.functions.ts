// Admin-side server functions for the Curtain Flow → production queue.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

export type ProductionJobStatus = "pending" | "in_progress" | "done" | "cancelled";

export type ProductionJobRow = {
  id: string;
  job_no: string;
  order_no: string | null;
  customer_name: string | null;
  product_type: string | null;
  width_cm: number | null;
  height_cm: number | null;
  side: "L" | "R" | null;
  fabric_code: string | null;
  rail_code: string | null;
  color_code: string | null;
  motor: string | null;
  qty: number;
  label_rev: string | null;
  due_date: string | null;
  ship_date: string | null;
  status: ProductionJobStatus;
  printed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const tokenStr = z.string().min(1);

export const adminListProductionJobs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        status: z.enum(["pending", "in_progress", "done", "cancelled", "all"]).default("pending"),
        search: z.string().trim().max(64).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    let q = supabaseAdmin
      .from("production_jobs")
      .select(
        "id, job_no, order_no, customer_name, product_type, width_cm, height_cm, side, fabric_code, rail_code, color_code, motor, qty, label_rev, due_date, ship_date, status, printed_at, started_at, finished_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search) {
      const s = data.search;
      q = q.or(`job_no.ilike.%${s}%,order_no.ilike.%${s}%,customer_name.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { jobs: (rows ?? []) as ProductionJobRow[] };
  });

export const adminGetJobByNo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, job_no: z.string().trim().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("production_jobs")
      .select("*")
      .eq("job_no", data.job_no)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("ไม่พบใบงาน");
    return { job: row as ProductionJobRow };
  });

export const adminMarkLabelPrinted = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("production_jobs")
      .update({ printed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCancelProductionJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("production_jobs")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public — weekly leaderboard for worker home screen.
export const getWeeklyLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  // Last 7 days, group by employee
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [scoresRes, empsRes] = await Promise.all([
    supabaseAdmin
      .from("employee_scores")
      .select("employee_id, points, tier, scored_at")
      .gte("scored_at", since),
    supabaseAdmin
      .from("employees")
      .select("id, name, emp_code, avatar_url, nationality")
      .eq("active", true),
  ]);
  if (scoresRes.error) throw new Error(scoresRes.error.message);
  const empMap = new Map((empsRes.data ?? []).map((e) => [e.id, e]));
  const agg = new Map<string, { points: number; bonus: number; finished: number }>();
  for (const s of scoresRes.data ?? []) {
    const a = agg.get(s.employee_id) ?? { points: 0, bonus: 0, finished: 0 };
    a.points += s.points ?? 0;
    a.finished += 1;
    if (s.tier === "bonus") a.bonus += 1;
    agg.set(s.employee_id, a);
  }
  const rows = [...agg.entries()]
    .map(([employee_id, v]) => {
      const e = empMap.get(employee_id);
      return {
        employee_id,
        name: e?.name ?? "—",
        emp_code: e?.emp_code ?? null,
        avatar_url: e?.avatar_url ?? null,
        nationality: e?.nationality ?? null,
        ...v,
      };
    })
    .filter((r) => r.name !== "—")
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
  return { rows };
});
