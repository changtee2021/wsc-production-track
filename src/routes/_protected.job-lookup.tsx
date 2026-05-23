import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminFetchJobDetail } from "@/lib/admin.functions";
import { adminSignMediaUrls } from "@/lib/media.functions";
import { requireToken, showError } from "@/lib/admin-helpers";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { downloadMediaAsZip } from "@/lib/media-zip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Search,
  ScanLine,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  ListChecks,
  Clock,
  Tag,
  Hash,
  Image as ImageIcon,
  Video as VideoIcon,
  ClipboardCheck,
  PlayCircle,
  StopCircle,
  Wrench,
  Download,
  Package,
} from "lucide-react";

export const Route = createFileRoute("/_protected/job-lookup")({
  head: () => ({ meta: [{ title: "ค้นหา Job ด่วน — WSC ProductionTrack" }] }),
  component: JobLookupPage,
});

interface MediaItem {
  url: string;
  type: "image" | "video";
}
interface LogRow {
  id: string;
  job_id: string;
  action: string;
  created_at: string;
  note: string | null;
  note_image_url: string | null;
  employees: { id: string; name: string; emp_code: string | null; avatar_url: string | null; nationality: string | null } | null;
  steps: { id: string; step_name: string; icon: string | null } | null;
  categories: { id: string; name: string } | null;
}
interface QcItem {
  id: string;
  item_text_snapshot: string;
  item_order: number;
  is_passed: boolean;
  result_tag: string | null;
  remark: string | null;
  media: MediaItem[];
}
interface ReportRow {
  id: string;
  job_id: string;
  created_at: string;
  status: "open" | "resolved";
  overall_result: "pass" | "fail" | null;
  note: string | null;
  summary: string | null;
  media: MediaItem[];
  qc_employees?: { name: string; emp_code: string | null; avatar_url: string | null } | null;
  packing_employees?: { name: string; emp_code: string | null; avatar_url: string | null } | null;
  employees: { name: string; emp_code: string | null } | null;
  steps: { step_name: string } | null;
  categories: { name: string } | null;
  qc_report_items?: QcItem[] | null;
  packing_report_items?: QcItem[] | null;
}
interface JobDetailFound {
  found: true;
  job_id: string;
  summary: {
    workers: number;
    steps_done: number;
    unique_steps: number;
    first_start: string | null;
    last_finish: string | null;
    top_category: string | null;
    qc: { total: number; pass: number; fail: number; unknown: number };
    packing: { total: number; pass: number; fail: number; unknown: number };
  };
  logs: LogRow[];
  reports: ReportRow[];
  packing_reports: ReportRow[];
}
type JobDetail = JobDetailFound | { found: false };

