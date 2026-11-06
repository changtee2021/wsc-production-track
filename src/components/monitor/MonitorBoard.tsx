// Clean, read-only real-time board. Polls the snapshot every 10s (cheap, aggregated payload).
// Steps with people working right now are listed first (busiest on top); idle steps are
// collapsed into a compact list underneath. A category bar narrows everything to one product line.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Maximize2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMonitorSnapshot,
  type MonitorSnapshot,
  type MonitorStep,
} from "@/lib/features/monitor.functions";

const POLL_MS = 10_000;
const MAX_WORKERS_SHOWN = 4;

const LEVEL_STYLE: Record<MonitorStep["level"], { dot: string; ring: string; label: string }> = {
  ok: {
    dot: "bg-emerald-500",
    ring: "border-emerald-200 dark:border-emerald-900",
    label: "ก่อนเวลา",
  },
  warn: { dot: "bg-amber-500", ring: "border-amber-300 dark:border-amber-800", label: "เวลาปกติ" },
  alert: { dot: "bg-red-500", ring: "border-red-300 dark:border-red-800", label: "เกินเวลา" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function fmtDur(sec: number) {
  const mins = Math.max(1, Math.round(sec / 60));
  return mins >= 60 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} น.` : `${mins} น.`;
}

const RING_TONE = {
  sky: {
    stroke: "stroke-sky-500",
    text: "text-sky-600 dark:text-sky-400",
    track: "stroke-sky-100 dark:stroke-sky-950",
  },
  emerald: {
    stroke: "stroke-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    track: "stroke-emerald-100 dark:stroke-emerald-950",
  },
  amber: {
    stroke: "stroke-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    track: "stroke-amber-100 dark:stroke-amber-950",
  },
  red: {
    stroke: "stroke-red-500",
    text: "text-red-600 dark:text-red-400",
    track: "stroke-red-100 dark:stroke-red-950",
  },
  slate: { stroke: "stroke-slate-400", text: "text-foreground", track: "stroke-muted" },
} as const;

function Ring({ percent, tone }: { percent: number; tone: keyof typeof RING_TONE }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const t = RING_TONE[tone];
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className={t.track} />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          className={`${t.stroke} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums ${t.text}`}
      >
        {Math.round(p)}%
      </span>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  percent,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  percent: number;
  tone: keyof typeof RING_TONE;
}) {
  const t = RING_TONE[tone];
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-4xl font-semibold tabular-nums sm:text-5xl ${t.text}`}>{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <Ring percent={percent} tone={tone} />
    </div>
  );
}

function ActiveStepCard({ s }: { s: MonitorStep }) {
  const st = LEVEL_STYLE[s.level];
  const shown = s.workers.slice(0, MAX_WORKERS_SHOWN);
  const rest = s.workers.length - shown.length;
  return (
    <div className={`flex flex-col rounded-2xl border-2 bg-card p-4 ${st.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">{s.name}</p>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} title={st.label} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums">{s.active}</span>
        <span className="text-xs text-muted-foreground">กำลังทำ</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> {s.doneToday}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {shown.map((w, i) => (
          <li key={`${w.job}-${i}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium">{w.who}</span>
              <span className="text-muted-foreground"> · {w.job}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                w.pace === "red"
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : w.pace === "yellow"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : w.pace === "green"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {fmtDur(w.seconds)}
            </span>
          </li>
        ))}
        {rest > 0 && <li className="text-xs text-muted-foreground">และอีก {rest} คน</li>}
      </ul>
    </div>
  );
}

