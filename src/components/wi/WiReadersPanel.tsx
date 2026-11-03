// Admin report: who has read / confirmed the live version of one WI.
// Self-reported on the shop floor (employee picks their own name).
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireToken } from "@/lib/utils/admin-helpers";
import { flagFor } from "@/lib/utils/i18n";
import { formatThaiDateTime } from "@/lib/wi/wi-client";
import { wiReadersList, type WiReadStatus, type WiReaderRow } from "@/lib/features/wi.functions";

const STATUS_LABEL: Record<WiReadStatus, string> = {
  read: "ผ่านการอบรมออนไลน์",
  viewed: "เปิดดูแล้ว ยังไม่ยืนยัน",
  outdated: "อ่านฉบับเก่า",
  none: "ยังไม่เปิด",
};

const STATUS_CLASS: Record<WiReadStatus, string> = {
  read: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  viewed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  outdated: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  none: "bg-muted text-muted-foreground",
};

const LANG_SHORT: Record<string, string> = { th: "ไทย", en: "EN", my: "MY" };

type Filter = "all" | WiReadStatus;

export function WiReadersPanel({
  wiId,
  liveVersion,
}: {
  wiId: string;
  liveVersion: string | null;
}) {
  const listFn = useServerFn(wiReadersList);
  const [rows, setRows] = useState<WiReaderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    let token: string;
    try {
      token = requireToken();
    } catch {
      return;
    }
    listFn({ data: { token, wi_id: wiId } })
      .then((r) => alive && setRows(r.rows))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, [listFn, wiId, reload]);

  const counts = useMemo(() => {
    const c: Record<WiReadStatus, number> = { read: 0, viewed: 0, outdated: 0, none: 0 };
    for (const r of rows ?? []) c[r.status] += 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? [])
      .filter((r) => filter === "all" || r.status === filter)
      .filter(
        (r) =>
          !q || r.name.toLowerCase().includes(q) || (r.emp_code ?? "").toLowerCase().includes(q),
      );
  }, [rows, filter, query]);

  if (!liveVersion) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        ยังไม่มีฉบับเผยแพร่ — การอ่านจะเริ่มนับเมื่ออนุมัติแล้ว
      </p>
    );
  }
  if (error) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" className="h-10" onClick={() => setReload((n) => n + 1)}>
          ลองใหม่
        </Button>
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลด…
      </div>
    );
  }

  const total = rows.length;
  const pct = total ? Math.round((counts.read / total) * 100) : 0;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">การอ่านฉบับ {liveVersion}</h2>
          <p className="text-xs text-muted-foreground">
            พนักงานสแกนบัตรหรือกรอกเลขพนักงานที่หน้าคู่มือ แล้วกด “อ่านจบแล้ว เข้าใจ” ·
            ออกฉบับใหม่ต้องยืนยันใหม่
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {counts.read}/{total}
          </div>
          <div className="text-xs text-muted-foreground">ผ่านอบรม {pct}%</div>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "none", "viewed", "outdated", "read"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-xs font-medium",
              filter === f ? "border-foreground bg-foreground text-background" : "border-border",
            )}
          >
            {f === "all" ? `ทั้งหมด ${total}` : `${STATUS_LABEL[f]} ${counts[f]}`}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ / รหัส"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีรายชื่อในกลุ่มนี้</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((r) => (
            <li key={r.employee_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span>{flagFor(r.nationality)}</span>
              <span className="font-medium">{r.name}</span>
              {r.emp_code && (
                <span className="font-mono text-xs text-muted-foreground">{r.emp_code}</span>
              )}
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_CLASS[r.status],
                )}
              >
                {STATUS_LABEL[r.status]}
              </span>
              {(r.acknowledged_at || r.last_viewed_at) && (
                <span className="w-full text-xs text-muted-foreground sm:w-auto">
                  {r.acknowledged_at
                    ? `ผ่านเมื่อ ${formatThaiDateTime(r.acknowledged_at)}`
                    : `เปิดล่าสุด ${formatThaiDateTime(r.last_viewed_at!)}`}
                  {r.view_count > 0 ? ` · เปิด ${r.view_count} ครั้ง` : ""}
                  {r.lang ? ` · ${LANG_SHORT[r.lang] ?? r.lang}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
