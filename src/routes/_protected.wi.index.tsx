import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ChevronDown, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { flagFor } from "@/lib/utils/i18n";
import { wiTrainingRecords, type WiTrainingEmployee } from "@/lib/features/wi.functions";
import { formatThaiDateTime } from "@/lib/wi/wi-client";

export const Route = createFileRoute("/_protected/wi/")({
  component: WiDashboardPage,
});

type Data = Awaited<ReturnType<typeof wiTrainingRecords>>;
type Filter = "pending" | "done" | "all";

const RESULT_LABEL = {
  passed: "ผ่านการอบรมออนไลน์",
  viewed: "เปิดดูแล้วยังไม่ยืนยัน",
  outdated: "ผ่านฉบับเก่า ต้องอบรมใหม่",
  none: "ยังไม่เปิดดู",
} as const;

function WiDashboardPage() {
  const load = useServerFn(wiTrainingRecords);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

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

  const split = useMemo(() => {
    const people = data?.employees ?? [];
    const total = data?.manual_count ?? 0;
    const done = people.filter((person) => total > 0 && person.passed === total);
    const pending = people.filter((person) => total === 0 || person.passed < total);
    return { done, pending };
  }, [data]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source =
      filter === "done"
        ? split.done
        : filter === "pending"
          ? split.pending
          : (data?.employees ?? []);
    return source.filter(
      (person) =>
        !q ||
        person.name.toLowerCase().includes(q) ||
        (person.emp_code ?? "").toLowerCase().includes(q),
    );
  }, [data, filter, query, split]);

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 pb-12 pt-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ภาพรวม WI</h1>
          <p className="text-sm text-muted-foreground">
            ใครอ่านคู่มือครบแล้ว ใครยังค้าง จะได้ตามต่อ
          </p>
        </div>
        <Button variant="outline" className="h-11 gap-1" onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> รีเฟรช
        </Button>
      </div>

      {error && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm">โหลดข้อมูลไม่สำเร็จ: {error}</p>
          <Button variant="outline" className="h-10" onClick={refresh}>
            ลองใหม่
          </Button>
        </div>
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setFilter("done")}
              className={cn(
                "rounded-2xl border p-4 text-left",
                filter === "done" ? "border-emerald-400 bg-emerald-50" : "border-border bg-card",
              )}
            >
              <div className="text-4xl font-bold tabular-nums text-emerald-700">
                {split.done.length}
              </div>
              <div className="font-semibold">อ่านครบ</div>
              <p className="text-sm text-muted-foreground">
                ผ่านครบ {data.manual_count} คู่มือที่เผยแพร่
              </p>
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={cn(
                "rounded-2xl border p-4 text-left",
                filter === "pending" ? "border-amber-400 bg-amber-50" : "border-border bg-card",
              )}
            >
              <div className="text-4xl font-bold tabular-nums text-amber-800">
                {split.pending.length}
              </div>
              <div className="font-semibold">ค้าง</div>
              <p className="text-sm text-muted-foreground">ยังอ่านไม่ครบ หรือยังไม่ยืนยัน</p>
            </button>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "min-h-10 rounded-full border px-3 text-sm",
                filter === "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border",
              )}
            >
              ทั้งหมด {data.employees.length}
            </button>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นชื่อหรือรหัส"
                className="h-11 pl-8"
              />
            </div>
          </div>

          {data.manual_count === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              ยังไม่มีคู่มือที่เผยแพร่ จึงยังไม่มีใครผ่านการอบรม
            </p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ไม่พบชื่อในกลุ่มนี้</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {shown.map((person) => (
                <PersonRow
                  key={person.employee_id}
                  person={person}
                  total={data.manual_count}
                  open={openId === person.employee_id}
                  onToggle={() =>
                    setOpenId((current) =>
                      current === person.employee_id ? null : person.employee_id,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function PersonRow({
  person,
  total,
  open,
  onToggle,
}: {
  person: WiTrainingEmployee;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  const missing = person.manuals.filter((manual) => manual.result !== "passed");
  const done = person.passed === total && total > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <span className="pt-0.5">{flagFor(person.nationality)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">
            {person.name}{" "}
            {person.emp_code && (
              <span className="font-mono text-xs text-muted-foreground">{person.emp_code}</span>
            )}
          </span>
          <span className="block text-sm text-muted-foreground">
            {done
              ? `อ่านครบ ${person.passed}/${total}`
              : `ค้าง ${missing.length} คู่มือ · ${missing
                  .slice(0, 3)
                  .map((manual) => manual.title)
                  .join(", ")}${missing.length > 3 ? "…" : ""}`}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
            done ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900",
          )}
        >
          {done ? "ครบ" : `${person.passed}/${total}`}
        </span>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            แบบบันทึกการอบรมออนไลน์
          </p>
          <ul className="space-y-2">
            {person.manuals.map((manual) => (
              <li key={manual.wi_id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{manual.wi_code}</span>
                  <span className="font-medium">{manual.title}</span>
                  {manual.version && (
                    <span className="text-xs text-muted-foreground">{manual.version}</span>
                  )}
                  <span
                    className={cn(
                      "ml-auto text-xs font-semibold",
                      manual.result === "passed" ? "text-emerald-700" : "text-amber-800",
                    )}
                  >
                    {RESULT_LABEL[manual.result]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {manual.result === "passed" && manual.acknowledged_at
                    ? `ผ่านเมื่อ ${formatThaiDateTime(manual.acknowledged_at)}`
                    : manual.result === "outdated"
                      ? "ผ่านฉบับเก่าแล้ว ต้องอ่านฉบับที่เผยแพร่อยู่"
                      : manual.last_viewed_at
                        ? `เปิดล่าสุด ${formatThaiDateTime(manual.last_viewed_at)} · ${manual.view_count} ครั้ง`
                        : "ยังไม่มีการเปิดดู"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
