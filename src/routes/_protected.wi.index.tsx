import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FilePen,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { wiDashboard } from "@/lib/features/wi.functions";
import { WI_ACCENT_BTN, WI_ACTIVITY_LABEL, formatThaiDateTime } from "@/lib/wi/wi-client";

export const Route = createFileRoute("/_protected/wi/")({
  component: WiDashboardPage,
});

type Data = Awaited<ReturnType<typeof wiDashboard>>;
type Activity = Data["activity"][number];

const TZ = "Asia/Bangkok";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "วันนี้";
  if (key === yesterday) return "เมื่อวาน";
  return new Date(`${key}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function TodoCard({
  to,
  search,
  count,
  label,
  hint,
  icon: Icon,
  tone,
}: {
  to: string;
  search?: Record<string, string>;
  count: number;
  label: string;
  hint: string;
  icon: typeof Send;
  tone: "amber" | "slate";
}) {
  const active = count > 0;
  return (
    <Link
      to={to}
      search={search as never}
      className={cn(
        "group flex min-h-24 items-center gap-4 rounded-2xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && tone === "amber"
          ? "border-amber-300 bg-amber-50 hover:bg-amber-100/70 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-border bg-card hover:border-foreground/20",
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          active && tone === "amber" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{count}</span>
          <span className="font-semibold">{label}</span>
        </div>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function WiDashboardPage() {
  const load = useServerFn(wiDashboard);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setData(await load({ data: { token: requireToken() } }));
    } catch (err) {
      showError(err);
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    }
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activityByDay = useMemo(() => {
    const groups: { key: string; items: Activity[] }[] = [];
    for (const a of data?.activity ?? []) {
      const key = dayKey(a.created_at);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(a);
      else groups.push({ key, items: [a] });
    }
    return groups;
  }, [data]);

  const nothingToDo = data && data.counts.pending === 0 && data.counts.drafts === 0;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ภาพรวม WI</h1>
          {data ? (
            <p className="text-sm text-muted-foreground">
              ใช้งานอยู่ {data.counts.total - data.counts.archived} ฉบับ · เผยแพร่ให้พนักงานดูแล้ว{" "}
              {data.counts.published} ฉบับ
              {data.counts.archived > 0 && ` · เก็บถาวร ${data.counts.archived}`}
            </p>
          ) : (
            <Skeleton className="mt-1 h-4 w-64" />
          )}
        </div>
        <Button asChild className={cn("h-11 gap-1", WI_ACCENT_BTN)}>
          <Link to="/wi/new">
            <Plus className="h-4 w-4" /> สร้าง WI
          </Link>
        </Button>
      </div>

      {error && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm">โหลดข้อมูลไม่สำเร็จ: {error}</p>
          <Button variant="outline" className="h-10 gap-1" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> ลองใหม่
          </Button>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">งานที่ต้องทำ</h2>
            {!data ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TodoCard
                    to="/wi/review"
                    count={data.counts.pending}
                    label="รอตรวจ"
                    hint={
                      data.counts.pending > 0
                        ? "ตรวจแล้วอนุมัติ หรือส่งกลับแก้ไข"
                        : "ไม่มี WI รอตรวจ"
                    }
                    icon={Send}
                    tone="amber"
                  />
                  <TodoCard
                    to="/wi/library"
                    search={{ status: "draft" }}
                    count={data.counts.drafts}
                    label="ร่างค้างอยู่"
                    hint={data.counts.drafts > 0 ? "เขียนต่อให้เสร็จ แล้วส่งตรวจ" : "ไม่มีร่างค้าง"}
                    icon={FilePen}
                    tone="slate"
                  />
                </div>
                {nothingToDo && (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> เรียบร้อย ไม่มีงานค้าง
                  </p>
                )}
                {data.pending.length > 0 && (
                  <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                    {data.pending.map((p) => (
                      <li key={p.id}>
                        <Link
                          to="/wi/review"
                          search={{ id: p.id }}
                          className="flex min-h-14 items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              <span className="font-mono text-xs text-muted-foreground">
                                {p.wi_code}
                              </span>{" "}
                              {p.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ส่งโดย {p.submitted_by_name ?? "—"} ·{" "}
                              {formatThaiDateTime(p.submitted_at)}
                            </div>
                          </div>
                          <span className="hidden text-xs font-semibold text-amber-700 sm:inline dark:text-amber-400">
                            ตรวจเลย
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold">ความเคลื่อนไหวล่าสุด</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={refresh}
                aria-label="รีเฟรช"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {!data ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : activityByDay.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                ยังไม่มีความเคลื่อนไหว — เริ่มจากสร้าง WI แรก
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activityByDay.map((g) => (
                  <div key={g.key} className="px-4 py-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      {dayLabel(g.key)}
                    </p>
                    <ul>
                      {g.items.map((a) => (
                        <li key={a.id} className="flex items-baseline gap-3 py-1.5 text-sm">
                          <span className="w-11 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {timeOf(a.created_at)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">
                              {WI_ACTIVITY_LABEL[a.action] ?? a.action}
                            </span>
                            {a.wi_id && a.wi_code && (
                              <>
                                {" · "}
                                <Link
                                  to="/wi/$wiId"
                                  params={{ wiId: a.wi_id }}
                                  className="underline-offset-2 hover:underline"
                                >
                                  {a.title}
                                </Link>
                              </>
                            )}
                            {typeof a.detail?.version === "string" && (
                              <span className="ml-1 font-mono text-xs">v{a.detail.version}</span>
                            )}
                            <span className="text-muted-foreground"> — {a.actor_name ?? "—"}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
