import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminToken, clearAdminSession } from "@/lib/admin-session";
import {
  adminFetchQcReports,
  adminUpdateQcReportStatus,
  adminDeleteQcReport,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Check,
  Undo2,
  ClipboardCheck,
} from "lucide-react";

export const Route = createFileRoute("/_protected/qc-reports")({
  head: () => ({ meta: [{ title: "รายงาน QC — WSC ProductionTrack" }] }),
  component: QcReportsPage,
});

interface QcReportRow {
  id: string;
  job_id: string;
  qc_employee_id: string;
  production_log_id: string | null;
  step_id: string | null;
  category_id: string | null;
  employee_id: string | null;
  note: string | null;
  media: Array<{ url: string; type: "image" | "video" }>;
  status: "open" | "resolved";
  created_at: string;
  qc_employees: { name: string; emp_code: string | null } | null;
  employees: { name: string; emp_code: string | null } | null;
  steps: { step_name: string } | null;
  categories: { name: string } | null;
}

function requireToken(): string {
  const t = getAdminToken();
  if (!t) {
    clearAdminSession();
    if (typeof window !== "undefined") window.location.href = "/admin";
    throw new Error("Unauthorized");
  }
  return t;
}

function QcReportsPage() {
  const fetchReports = useServerFn(adminFetchQcReports);
  const updateStatus = useServerFn(adminUpdateQcReportStatus);
  const del = useServerFn(adminDeleteQcReport);

  const [rows, setRows] = useState<QcReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<"open" | "resolved" | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const res = await fetchReports({
        data: {
          token,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
          job_id: jobId.trim() || undefined,
          status,
        },
      });
      setRows((res.rows ?? []) as unknown as QcReportRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRowStatus = async (id: string, s: "open" | "resolved") => {
    try {
      const token = requireToken();
      await updateStatus({ data: { token, id, status: s } });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: s } : r)));
      toast.success("อัปเดตสถานะแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ผิดพลาด");
    }
  };

  const removeRow = async (id: string) => {
    if (!confirm("ลบรายงานนี้?")) return;
    try {
      const token = requireToken();
      await del({ data: { token, id } });
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("ลบแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ผิดพลาด");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">รายงาน QC</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        รายงานข้อผิดพลาดจากพนักงาน QC พร้อมรูปและวิดีโอประกอบ
      </p>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label className="text-xs">จากวันที่</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">ถึงวันที่</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Job ID</Label>
            <Input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="ค้นหา job" />
          </div>
          <div>
            <Label className="text-xs">สถานะ</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="open">ยังไม่แก้</SelectItem>
                <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={load} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              ค้นหา
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-4 space-y-3">
        {rows.length === 0 && !loading && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            ไม่มีรายงาน QC
          </div>
        )}
        {rows.map((r) => (
          <article key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{new Date(r.created_at).toLocaleString("th-TH")}</span>
                  <span>•</span>
                  <span>Job <span className="font-mono font-semibold text-foreground">{r.job_id}</span></span>
                  {r.categories?.name && (<><span>•</span><span>{r.categories.name}</span></>)}
                </div>
                <h3 className="mt-1 text-lg font-bold leading-tight">
                  {r.steps?.step_name ?? "ขั้นตอนไม่ระบุ"}
                </h3>
                <div className="mt-1 text-sm">
                  <span className="text-muted-foreground">พนักงานที่ทำ: </span>
                  <span className="font-medium">{r.employees?.name ?? "—"}</span>
                  {r.employees?.emp_code && (
                    <span className="ml-1 font-mono text-xs text-muted-foreground">({r.employees.emp_code})</span>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">ผู้ตรวจ QC: </span>
                  <span className="font-medium">{r.qc_employees?.name ?? "—"}</span>
                  {r.qc_employees?.emp_code && (
                    <span className="ml-1 font-mono text-xs text-muted-foreground">({r.qc_employees.emp_code})</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    r.status === "resolved"
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {r.status === "resolved" ? "แก้ไขแล้ว" : "ยังไม่แก้"}
                </span>
              </div>
            </div>

            {r.note && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">
                {r.note}
              </p>
            )}

            {r.media && r.media.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {r.media.map((m, i) =>
                  m.type === "image" ? (
                    <a key={i} href={m.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ) : (
                    <video key={i} src={m.url} controls className="aspect-square w-full rounded-lg border border-border bg-black object-contain" />
                  ),
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "open" ? (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setRowStatus(r.id, "resolved")}>
                  <Check className="h-4 w-4" /> ทำเครื่องหมายว่าแก้แล้ว
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setRowStatus(r.id, "open")}>
                  <Undo2 className="h-4 w-4" /> กลับเป็นยังไม่แก้
                </Button>
              )}
              <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => removeRow(r.id)}>
                <Trash2 className="h-4 w-4" /> ลบ
              </Button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
