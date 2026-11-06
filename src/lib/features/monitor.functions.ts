// Real-time production monitor: admin manages a secret share link; anyone with the link
// can read an aggregated, read-only snapshot (no customer names, no PII beyond first names).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { loadLiveDashboard } from "@/lib/features/production-monitor.functions";
import { productionPace, type ProductionPace } from "@/lib/production-pace";

const SETTING_KEY = "monitor_share";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

function newShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function readShare(): Promise<{ token: string; enabled: boolean } | null> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const v = (data?.value ?? null) as { token?: string; enabled?: boolean } | null;
  if (!v?.token) return null;
  return { token: v.token, enabled: v.enabled !== false };
}

async function writeShare(token: string, enabled: boolean) {
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: SETTING_KEY,
    value: { token, enabled },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export const adminGetMonitorShare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    let share = await readShare();
    if (!share) {
      share = { token: newShareToken(), enabled: true };
      await writeShare(share.token, share.enabled);
    }
    return share;
  });

export const adminSetMonitorShare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string(), rotate: z.boolean(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const current = await readShare();
    const token = data.rotate || !current ? newShareToken() : current.token;
    await writeShare(token, data.enabled);
    return { token, enabled: data.enabled };
  });

export interface MonitorWorker {
  who: string;
  job: string;
  seconds: number;
  pace: ProductionPace | null;
  over: boolean;
  red: boolean;
}
export interface MonitorStep {
  id: string;
  name: string;
  active: number;
  over: number;
  red: number;
  doneToday: number;
  level: "ok" | "warn" | "alert";
  workers: MonitorWorker[];
}
export interface MonitorAlert {
  job: string;
  step: string;
  seconds: number;
  overSeconds: number;
  who: string;
  red: boolean;
}
export interface MonitorFeedItem {
  at: string;
  who: string;
  step: string;
  action: "start" | "finish";
  job: string;
  categoryId: string | null;
}
export interface MonitorView {
  totals: { active: number; doneToday: number; over: number; red: number };
  steps: MonitorStep[]; // already sorted: busiest first
  alerts: MonitorAlert[];
}
export interface MonitorSnapshot {
  generatedAt: string;
  categories: { id: string; name: string; active: number }[];
  /** keyed by category id, "__all" (everything) and "__none" (no category) */
  views: Record<string, MonitorView>;
  feed: MonitorFeedItem[];
}

function bangkokMidnightIso(now: Date): string {
  const bkk = new Date(now.getTime() + 7 * 3600_000);
  bkk.setUTCHours(0, 0, 0, 0);
  return new Date(bkk.getTime() - 7 * 3600_000).toISOString();
}

