import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminFetchQcReports,
  adminUpdateQcReportStatus,
  adminDeleteQcReport,
  adminFetchJobWorkers,
} from "@/lib/admin.functions";
import { adminSignMediaUrls } from "@/lib/media.functions";
import { requireToken, showError } from "@/lib/admin-helpers";
import { downloadQcReportsCsv } from "@/lib/qc-export";

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MediaLightbox } from "@/components/MediaLightbox";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Check,
  Undo2,
  ClipboardCheck,
  Download,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";

export const Route = createFileRoute("/_protected/qc-reports")({
  head: () => ({ meta: [{ title: "รายงาน QC — WSC ProductionTrack" }] }),
  component: QcReportsPage,
});

interface MediaItem {
  url: string;
  type: "image" | "video";
}

interface QcReportItem {
  id: string;
  item_text_snapshot: string;
  item_order: number;
  is_passed: boolean;
  result_tag: string | null;
  remark: string | null;
  media: MediaItem[];
}

interface QcReportRow {
  id: string;
  job_id: string;
  qc_employee_id: string;
  production_log_id: string | null;
  step_id: string | null;
  category_id: string | null;
  employee_id: string | null;
  note: string | null;
  media: MediaItem[];
  status: "open" | "resolved";
  overall_result: "pass" | "fail" | null;
  summary: string | null;
  created_at: string;
  qc_employees: { name: string; emp_code: string | null } | null;
  employees: { name: string; emp_code: string | null } | null;
  steps: { step_name: string } | null;
  categories: { name: string } | null;
  qc_report_items: QcReportItem[] | null;
}

