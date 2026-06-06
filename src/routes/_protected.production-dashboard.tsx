// Live production-line dashboard: tabs per product category,
// columns per production step, cards per active worker with red-alert ring.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetProductionDashboard } from "@/lib/features/production-monitor.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { initialsOf } from "@/lib/utils/i18n";
import { Factory, Flame, RefreshCw } from "lucide-react";
import { AppVersion } from "@/components/AppVersion";

export const Route = createFileRoute("/_protected/production-dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ดไลน์ผลิต — WSC ProductionTrack" }] }),
  component: DashboardPage,
});

type Active = {
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
};

function fmtDuration(sec: number) {
  if (sec < 60) return `${sec} วิ`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} น.` : `${m} นาที`;
}

function DashboardPage() {
  const fn = useServerFn(adminGetProductionDashboard);
  const [data, setData] = useState<{
    categories: { id: string; name: string }[];
    steps: { id: string; step_name: string }[];
    active: Active[];
    threshold: number;
  }>({ categories: [], steps: [], active: [], threshold: 3 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("");

  const load = async () => {
    try {
      const r = await fn({ data: { token: requireToken() } });
      setData(r);
      if (!tab && r.categories.length) setTab(r.categories[0].id);
    } catch (err) { showError(err); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepsToShow = useMemo(() => {
    const used = new Set(data.active.map((a) => a.step_id));
    const list = data.steps.filter((s) => used.has(s.id));
    return list.length ? list : data.steps;
  }, [data.steps, data.active]);

  const tabsList = useMemo(() => {
    return [{ id: "__all", name: "ทั้งหมด" }, ...data.categories, { id: "__none", name: "ไม่ระบุหมวด" }];
  }, [data.categories]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Factory className="h-6 w-6 text-primary" /> แดชบอร์ดไลน์การผลิต
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ติดตามช่างที่กำลังทำงานอยู่ • ไฟแดงเมื่อเกินมาตรฐาน ≥ {data.threshold} ครั้ง/วัน
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1">
          <RefreshCw className="h-4 w-4" /> รีเฟรช
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
      ) : data.categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          ยังไม่มีหมวดหมู่สินค้า
        </div>
      ) : (
        <Tabs value={tab || tabsList[0].id} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            {tabsList.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
            ))}
          </TabsList>

          {tabsList.map((c) => {
            const filtered = data.active.filter((a) =>
              c.id === "__all" ? true : c.id === "__none" ? a.category_id === null : a.category_id === c.id,
            );
            return (
              <TabsContent key={c.id} value={c.id} className="mt-4">
                {stepsToShow.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">ยังไม่มีขั้นตอน</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {stepsToShow.map((step) => {
                      const cards = filtered.filter((a) => a.step_id === step.id);
                      return (
                        <div key={step.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">{step.step_name}</h3>
                            <Badge variant="secondary">{cards.length} คน</Badge>
                          </div>
                          {cards.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">— ว่าง —</div>
                          ) : (
                            <ul className="space-y-2">
                              {cards.map((a, i) => (
                                <WorkerCard key={`${a.employee_id}-${a.job_id}-${i}`} a={a} />
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <div className="mt-8 flex justify-center"><AppVersion /></div>
    </main>
  );
}

function WorkerCard({ a }: { a: Active }) {
  const pct = a.target_seconds ? Math.min(200, Math.round((a.elapsed_seconds / a.target_seconds) * 100)) : 0;
  const over = a.target_seconds != null && a.elapsed_seconds > a.target_seconds;
  return (
    <li
      className={`rounded-xl border p-3 transition ${
        a.is_red
          ? "animate-pulse border-rose-400 bg-rose-50 ring-2 ring-rose-300 dark:bg-rose-950/30"
          : over
          ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20"
          : "border-border bg-background"
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 border border-border">
          {a.employee_avatar && <AvatarImage src={a.employee_avatar} />}
          <AvatarFallback className="bg-muted text-xs">{initialsOf(a.employee_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 truncate font-semibold">
            {a.employee_name}
            {a.is_red && <Flame className="h-3.5 w-3.5 text-rose-600" />}
          </div>
          <div className="truncate text-xs text-muted-foreground">Job: <span className="font-mono">{a.job_id}</span></div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold ${over ? "text-rose-600" : "text-emerald-600"}`}>{fmtDuration(a.elapsed_seconds)}</div>
          <div className="text-[10px] text-muted-foreground">{a.target_seconds ? `มาตรฐาน ${fmtDuration(a.target_seconds)}` : "ไม่มีมาตรฐาน"}</div>
        </div>
      </div>
      {a.target_seconds && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${over ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      {a.exceeded_today > 0 && (
        <div className="mt-1 text-[10px] text-rose-600">เกินมาตรฐานวันนี้แล้ว {a.exceeded_today} ครั้ง</div>
      )}
    </li>
  );
}
