// Production queue — incoming jobs from Curtain Flow.
// Admin views/manages and prints QR labels for the factory floor.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Printer,
  Ban,
  Search,
  Factory,
  Ruler,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  adminListProductionJobs,
  adminMarkLabelPrinted,
  adminCancelProductionJob,
  type ProductionJobRow,
  type ProductionJobStatus,
} from "@/lib/features/production-jobs.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_protected/production-queue")({
  head: () => ({ meta: [{ title: "คิวผลิต (Curtain Flow) — WSC" }] }),
  component: ProductionQueuePage,
});

const STATUS_LABEL: Record<ProductionJobStatus | "all", string> = {
  all: "ทั้งหมด",
  pending: "รอผลิต",
  in_progress: "กำลังผลิต",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};
const STATUS_BADGE: Record<ProductionJobStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH");
  } catch {
    return d;
  }
}

function ProductionQueuePage() {
  const listFn = useServerFn(adminListProductionJobs);
  const printFn = useServerFn(adminMarkLabelPrinted);
  const cancelFn = useServerFn(adminCancelProductionJob);
  const [rows, setRows] = useState<ProductionJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ProductionJobStatus | "all">("pending");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn({
        data: {
          token: requireToken(),
          status,
          search: search.trim() || undefined,
          limit: 200,
        },
      });
      setRows(res.jobs);
    } catch (e) {
      showError(e, "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [listFn, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const onPrint = async (job: ProductionJobRow) => {
    try {
      await printFn({ data: { token: requireToken(), id: job.id } });
      window.open(`/print-label/${encodeURIComponent(job.job_no)}`, "_blank", "noopener");
      load();
    } catch (e) {
      showError(e, "พิมพ์ไม่สำเร็จ");
    }
  };

  const onCancel = async (job: ProductionJobRow) => {
    if (!confirm(`ยกเลิกใบงาน ${job.job_no}?`)) return;
    try {
      await cancelFn({ data: { token: requireToken(), id: job.id } });
      toast.success("ยกเลิกแล้ว");
      load();
    } catch (e) {
      showError(e, "ยกเลิกไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-4">
      <Toaster richColors position="top-center" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Factory className="h-5 w-5 text-primary" />
          คิวผลิต (Curtain Flow)
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="ค้นหา job_no / order / ลูกค้า"
              className="h-9 w-64 pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as ProductionJobStatus | "all")}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["pending", "in_progress", "done", "cancelled", "all"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={load} variant="outline" size="sm" className="gap-1">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            รีเฟรช
          </Button>
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            ไม่มีใบงานในสถานะนี้
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((j) => (
          <Card key={j.id} className="overflow-hidden border-2 transition hover:shadow-md">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-2xl font-extrabold tracking-tight text-primary">
                    {j.job_no}
                  </div>
                  {j.order_no && (
                    <div className="text-xs font-semibold text-muted-foreground">{j.order_no}</div>
                  )}
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-semibold",
                    STATUS_BADGE[j.status],
                  )}
                >
                  {STATUS_LABEL[j.status]}
                </span>
              </div>

              {j.customer_name && (
                <div className="flex items-center gap-1.5 text-sm">
                  <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{j.customer_name}</span>
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {j.product_type ?? "—"}
                </div>
                <div className="mt-1 flex items-baseline gap-1 font-mono text-lg font-bold">
                  <Ruler className="h-4 w-4 self-center text-muted-foreground" />
                  {j.width_cm ?? "?"} × {j.height_cm ?? "?"} cm
                  {j.side && <span className="ml-1 text-sm text-muted-foreground">({j.side})</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {j.fabric_code && <Tag label="ผ้า" v={j.fabric_code} />}
                {j.rail_code && <Tag label="ราง" v={j.rail_code} />}
                {j.color_code && <Tag label="สี" v={j.color_code} />}
                {j.motor && <Tag label="มอเตอร์" v={j.motor} />}
                {j.qty > 1 && <Tag label="จำนวน" v={String(j.qty)} />}
                {j.due_date && <Tag label="ส่ง" v={fmtDate(j.due_date)} />}
              </div>

              {j.printed_at && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  พิมพ์แล้ว {fmtDate(j.printed_at)}
                </div>
              )}
              {j.started_at && (
                <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                  <Clock className="h-3 w-3" />
                  เริ่มเมื่อ {new Date(j.started_at).toLocaleString("th-TH")}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => onPrint(j)}
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={j.status === "cancelled"}
                >
                  <Printer className="h-4 w-4" /> พิมพ์ Label
                </Button>
                <Link to="/scan" search={{ job_id: j.job_no }} className="flex-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full gap-1"
                    disabled={j.status === "cancelled" || j.status === "done"}
                  >
                    เปิดสแกน
                  </Button>
                </Link>
                {j.status !== "cancelled" && j.status !== "done" && (
                  <Button
                    onClick={() => onCancel(j)}
                    size="sm"
                    variant="ghost"
                    className="px-2 text-rose-600"
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Tag({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex items-center gap-1 rounded border bg-background px-1.5 py-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{v}</span>
    </div>
  );
}