function QcReportsPage() {
  const fetchReports = useServerFn(adminFetchQcReports);
  const updateStatus = useServerFn(adminUpdateQcReportStatus);
  const del = useServerFn(adminDeleteQcReport);
  const fetchJobWorkers = useServerFn(adminFetchJobWorkers);
  const signUrls = useServerFn(adminSignMediaUrls);

  const [rows, setRows] = useState<QcReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<"open" | "resolved" | "all">("all");
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});
  type JobWorkerRow = {
    id: string;
    action: string;
    created_at: string;
    note: string | null;
    employees: { name: string; emp_code: string | null } | null;
    steps: { step_name: string } | null;
    categories: { name: string } | null;
  };
  const [jobWorkersMap, setJobWorkersMap] = useState<Record<string, JobWorkerRow[]>>({});
  const [jobWorkersLoading, setJobWorkersLoading] = useState<Record<string, boolean>>({});

  const loadJobWorkers = async (jobId: string) => {
    if (jobWorkersMap[jobId] || jobWorkersLoading[jobId]) return;
    setJobWorkersLoading((p) => ({ ...p, [jobId]: true }));
    try {
      const token = requireToken();
      const res = await fetchJobWorkers({ data: { token, job_id: jobId } });
      setJobWorkersMap((p) => ({ ...p, [jobId]: (res.rows ?? []) as unknown as JobWorkerRow[] }));
    } catch (err) {
      showError(err, "โหลดรายชื่อพนักงานไม่สำเร็จ");
    } finally {
      setJobWorkersLoading((p) => ({ ...p, [jobId]: false }));
    }
  };

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
      const fetched = (res.rows ?? []) as unknown as QcReportRow[];
      setRows(fetched);
      const refs = new Set<string>();
      for (const r of fetched) {
        for (const m of r.media ?? []) if (m.url) refs.add(m.url);
        for (const it of r.qc_report_items ?? []) {
          for (const m of it.media ?? []) if (m.url) refs.add(m.url);
        }
      }
      if (refs.size > 0) {
        try {
          const { urlMap } = await signUrls({
            data: { token, refs: Array.from(refs), defaultBucket: "qc-media" },
          });
          setSignedMap(urlMap);
        } catch {
          // Fall back to raw values for legacy public URLs
        }
      } else {
        setSignedMap({});
      }
    } catch (err) {
      showError(err, "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const signedSrc = (ref: string) => signedMap[ref] ?? ref;


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
      showError(err, "ผิดพลาด");
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
      showError(err, "ผิดพลาด");
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }
    downloadQcReportsCsv(rows);
    toast.success(`ส่งออก ${rows.length} รายงานแล้ว`);
  };

  const totalRows = useMemo(() => rows.length, [rows]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">รายงาน QC</h1>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExport}
          disabled={loading || totalRows === 0}
        >
          <Download className="h-4 w-4" />
          ส่งออก CSV ({totalRows})
        </Button>
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
        {rows.map((r) => {
          const items = [...(r.qc_report_items ?? [])].sort((a, b) => a.item_order - b.item_order);
          // Auto-expand failed items
          const defaultOpen = items.filter((it) => !it.is_passed).map((it) => it.id);
          const passCount = items.filter((it) => it.is_passed).length;
          const failCount = items.length - passCount;

          return (
            <article key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <Accordion type="single" collapsible>
                <AccordionItem value="card" className="border-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 pr-2 text-left">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("th-TH")}
                      </span>
                      <span className="text-base font-bold">
                        Job <span className="font-mono">{r.job_id}</span>
                      </span>
                      <span className="text-sm">
                        <span className="text-muted-foreground">QC: </span>
                        <span className="font-semibold">{r.qc_employees?.name ?? "—"}</span>
                        {r.qc_employees?.emp_code && (
                          <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                            ({r.qc_employees.emp_code})
                          </span>
                        )}
                      </span>
                      {r.overall_result && (
                        <span
                          className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${
                            r.overall_result === "pass"
                              ? "bg-success/15 text-success"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {r.overall_result === "pass" ? "✓ ผ่าน" : "✗ ไม่ผ่าน"}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.status === "resolved"
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.status === "resolved" ? "แก้ไขแล้ว" : "ยังไม่แก้"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.categories?.name && <span>หมวด: {r.categories.name}</span>}
                      {items.length > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          ผ่าน {passCount}/{items.length}
                        </span>
                      )}
                      {r.summary && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {r.summary}
                        </span>
                      )}
                    </div>

              {items.length > 0 && (
                <div className="mt-3">
                  <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
                    {items.map((it) => {
                      const mediaCount = it.media?.length ?? 0;
                      const isMotor = it.is_passed && it.result_tag === "motor";
                      return (
                        <AccordionItem
                          key={it.id}
                          value={it.id}
                          className={`rounded-lg border px-3 ${
                            isMotor
                              ? "border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20"
                              : it.is_passed
                                ? "border-success/30 bg-success/5"
                                : "border-destructive/40 bg-destructive/5"
                          }`}
                        >
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex w-full items-center gap-2 pr-2 text-left">
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  isMotor
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                    : it.is_passed
                                      ? "bg-success/20 text-success"
                                      : "bg-destructive/20 text-destructive"
                                }`}
                              >
                                {isMotor ? "M" : it.is_passed ? "✓" : "✗"}
                              </span>
                              <span className="flex-1 truncate text-sm font-medium">
                                {it.item_order}. {it.item_text_snapshot}
                              </span>
                              {isMotor && (
                                <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                  มอเตอร์
                                </span>
                              )}
                              {mediaCount > 0 && (
                                <span className="shrink-0 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  {mediaCount} สื่อ
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="pb-3 pt-1">
                            {it.remark && (
                              <p className="mb-2 whitespace-pre-wrap rounded-md bg-background/60 p-2 text-xs text-destructive">
                                <span className="font-semibold">หมายเหตุ: </span>{it.remark}
                              </p>
                            )}
                            {mediaCount > 0 ? (
                              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                                {it.media.map((m, i) => (
                                  <button
                                    type="button"
                                    key={i}
                                    onClick={() => setLightbox(m)}
                                    className="group relative block aspect-square overflow-hidden rounded-md border border-border bg-muted"
                                  >
                                    {m.type === "image" ? (
                                      <img src={signedSrc(m.url)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                      <>
                                        <video src={signedSrc(m.url)} muted className="h-full w-full object-cover" />
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                          <VideoIcon className="h-6 w-6 text-white" />
                                        </span>
                                      </>
                                    )}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs italic text-muted-foreground">ไม่มีสื่อหลักฐาน</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              )}

              <div className="mt-3">
                <Accordion
                  type="single"
                  collapsible
                  onValueChange={(v) => {
                    if (v) loadJobWorkers(r.job_id);
                  }}
                >
                  <AccordionItem value="workers" className="rounded-lg border border-border bg-muted/30 px-3">
                    <AccordionTrigger className="py-2 text-sm hover:no-underline">
                      พนักงานที่ทำใน Job นี้ทั้งหมด (กดเพื่อดู)
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 pt-1">
                      {jobWorkersLoading[r.job_id] ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังโหลด...
                        </div>
                      ) : !jobWorkersMap[r.job_id] ? (
                        <p className="py-2 text-xs italic text-muted-foreground">กดเพื่อโหลดข้อมูล</p>
                      ) : jobWorkersMap[r.job_id].length === 0 ? (
                        <p className="py-2 text-xs italic text-muted-foreground">ไม่มีบันทึกการผลิตสำหรับ Job นี้</p>
                      ) : (
                        <ol className="space-y-1.5 text-xs">
                          {jobWorkersMap[r.job_id].map((w, idx) => (
                            <li
                              key={w.id}
                              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md bg-background/60 px-2 py-1.5"
                            >
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {idx + 1}.
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {new Date(w.created_at).toLocaleString("th-TH")}
                              </span>
                              <span className="font-semibold">
                                {w.steps?.step_name ?? "—"}
                              </span>
                              <span className="text-muted-foreground">โดย</span>
                              <span className="font-medium">{w.employees?.name ?? "—"}</span>
                              {w.employees?.emp_code && (
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  ({w.employees.emp_code})
                                </span>
                              )}
                              {w.categories?.name && (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {w.categories.name}
                                </span>
                              )}
                              {w.note && (
                                <span className="basis-full whitespace-pre-wrap pl-4 text-muted-foreground">
                                  หมายเหตุ: {w.note}
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>



              {r.note && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">หมายเหตุภาพรวม</div>
                  <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">
                    {r.note}
                  </p>
                </div>
              )}

              {r.media && r.media.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" /> สื่อภาพรวม
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {r.media.map((m, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setLightbox(m)}
                        className="relative block aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                      >
                        {m.type === "image" ? (
                          <img src={signedSrc(m.url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <>
                            <video src={signedSrc(m.url)} muted className="h-full w-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <VideoIcon className="h-6 w-6 text-white" />
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </article>
          );
        })}
      </section>

      <MediaLightbox item={lightbox} signedSrc={signedSrc} onClose={() => setLightbox(null)} />
    </main>
  );
}