function fmtDateTime(s: string | null): string {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("th-TH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}

function actionMeta(a: string): { label: string; Icon: typeof PlayCircle; cls: string } {
  if (a === "start") return { label: "เริ่มงาน", Icon: PlayCircle, cls: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" };
  if (a === "finish") return { label: "เสร็จงาน", Icon: StopCircle, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" };
  return { label: a, Icon: Clock, cls: "text-muted-foreground bg-muted" };
}

function JobLookupPage() {
  const fetchDetail = useServerFn(adminFetchJobDetail);
  const signUrls = useServerFn(adminSignMediaUrls);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<JobDetail | null>(null);
  const [searched, setSearched] = useState(false);
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);
  const scannerOpen = scannerStream !== null;

  const signedSrc = useCallback((ref: string) => signedMap[ref] ?? ref, [signedMap]);

  const runSearch = useCallback(async (jobId: string) => {
    const id = jobId.trim();
    if (!id) {
      toast.error("กรุณาใส่เลข Job ID");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const token = requireToken();
      const res = (await fetchDetail({ data: { token, job_id: id } })) as JobDetail;
      setData(res);
      if (res.found) {
        // เซ็น URL ของสื่อจาก QC (bucket qc-media) และแพ็คของ (packing-media)
        const qcRefs = new Set<string>();
        for (const r of res.reports) {
          for (const m of r.media ?? []) if (m.url) qcRefs.add(m.url);
          for (const it of r.qc_report_items ?? []) {
            for (const m of it.media ?? []) if (m.url) qcRefs.add(m.url);
          }
        }
        const packingRefs = new Set<string>();
        for (const r of res.packing_reports) {
          for (const m of r.media ?? []) if (m.url) packingRefs.add(m.url);
          for (const it of r.packing_report_items ?? []) {
            for (const m of it.media ?? []) if (m.url) packingRefs.add(m.url);
          }
        }
        try {
          const merged: Record<string, string> = {};
          if (qcRefs.size > 0) {
            const { urlMap } = await signUrls({
              data: { token, refs: Array.from(qcRefs), defaultBucket: "qc-media" },
            });
            Object.assign(merged, urlMap);
          }
          if (packingRefs.size > 0) {
            const { urlMap } = await signUrls({
              data: { token, refs: Array.from(packingRefs), defaultBucket: "packing-media" },
            });
            Object.assign(merged, urlMap);
          }
          setSignedMap(merged);
        } catch { setSignedMap({}); }
      }
    } catch (err) {
      showError(err, "ค้นหาไม่สำเร็จ");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchDetail, signUrls]);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const downloadAllMedia = useCallback(async () => {
    if (!data || !data.found) return;
    // รวบรวมไฟล์สื่อทั้งหมด (note image + QC + แพ็คของ)
    const items: { ref: string; ext: string; folder: string }[] = [];
    const seen = new Set<string>();
    const push = (ref: string | null | undefined, folder: string, type?: string) => {
      if (!ref || seen.has(ref)) return;
      seen.add(ref);
      const m = ref.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
      const ext = m ? m[1].toLowerCase() : (type === "video" ? "mp4" : "jpg");
      items.push({ ref, ext, folder });
    };
    for (const l of data.logs) {
      if (l.note_image_url) push(l.note_image_url, "production-notes");
    }
    for (const r of data.reports) {
      for (const m of r.media ?? []) push(m.url, "qc", m.type);
      for (const it of r.qc_report_items ?? []) for (const m of it.media ?? []) push(m.url, "qc", m.type);
    }
    for (const r of data.packing_reports) {
      for (const m of r.media ?? []) push(m.url, "packing", m.type);
      for (const it of r.packing_report_items ?? []) for (const m of it.media ?? []) push(m.url, "packing", m.type);
    }
    if (items.length === 0) {
      toast.info("ไม่มีไฟล์สื่อสำหรับ Job นี้");
      return;
    }
    setDownloading(true);
    setDownloadProgress({ done: 0, total: items.length });
    try {
      const downloadable = items.map((it, i) => ({
        url: signedMap[it.ref] ?? it.ref,
        filename: `${it.folder}/${String(i + 1).padStart(3, "0")}.${it.ext}`,
      }));
      await downloadMediaAsZip(data.job_id, downloadable, (d, t) => setDownloadProgress({ done: d, total: t }));
      toast.success(`ดาวน์โหลดสำเร็จ ${items.length} ไฟล์`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloading(false);
    }
  }, [data, signedMap]);

  const handleScanned = useCallback((text: string) => {
    const v = text.trim();
    setInput(v);
    setScannerStream(null);
    void runSearch(v);
  }, [runSearch]);

  const detail = data && data.found ? data : null;

  const qcBadge = useMemo(() => {
    if (!detail) return null;
    const { pass, fail, unknown, total } = detail.summary.qc;
    return { pass, fail, unknown, total };
  }, [detail]);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <Toaster richColors closeButton position="top-center" />

      <div className="mb-4">
        <h2 className="text-xl font-bold sm:text-2xl">ค้นหา Job ด่วน</h2>
        <p className="text-sm text-muted-foreground">ใส่เลข Job ID หรือสแกน QR เพื่อดูข้อมูลทุกอย่างของ Job ในหน้าเดียว</p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-3 sm:p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); void runSearch(input); }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ใส่เลข Job ID เช่น JOB-12345"
              className="h-11 flex-1 text-base"
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="h-11 gap-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                ค้นหา
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-11 gap-1"
                onClick={async () => {
                  const result = await acquireCameraStream("environment");
                  if ("errorInfo" in result) {
                    toast.error(result.errorInfo.hint ? `${result.errorInfo.message} — ${result.errorInfo.hint}` : result.errorInfo.message);
                    return;
                  }
                  setScannerStream(result.stream);
                }}
              >
                <ScanLine className="h-4 w-4" /> สแกน QR
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> กำลังค้นหา...
        </div>
      )}

      {!loading && searched && !detail && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <HelpCircle className="mx-auto mb-2 h-10 w-10 opacity-50" />
            ไม่พบข้อมูลของ Job นี้
          </CardContent>
        </Card>
      )}

      {!loading && detail && (
        <div className="space-y-6">
          {/* Summary card */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" /> Job ID
                  </div>
                  <CardTitle className="text-3xl font-bold text-primary sm:text-4xl">{detail.job_id}</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {qcBadge && qcBadge.total > 0 && (
                    <>
                      {qcBadge.pass > 0 && (
                        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> ผ่าน {qcBadge.pass}</Badge>
                      )}
                      {qcBadge.fail > 0 && (
                        <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> ไม่ผ่าน {qcBadge.fail}</Badge>
                      )}
                      {qcBadge.unknown > 0 && (
                        <Badge variant="secondary" className="gap-1"><HelpCircle className="h-3 w-3" /> ไม่ระบุ {qcBadge.unknown}</Badge>
                      )}
                    </>
                  )}
                  <Button size="sm" variant="outline" className="gap-1" disabled={downloading} onClick={downloadAllMedia}>
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {downloading ? `${downloadProgress.done}/${downloadProgress.total}` : "ดาวน์โหลดสื่อทั้งหมด (ZIP)"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon={Users} label="พนักงาน" value={detail.summary.workers} />
                <Stat icon={ListChecks} label="ขั้นตอนที่เสร็จ" value={detail.summary.steps_done} sub={`${detail.summary.unique_steps} ขั้นตอน`} />
                <Stat icon={ClipboardCheck} label="รายงาน QC" value={detail.summary.qc.total} />
                <Stat icon={Tag} label="หมวดหลัก" value={detail.summary.top_category ?? "-"} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <PlayCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">เริ่มแรกสุด:</span>
                  <span className="font-medium">{fmtDateTime(detail.summary.first_start)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <StopCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-muted-foreground">เสร็จล่าสุด:</span>
                  <span className="font-medium">{fmtDateTime(detail.summary.last_finish)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ไทม์ไลน์การผลิต ({detail.logs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีบันทึกการผลิตของ Job นี้</p>
              ) : (
                <ol className="relative space-y-3 border-l border-border pl-4">
                  {detail.logs.map((l) => {
                    const a = actionMeta(l.action);
                    return (
                      <li key={l.id} className="relative">
                        <span className={`absolute -left-[22px] top-1 inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background ${a.cls}`}>
                          <a.Icon className="h-3 w-3" />
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${a.cls}`}>{a.label}</span>
                          <span className="text-sm font-medium">{l.steps?.step_name ?? "-"}</span>
                          {l.categories?.name && <Badge variant="outline" className="text-[10px]">{l.categories.name}</Badge>}
                          <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          {l.employees?.avatar_url ? (
                            <img src={l.employees.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                          ) : (
                            <div className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                              {l.employees?.name?.[0] ?? "?"}
                            </div>
                          )}
                          <span className="font-medium">{l.employees?.name ?? "ไม่ระบุ"}</span>
                          {l.employees?.emp_code && (
                            <span className="text-xs text-muted-foreground">#{l.employees.emp_code}</span>
                          )}
                        </div>
                        {l.note && (
                          <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm">{l.note}</p>
                        )}
                        {l.note_image_url && (
                          <button
                            type="button"
                            onClick={() => setLightbox({ url: l.note_image_url!, type: "image" })}
                            className="mt-1 inline-block overflow-hidden rounded-md border"
                          >
                            <img src={l.note_image_url} alt="note" className="h-24 w-24 object-cover" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* QC reports */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">รายงาน QC ทั้งหมด ({detail.reports.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีรายงาน QC ของ Job นี้</p>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {detail.reports.map((r) => {
                    const pass = r.overall_result === "pass";
                    const fail = r.overall_result === "fail";
                    return (
                      <AccordionItem key={r.id} value={r.id} className="rounded-lg border bg-card">
                        <AccordionTrigger className="px-3 py-3 hover:no-underline">
                          <div className="flex flex-1 flex-wrap items-center gap-2 pr-2">
                            <span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                            <span className="text-sm font-semibold">ผู้ตรวจ: {r.qc_employees?.name ?? "-"}</span>
                            {r.qc_employees?.emp_code && (
                              <span className="text-xs text-muted-foreground">#{r.qc_employees.emp_code}</span>
                            )}
                            {r.steps?.step_name && (
                              <Badge variant="outline" className="text-[10px]">{r.steps.step_name}</Badge>
                            )}
                            <span className="ml-auto flex items-center gap-1.5">
                              {pass && <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" />ผ่าน</Badge>}
                              {fail && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />ไม่ผ่าน</Badge>}
                              {!pass && !fail && <Badge variant="secondary">ไม่ระบุ</Badge>}
                              {r.status === "resolved" && <Badge variant="outline">แก้ไขแล้ว</Badge>}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3">
                          <div className="space-y-3">
                            {(r.qc_report_items ?? []).length > 0 && (
                              <ul className="space-y-2">
                                {(r.qc_report_items ?? [])
                                  .slice()
                                  .sort((a, b) => a.item_order - b.item_order)
                                  .map((it) => {
                                    const isMotor = it.is_passed && it.result_tag === "motor";
                                    return (
                                    <li key={it.id} className={`rounded-md border p-2 ${isMotor ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20" : it.is_passed ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50/40 dark:bg-rose-950/20"}`}>
                                      <div className="flex items-start gap-2">
                                        {isMotor
                                          ? <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                          : it.is_passed
                                            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                            : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                                        <div className="flex-1">
                                          <p className="text-sm font-medium">
                                            {it.item_text_snapshot}
                                            {isMotor && <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">มอเตอร์</span>}
                                          </p>
                                          {it.remark && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{it.remark}</p>}
                                          {it.media && it.media.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                              {it.media.map((m, i) => <MediaThumb key={i} m={m} signedSrc={signedSrc} onOpen={setLightbox} />)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                    );
                                  })}
                              </ul>
                            )}
                            {r.summary && (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground">สรุปภาพรวม</div>
                                <p className="text-sm whitespace-pre-wrap">{r.summary}</p>
                              </div>
                            )}
                            {r.note && (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground">หมายเหตุ</div>
                                <p className="text-sm whitespace-pre-wrap">{r.note}</p>
                              </div>
                            )}
                            {r.media && r.media.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground">สื่อภาพรวม</div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {r.media.map((m, i) => <MediaThumb key={i} m={m} signedSrc={signedSrc} onOpen={setLightbox} />)}
                                </div>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Packing reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> รายงานแพ็คของ ({detail.packing_reports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.packing_reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีรายงานแพ็คของ Job นี้</p>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {detail.packing_reports.map((r) => {
                    const pass = r.overall_result === "pass";
                    const fail = r.overall_result === "fail";
                    const items = r.packing_report_items ?? [];
                    return (
                      <AccordionItem key={r.id} value={r.id} className="rounded-lg border bg-card">
                        <AccordionTrigger className="px-3 py-3 hover:no-underline">
                          <div className="flex flex-1 flex-wrap items-center gap-2 pr-2">
                            <span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                            <span className="text-sm font-semibold">ผู้แพ็ค: {r.packing_employees?.name ?? "-"}</span>
                            {r.packing_employees?.emp_code && (
                              <span className="text-xs text-muted-foreground">#{r.packing_employees.emp_code}</span>
                            )}
                            {r.steps?.step_name && <Badge variant="outline" className="text-[10px]">{r.steps.step_name}</Badge>}
                            <span className="ml-auto flex items-center gap-1.5">
                              {pass && <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" />ผ่าน</Badge>}
                              {fail && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />ไม่ผ่าน</Badge>}
                              {!pass && !fail && <Badge variant="secondary">ไม่ระบุ</Badge>}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3">
                          <div className="space-y-3">
                            {items.length > 0 && (
                              <ul className="space-y-2">
                                {items.slice().sort((a, b) => a.item_order - b.item_order).map((it) => (
                                  <li key={it.id} className={`rounded-md border p-2 ${it.is_passed ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50/40 dark:bg-rose-950/20"}`}>
                                    <div className="flex items-start gap-2">
                                      {it.is_passed
                                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                        : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{it.item_text_snapshot}</p>
                                        {it.remark && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{it.remark}</p>}
                                        {it.media && it.media.length > 0 && (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {it.media.map((m, i) => <MediaThumb key={i} m={m} signedSrc={signedSrc} onOpen={setLightbox} />)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {r.summary && (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground">สรุปภาพรวม</div>
                                <p className="text-sm whitespace-pre-wrap">{r.summary}</p>
                              </div>
                            )}
                            {r.note && (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground">หมายเหตุ</div>
                                <p className="text-sm whitespace-pre-wrap">{r.note}</p>
                              </div>
                            )}
                            {r.media && r.media.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground">สื่อภาพรวม</div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {r.media.map((m, i) => <MediaThumb key={i} m={m} signedSrc={signedSrc} onOpen={setLightbox} />)}
                                </div>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(v) => { if (!v) setLightbox(null); }}>
        <DialogContent className="max-w-4xl p-2">
          {lightbox?.type === "video" ? (
            <video src={signedSrc(lightbox.url)} controls className="max-h-[80vh] w-full rounded" />
          ) : lightbox ? (
            <img src={signedSrc(lightbox.url)} alt="" className="max-h-[80vh] w-full rounded object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={(v) => { if (!v) setScannerStream(null); }}
        onScanned={handleScanned}
        initialStream={scannerStream}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MediaThumb({ m, signedSrc, onOpen }: { m: MediaItem; signedSrc: (r: string) => string; onOpen: (m: MediaItem) => void }) {
  return (
    <button type="button" onClick={() => onOpen(m)} className="group relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
      {m.type === "video" ? (
        <>
          <video src={signedSrc(m.url)} className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/30 text-white">
            <VideoIcon className="h-4 w-4" />
          </span>
        </>
      ) : (
        <>
          <img src={signedSrc(m.url)} alt="" className="h-full w-full object-cover" />
          <span className="absolute right-0.5 top-0.5 rounded bg-black/50 p-0.5 text-white opacity-0 group-hover:opacity-100">
            <ImageIcon className="h-3 w-3" />
          </span>
        </>
      )}
    </button>
  );
}