export function MonitorBoard({ share }: { share: string }) {
  const fetchSnapshot = useServerFn(getMonitorSnapshot);
  const [snap, setSnap] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [cat, setCat] = useState("__all");

  const load = useCallback(async () => {
    try {
      const s = await fetchSnapshot({ data: { share } });
      setSnap(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [fetchSnapshot, share]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  const stale = snap ? now.getTime() - new Date(snap.generatedAt).getTime() > POLL_MS * 3 : false;

  const tabs = useMemo(() => {
    if (!snap) return [];
    const none = snap.views.__none;
    return [
      { id: "__all", name: "ทั้งหมด", active: snap.views.__all.totals.active },
      ...snap.categories.map((c) => ({ id: c.id, name: c.name, active: c.active })),
      ...(none && (none.totals.active > 0 || none.totals.doneToday > 0)
        ? [{ id: "__none", name: "ไม่ระบุหมวด", active: none.totals.active }]
        : []),
    ];
  }, [snap]);

  const view = snap ? (snap.views[cat] ?? snap.views.__all) : null;
  const activeSteps = view?.steps.filter((s) => s.active > 0) ?? [];
  const idleSteps = view?.steps.filter((s) => s.active === 0) ?? [];
  const outputSteps = (view?.steps.filter((s) => s.doneToday > 0) ?? [])
    .slice()
    .sort((a, b) => b.doneToday - a.doneToday);
  const maxDone = Math.max(1, ...outputSteps.map((s) => s.doneToday));
  const feed = snap
    ? snap.feed
        .filter((f) =>
          cat === "__all" ? true : cat === "__none" ? f.categoryId === null : f.categoryId === cat,
        )
        .slice(0, 12)
    : [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
                error || stale ? "bg-red-500" : "animate-ping bg-emerald-500"
              }`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                error || stale ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
          </span>
          <h1 className="text-xl font-semibold sm:text-2xl">Monitor Real-Time</h1>
          <span className="text-sm text-muted-foreground">
            {error || stale ? "ขาดการเชื่อมต่อ" : "LIVE"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-medium tabular-nums">
            {now.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={fullscreen}
            aria-label="เต็มจอ"
          >
            <Maximize2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {error && !snap ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : !snap || !view ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <nav aria-label="หมวดหมู่" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {tabs.map((t) => {
              const selected = t.id === cat;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCat(t.id)}
                  aria-pressed={selected}
                  className={`flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  {t.name}
                  {t.active > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                        selected
                          ? "bg-primary-foreground/20"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {t.active}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="กำลังผลิต"
              value={view.totals.active}
              sub={`${activeSteps.length} จาก ${view.steps.length} ขั้นตอนมีคนทำ`}
              percent={pct(activeSteps.length, view.steps.length)}
              tone="sky"
            />
            <Kpi
              label="เสร็จวันนี้"
              value={view.totals.doneToday}
              sub="% เสร็จ เทียบกับงานที่กำลังทำ"
              percent={pct(view.totals.doneToday, view.totals.doneToday + view.totals.active)}
              tone="emerald"
            />
            <Kpi
              label="เกินเวลามาตรฐาน"
              value={view.totals.over}
              sub={view.totals.over === 0 ? "ทุกงานอยู่ในเวลา" : "% ของงานที่กำลังทำ"}
              percent={pct(view.totals.over, view.totals.active)}
              tone={view.totals.over > 0 ? "red" : "slate"}
            />
            <Kpi
              label="ไฟแดง"
              value={view.totals.red}
              sub={view.totals.red === 0 ? "ไม่มีไฟแดง" : "% ของงานที่กำลังทำ"}
              percent={pct(view.totals.red, view.totals.active)}
              tone={view.totals.red > 0 ? "red" : "slate"}
            />
          </section>

          <section aria-label="ขั้นตอนที่มีคนกำลังทำ">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              กำลังทำงานอยู่ ({activeSteps.length} ขั้นตอน)
            </h2>
            {activeSteps.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                ตอนนี้ไม่มีใครกำลังทำงานในหมวดนี้
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeSteps.map((s) => (
                  <ActiveStepCard key={s.id} s={s} />
                ))}
              </div>
            )}
          </section>

          {idleSteps.length > 0 && (
            <section aria-label="ขั้นตอนที่ว่าง">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                ว่างอยู่ ({idleSteps.length} ขั้นตอน)
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {idleSteps.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-card/60 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">{s.name}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {s.doneToday}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {outputSteps.length > 0 && (
            <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-label="ผลผลิตวันนี้">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">ผลผลิตวันนี้ต่อขั้นตอน</h2>
                <span className="text-xs text-muted-foreground">
                  รวม {view.totals.doneToday} งาน
                </span>
              </div>
              <ul className="space-y-2.5">
                {outputSteps.map((s) => (
                  <li
                    key={s.id}
                    className="grid grid-cols-[minmax(7rem,12rem)_1fr_3rem] items-center gap-3"
                  >
                    <span className="truncate text-sm">{s.name}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
                        style={{ width: `${Math.max(3, (s.doneToday / maxDone) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {s.doneToday}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4 text-red-500" /> เกินเวลามาตรฐาน
              </h2>
              {view.alerts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีงานเกินเวลา</p>
              ) : (
                <ul className="space-y-2">
                  {view.alerts.map((a, i) => (
                    <li
                      key={`${a.job}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2.5 dark:bg-red-950/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.job}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.step} · {a.who} · ทำมา {fmtDur(a.seconds)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                        +{fmtDur(a.overSeconds)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-semibold">ความเคลื่อนไหวล่าสุด</h2>
              {feed.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีการสแกน</p>
              ) : (
                <ul className="divide-y">
                  {feed.map((f, i) => (
                    <li key={`${f.at}-${i}`} className="flex items-center gap-3 py-2">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {fmtTime(f.at)}
                      </span>
                      {f.action === "start" ? (
                        <Play className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                      ) : (
                        <Square className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      )}
                      <p className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-medium">{f.who}</span>{" "}
                        {f.action === "start" ? "เริ่ม" : "จบ"} {f.step}
                        <span className="text-muted-foreground"> · {f.job}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
