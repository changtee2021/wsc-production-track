import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IsoApprove } from "@/components/iso29110/IsoApprove";
import { IsoAuditReport } from "@/components/iso29110/IsoAuditReport";
import { IsoDocuments } from "@/components/iso29110/IsoDocuments";
import {
  ISO_CATEGORIES,
  ISO_ITEMS,
  ISO_STATUS_LABEL,
  type IsoStatus,
} from "@/lib/iso29110/checklist";

export const Route = createFileRoute("/_protected/iso-29110")({
  head: () => ({ meta: [{ title: "ISO 29110 — WSC ProductionTrack" }] }),
  component: Iso29110Page,
});

const STATUS_CLASS: Record<IsoStatus, string> = {
  have: "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  partial: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  missing: "border-stone-400/40 bg-stone-200/70 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300",
};

type StatusFilter = "all" | IsoStatus;

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "have", label: "มีแล้ว" },
  { id: "partial", label: "บางส่วน" },
  { id: "missing", label: "ยังไม่มี" },
];

function Iso29110Page() {
  const [view, setView] = useState<"check" | "docs" | "audit" | "approve">("approve");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const tally = { have: 0, partial: 0, missing: 0 };
    for (const item of ISO_ITEMS) tally[item.status] += 1;
    return tally;
  }, []);

  const groups = useMemo(
    () =>
      ISO_CATEGORIES.map((category) => ({
        category,
        items: ISO_ITEMS.filter(
          (item) => item.categoryId === category.id && (filter === "all" || item.status === filter),
        ),
      })).filter((group) => group.items.length > 0),
    [filter],
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <ClipboardCheck className="h-5 w-5" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          ISO/IEC 29110 Basic
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">ความพร้อมโปรเจกต์ซอฟต์แวร์</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        ใบด้านล่างคือสิ่งที่ให้ติ๊กอนุมัติ ที่ปรึกษาจัดเอกสารและรันเทสชิ้นส่วนแล้ว
        ยังไม่ติ๊กหรือเซ็นแทน CEO และหัวหน้าฝ่ายผลิต
      </p>
      <div className="no-print mt-4 flex flex-wrap gap-2" role="group" aria-label="มุมมอง">
        <Button
          type="button"
          variant={view === "approve" ? "default" : "outline"}
          className="min-h-11 px-3 sm:min-h-9"
          aria-pressed={view === "approve"}
          onClick={() => setView("approve")}
        >
          ให้ติ๊กอนุมัติ
        </Button>
        <Button
          type="button"
          variant={view === "audit" ? "default" : "outline"}
          className="min-h-11 px-3 sm:min-h-9"
          aria-pressed={view === "audit"}
          onClick={() => setView("audit")}
        >
          รายงานการตรวจ
        </Button>
        <Button
          type="button"
          variant={view === "docs" ? "default" : "outline"}
          className="min-h-11 px-3 sm:min-h-9"
          aria-pressed={view === "docs"}
          onClick={() => setView("docs")}
        >
          เอกสารหลักฐาน
        </Button>
        <Button
          type="button"
          variant={view === "check" ? "default" : "outline"}
          className="min-h-11 px-3 sm:min-h-9"
          aria-pressed={view === "check"}
          onClick={() => setView("check")}
        >
          เช็คลิส
        </Button>
      </div>
      {view === "approve" ? (
        <div className="mt-4">
          <IsoApprove />
        </div>
      ) : null}
      {view === "audit" ? (
        <div className="mt-4">
          <IsoAuditReport />
        </div>
      ) : null}
      {view === "docs" ? (
        <div className="mt-4">
          <IsoDocuments />
        </div>
      ) : null}
      {view === "check" ? (
        <>
          <dl className="mt-4 grid gap-2 rounded-2xl border bg-white/80 p-3 text-sm sm:grid-cols-2 dark:bg-zinc-900/60">
            <RoleLine title="ผู้สั่ง" body="CEO" />
            <RoleLine title="ผู้รับมอบ" body="หัวหน้าฝ่ายผลิต" />
            <RoleLine title="ผู้ใช้" body="พนักงานผลิต" />
            <RoleLine title="ผู้ทำระบบ" body="ฟรีแลนซ์ที่ปรึกษา" />
          </dl>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <CountCard
              label="มีแล้ว"
              value={counts.have}
              tone="text-emerald-700 dark:text-emerald-300"
            />
            <CountCard
              label="บางส่วน"
              value={counts.partial}
              tone="text-amber-700 dark:text-amber-300"
            />
            <CountCard
              label="ยังไม่มี"
              value={counts.missing}
              tone="text-stone-700 dark:text-zinc-200"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="กรองสถานะ">
            {FILTERS.map((item) => {
              const active = filter === item.id;
              const count = item.id === "all" ? ISO_ITEMS.length : counts[item.id];
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  className="min-h-11 px-3 sm:min-h-9"
                  aria-pressed={active}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} {count}
                </Button>
              );
            })}
          </div>

          <div className="mt-6 space-y-6">
            {groups.map(({ category, items }) => (
              <section key={category.id} aria-labelledby={`iso-${category.id}`}>
                <h2 id={`iso-${category.id}`} className="text-base font-semibold">
                  <span className="mr-2 text-muted-foreground">{category.code}</span>
                  {category.title}
                </h2>
                <ul className="mt-2 space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border bg-white/80 p-3 dark:bg-zinc-900/60"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{item.id}</p>
                          <p className="font-medium leading-snug">{item.title}</p>
                        </div>
                        <span
                          className={`inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold ${STATUS_CLASS[item.status]}`}
                        >
                          {ISO_STATUS_LABEL[item.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                      <p className="mt-2 text-xs text-foreground/80">ผู้เกี่ยวข้อง: {item.owner}</p>
                      {item.evidenceNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          หลักฐาน: {item.evidenceNote}
                        </p>
                      ) : null}
                      {item.evidenceTo && item.evidenceLabel ? (
                        <Link
                          to={item.evidenceTo}
                          className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline sm:min-h-9"
                        >
                          {item.evidenceLabel}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}

function RoleLine({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2 dark:bg-zinc-800/80">
      <dt className="text-xs text-muted-foreground">{title}</dt>
      <dd className="font-medium">{body}</dd>
    </div>
  );
}

function CountCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/60">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