// Public snapshot. Reuses the admin dashboard's live data + red-alert thresholds so both
// views always agree; only aggregates and first names leave the server.
export const getMonitorSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ share: z.string().min(8).max(100) }).parse(d))
  .handler(async ({ data }): Promise<MonitorSnapshot> => {
    const share = await readShare();
    if (!share || !share.enabled || share.token !== data.share) {
      throw new Error("ลิงก์ไม่ถูกต้องหรือถูกปิดแล้ว");
    }

    const now = new Date();
    const midnight = bangkokMidnightIso(now);
    const [live, finRes, feedRes, empRes] = await Promise.all([
      loadLiveDashboard(),
      supabaseAdmin
        .from("production_logs")
        .select("step_id, category_id")
        .eq("action", "finish")
        .gte("created_at", midnight)
        .limit(5000),
      supabaseAdmin
        .from("production_logs")
        .select("job_id, employee_id, step_id, category_id, action, created_at")
        .gte("created_at", midnight)
        .order("created_at", { ascending: false })
        .limit(60),
      supabaseAdmin.from("employees").select("id, name"),
    ]);
    if (finRes.error) throw new Error(finRes.error.message);
    if (feedRes.error) throw new Error(feedRes.error.message);

    const first = (n: string | null | undefined) => (n ?? "-").split(" ")[0];
    const empName = new Map((empRes.data ?? []).map((e) => [e.id as string, e.name as string]));
    const stepName = new Map(live.steps.map((s) => [s.id, s.step_name]));

    const build = (match: (categoryId: string | null) => boolean): MonitorView => {
      const done = new Map<string, number>();
      let doneTotal = 0;
      for (const r of finRes.data ?? []) {
        if (!match((r.category_id as string | null) ?? null)) continue;
        done.set(r.step_id as string, (done.get(r.step_id as string) ?? 0) + 1);
        doneTotal++;
      }
      const workers = new Map<string, MonitorWorker[]>();
      const alerts: MonitorAlert[] = [];
      let active = 0;
      let over = 0;
      let red = 0;
      for (const a of live.active) {
        if (!match(a.category_id)) continue;
        active++;
        const pace = productionPace(a.elapsed_seconds, a.normal_seconds, a.target_seconds);
        const isOver = pace === "red";
        if (isOver) over++;
        if (a.is_red) red++;
        const list = workers.get(a.step_id) ?? [];
        list.push({
          who: first(a.employee_name),
          job: a.job_id,
          seconds: a.elapsed_seconds,
          pace,
          over: isOver,
          red: a.is_red,
        });
        workers.set(a.step_id, list);
        if (isOver) {
          alerts.push({
            job: a.job_id,
            step: stepName.get(a.step_id) ?? "-",
            seconds: a.elapsed_seconds,
            overSeconds: a.elapsed_seconds - (a.target_seconds ?? 0),
            who: first(a.employee_name),
            red: a.is_red,
          });
        }
      }
      alerts.sort((x, y) => Number(y.red) - Number(x.red) || y.overSeconds - x.overSeconds);

      const steps: MonitorStep[] = live.steps.map((s) => {
        const ws = (workers.get(s.id) ?? []).sort((a, b) => b.seconds - a.seconds);
        const stepRed = ws.filter((w) => w.red).length;
        const stepOver = ws.filter((w) => w.pace === "red").length;
        const stepYellow = ws.filter((w) => w.pace === "yellow").length;
        return {
          id: s.id,
          name: s.step_name,
          active: ws.length,
          over: stepOver,
          red: stepRed,
          doneToday: done.get(s.id) ?? 0,
          level: stepRed > 0 || stepOver > 0 ? "alert" : stepYellow > 0 ? "warn" : "ok",
          workers: ws,
        };
      });
      // Busiest first; idle steps fall to the bottom ordered by output today.
      steps.sort(
        (a, b) =>
          b.active - a.active ||
          b.red - a.red ||
          b.doneToday - a.doneToday ||
          a.name.localeCompare(b.name, "th"),
      );

      return {
        totals: { active, doneToday: doneTotal, over, red },
        steps,
        alerts: alerts.slice(0, 8),
      };
    };

    const views: Record<string, MonitorView> = {
      __all: build(() => true),
      __none: build((c) => c === null),
    };
    for (const c of live.categories) views[c.id] = build((cid) => cid === c.id);

    return {
      generatedAt: now.toISOString(),
      categories: live.categories.map((c) => ({
        id: c.id,
        name: c.name,
        active: views[c.id].totals.active,
      })),
      views,
      feed: (feedRes.data ?? []).map((l) => ({
        at: l.created_at as string,
        who: first(empName.get(l.employee_id as string)),
        step: stepName.get(l.step_id as string) ?? "-",
        action: l.action as "start" | "finish",
        job: l.job_id as string,
        categoryId: (l.category_id as string | null) ?? null,
      })),
    };
  });

// Lightweight signal for the sidebar dot: how many jobs are being worked on right now
// (start without a matching finish within the last 12h). One narrow query, no joins.
export const adminMonitorLiveStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const since = new Date(Date.now() - 12 * 3600_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("production_logs")
      .select("job_id, step_id, employee_id, action")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    const open = new Set<string>();
    for (const r of rows ?? []) {
      const k = `${r.job_id}|${r.step_id}|${r.employee_id ?? ""}`;
      if (r.action === "start") open.add(k);
      else if (r.action === "finish") open.delete(k);
    }
    return { working: open.size };
  });
