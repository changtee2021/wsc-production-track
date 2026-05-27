import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { warnIfMovFiles } from "@/components/MediaLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  ScanLine, QrCode, ArrowLeft, RotateCcw, Check, Loader2, Camera, Video as VideoIcon,
  X, Send, Package, User, Layers, ListChecks, LogOut, CheckCircle2, XCircle,
} from "lucide-react";
import {
  verifyPackingPassword,
  packingFetchJobLogs,
  packingFetchChecklist,
  packingSubmitReport,
  packingUploadMedia,
  packingListEmployees,
} from "@/lib/packing.functions";
import {
  isPackingSession, setPackingToken, getPackingToken, clearPackingSession,
} from "@/lib/packing-session";
import { compressMedia } from "@/lib/media-compress";

const packingSearch = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/packing")({
  validateSearch: zodValidator(packingSearch),
  head: () => ({
    meta: [
      { title: "แพ็คของ — WSC ProductionTrack" },
      { name: "description", content: "หน้าแพ็คของพร้อมเช็คลิสต์และแนบรูป/วิดีโอเป็นหลักฐาน" },
    ],
  }),
  component: PackingPage,
});

function PackingPage() {
  const verify = useServerFn(verifyPackingPassword);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    if (isPackingSession()) { setAuthed(true); return; }
    // ไม่ต้องใส่รหัส — ออก token ให้อัตโนมัติ
    verify({ data: { password: "" } })
      .then((res) => {
        if (res.ok) { setPackingToken(res.token); setAuthed(true); }
        else toast.error("เข้าสู่ระบบแพ็คของไม่สำเร็จ");
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "เข้าสู่ระบบแพ็คของไม่สำเร็จ"));
  }, [verify]);
  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Toaster richColors position="top-center" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <PackingWorkbench onLogout={() => setAuthed(false)} />;
}


interface PackingEmployee { id: string; name: string; emp_code: string | null }
interface JobLog {
  id: string; job_id: string; created_at: string; note: string | null;
  employee_id: string | null; step_id: string | null; category_id: string | null;
  employees: { name: string; emp_code: string | null } | null;
  steps: { step_name: string } | null;
  categories: { name: string } | null;
}
interface ChecklistItem { id: string; item_text: string; item_order: number }
interface MediaItem { url: string; previewUrl?: string; type: "image" | "video" }
interface CategoryRow { id: string; name: string }
type ItemState = { is_passed: boolean | null; remark: string; media: MediaItem[] };

const EMPTY: ItemState = { is_passed: null, remark: "", media: [] };
const IMG_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const VID_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-m4v": "m4v" };
const MAX_IMG = 10 * 1024 * 1024;
const MAX_VID = 50 * 1024 * 1024;

function PackingWorkbench({ onLogout }: { onLogout: () => void }) {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/packing" });
  const [manualJob, setManualJob] = useState("");
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);

  const [emps, setEmps] = useState<PackingEmployee[]>([]);
  const [empId, setEmpId] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryAuto, setCategoryAuto] = useState(false);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [note, setNote] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);

  const fetchLogs = useServerFn(packingFetchJobLogs);
  const fetchChecklist = useServerFn(packingFetchChecklist);
  const uploadMedia = useServerFn(packingUploadMedia);
  const listEmps = useServerFn(packingListEmployees);
  const submitReport = useServerFn(packingSubmitReport);

  useEffect(() => {
    (async () => {
      const token = getPackingToken();
      const tasks: Promise<unknown>[] = [
        (async () => {
          const cat = await supabase.from("categories").select("id, name").eq("active", true).order("name");
          if (cat.data) setCategories(cat.data);
        })(),
      ];
      if (token) {
        tasks.push(
          listEmps({ data: { token } }).then((r) => setEmps(r.rows as PackingEmployee[])).catch(() => {}),
        );
      }
      await Promise.all(tasks);
    })();
  }, [listEmps]);

  useEffect(() => {
    if (!job_id) { setLogs([]); setCategoryAuto(false); return; }
    const token = getPackingToken();
    if (!token) return;
    setLoadingLogs(true);
    fetchLogs({ data: { token, job_id } })
      .then((res) => {
        const rows = (res.rows ?? []) as unknown as JobLog[];
        setLogs(rows);
        const withCat = [...rows].reverse().find((l) => l.category_id);
        if (withCat?.category_id) { setCategoryId(withCat.category_id); setCategoryAuto(true); }
        else setCategoryAuto(false);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoadingLogs(false));
  }, [job_id, fetchLogs]);

  useEffect(() => {
    if (!categoryId) { setChecklist([]); setItemStates({}); return; }
    const token = getPackingToken();
    if (!token) return;
    setLoadingChecklist(true);
    fetchChecklist({ data: { token, category_id: categoryId } })
      .then((res) => {
        const rows = (res.rows ?? []) as ChecklistItem[];
        setChecklist(rows);
        setItemStates((prev) => {
          const next: Record<string, ItemState> = {};
          for (const r of rows) next[r.id] = prev[r.id] ?? EMPTY;
          return next;
        });
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "โหลด checklist ไม่สำเร็จ"))
      .finally(() => setLoadingChecklist(false));
  }, [categoryId, fetchChecklist]);

  const applyManualJob = () => {
    const t = manualJob.trim();
    if (!t) return;
    navigate({ search: { job_id: t } });
  };

  const handleScanned = (text: string) => {
    let v = text;
    try { const url = new URL(text); const f = url.searchParams.get("job_id"); if (f) v = f; } catch {}
    setManualJob(v);
    navigate({ search: { job_id: v } });
    toast.success("สแกนแล้ว: " + v);
  };

  const uploadFiles = async (files: FileList, kind: "image" | "video", target: "overall" | string) => {
    const token = getPackingToken();
    if (!token) { onLogout(); return; }
    setUploading(true);
    try {
      const items: MediaItem[] = [];
      for (const original of Array.from(files)) {
        const map = kind === "image" ? IMG_EXT : VID_EXT;
        if (!map[original.type]) { toast.error(kind === "image" ? "รองรับเฉพาะ JPG, PNG, WEBP, GIF" : "รองรับเฉพาะ MP4, WEBM, MOV, M4V"); continue; }
        const f = await compressMedia(original, kind);
        const max = kind === "image" ? MAX_IMG : MAX_VID;
        if (f.size > max) { toast.error(`ไฟล์ใหญ่เกิน ${Math.round(max / (1024 * 1024))}MB`); continue; }
        const buf = await f.arrayBuffer();
        let binary = "";
        const u8 = new Uint8Array(buf);
        const CH = 0x8000;
        for (let i = 0; i < u8.length; i += CH) binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CH)));
        const dataBase64 = btoa(binary);
        try {
          const res = await uploadMedia({ data: { token, kind, dataBase64 } });
          items.push({ url: res.path, previewUrl: res.previewUrl, type: kind });
        } catch (e) { toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ"); continue; }
      }
      if (items.length) {
        if (target === "overall") setMedia((prev) => [...prev, ...items]);
        else setItemStates((prev) => ({
          ...prev,
          [target]: { ...(prev[target] ?? EMPTY), media: [...(prev[target]?.media ?? []), ...items] },
        }));
      }
    } finally {
      setUploading(false);
      if (imgInput.current) imgInput.current.value = "";
      if (vidInput.current) vidInput.current.value = "";
    }
  };

  const setItemPass = (id: string, pass: boolean) => {
    setItemStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY), is_passed: pass } }));
  };
  const setItemRemark = (id: string, remark: string) => {
    setItemStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY), remark } }));
  };
  const removeItemMedia = (id: string, i: number) => {
    setItemStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY), media: (prev[id]?.media ?? []).filter((_, j) => j !== i) },
    }));
  };

  const { passCount, failCount, answeredCount, total } = useMemo(() => {
    let p = 0, f = 0, a = 0;
    for (const it of checklist) {
      const s = itemStates[it.id];
      if (s?.is_passed === true) { p++; a++; }
      else if (s?.is_passed === false) { f++; a++; }
    }
    return { passCount: p, failCount: f, answeredCount: a, total: checklist.length };
  }, [checklist, itemStates]);

  const submit = async () => {
    if (!job_id) return toast.error("ยังไม่ได้กรอก Job");
    if (!empId) return toast.error("กรุณาเลือกพนักงานแพ็คของ");
    if (checklist.length === 0) return toast.error("ไม่มีรายการ checklist สำหรับหมวดนี้");
    if (answeredCount < total) return toast.error(`ยังตรวจไม่ครบ (${answeredCount}/${total})`);
    for (let idx = 0; idx < checklist.length; idx++) {
      const it = checklist[idx];
      const s = itemStates[it.id];
      if (s?.is_passed === false) {
        if (!s.remark.trim()) return toast.error(`ข้อ ${idx + 1}: กรุณากรอกหมายเหตุ`);
        if (!s.media || s.media.length === 0)
          return toast.error(`ข้อ ${idx + 1}: ต้องแนบรูป/วิดีโออย่างน้อย 1 รายการ`);
      }
    }
    const token = getPackingToken();
    if (!token) return onLogout();
    const overall: "pass" | "fail" = failCount > 0 ? "fail" : "pass";
    const repLog = [...logs].reverse().find((l) => l.category_id === categoryId) ?? logs[logs.length - 1];

    setSubmitting(true);
    try {
      await submitReport({
        data: {
          token, job_id, packing_employee_id: empId,
          production_log_id: repLog?.id ?? null,
          step_id: repLog?.step_id ?? null,
          category_id: categoryId || null,
          employee_id: repLog?.employee_id ?? null,
          note: note.trim() || null,
          media: media.map((m) => ({ url: m.url, type: m.type })),
          overall_result: overall,
          items: checklist.map((it) => {
            const s = itemStates[it.id];
            return {
              checklist_id: it.id,
              item_text_snapshot: it.item_text,
              item_order: it.item_order,
              is_passed: s?.is_passed === true,
              remark: s?.remark?.trim() || null,
              media: (s?.media ?? []).map((m) => ({ url: m.url, type: m.type })),
            };
          }),
        },
      });
      toast.success(overall === "pass" ? `ส่งรายงานสำเร็จ — ผ่าน ${passCount}/${total}` : `ส่งรายงานสำเร็จ — ไม่ผ่าน ${failCount} ข้อ`);
      setNote(""); setMedia([]); setItemStates({}); setManualJob("");
      navigate({ search: { job_id: "" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งรายงานไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <Toaster richColors position="top-center" />
      <AppHeader>
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">หน้าแรก</span>
          </Button>
        </Link>
        <Button variant="secondary" size="sm" className="gap-1" onClick={() => { clearPackingSession(); onLogout(); }}>
          <LogOut className="h-4 w-4" /><span className="hidden sm:inline">ออกจากระบบ</span>
        </Button>
      </AppHeader>

      <main className="mx-auto max-w-md px-4 py-6 pb-32">
        <h1 className="sr-only">แพ็คของ</h1>

        <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] bg-gradient-to-br from-card to-secondary/5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <QrCode className="h-4 w-4" /> Job ID
          </div>
          {job_id ? <div className="mt-1 text-3xl font-bold text-primary">{job_id}</div>
                  : <p className="mt-2 text-sm text-destructive">ยังไม่ได้สแกน / กรอก Job</p>}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={async () => {
                const result = await acquireCameraStream("environment");
                if ("errorInfo" in result) {
                  toast.error(result.errorInfo.hint ? `${result.errorInfo.message} — ${result.errorInfo.hint}` : result.errorInfo.message);
                  return;
                }
                setScannerStream(result.stream);
              }}
              className="h-11 flex-1 gap-1 bg-secondary hover:bg-secondary/90 shadow-md shadow-secondary/30"
            >
              <ScanLine className="h-4 w-4" /> สแกน QR
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={manualJob} onChange={(e) => setManualJob(e.target.value)} placeholder="กรอก Job ID" className="h-11"
              onKeyDown={(e) => e.key === "Enter" && applyManualJob()} />
            {job_id
              ? <Button onClick={() => { setManualJob(""); navigate({ search: { job_id: "" } }); }} variant="outline" className="h-11 gap-1"><RotateCcw className="h-4 w-4" /></Button>
              : <Button onClick={applyManualJob} variant="outline" className="h-11 gap-1"><Check className="h-4 w-4" /></Button>}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-secondary" /> พนักงานแพ็คของ
          </h2>
          <Select value={empId} onValueChange={setEmpId}>
            <SelectTrigger className="h-14 w-full rounded-2xl text-base">
              <SelectValue placeholder="เลือกพนักงานแพ็คของ" />
            </SelectTrigger>
            <SelectContent>
              {emps.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">ยังไม่มีพนักงาน — ให้แอดมินเพิ่มในหน้าจัดการ</div>}
              {emps.map((e) => (
                <SelectItem key={e.id} value={e.id} className="py-2">
                  <div className="flex flex-col text-left">
                    <span className="text-base font-semibold leading-tight">{e.name}</span>
                    {e.emp_code && <span className="font-mono text-xs text-muted-foreground">{e.emp_code}</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>


        {job_id && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-secondary" /> หมวดสินค้า
              {categoryAuto && <span className="ml-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-secondary">อัตโนมัติจากประวัติงาน</span>}
            </h2>
            <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setCategoryAuto(false); }}>
              <SelectTrigger className="h-12 w-full rounded-2xl text-base"><SelectValue placeholder="เลือกหมวดสินค้า" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </section>
        )}

        {job_id && categoryId && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListChecks className="h-4 w-4 text-secondary" /> รายการตรวจสอบ
              {total > 0 && <span className="ml-auto text-xs text-muted-foreground">ตรวจแล้ว {answeredCount}/{total}</span>}
            </h2>
            {loadingChecklist && <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...</div>}
            {!loadingChecklist && checklist.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                ไม่มีรายการตรวจสอบสำหรับหมวดนี้ — แจ้งแอดมินเพิ่มใน "จัดการ → Checklist แพ็คของ"
              </div>
            )}
            <div className="space-y-3">
              {checklist.map((it, idx) => {
                const s = itemStates[it.id] ?? EMPTY;
                return (
                  <PackingRow key={it.id} index={idx + 1} item={it} state={s} uploading={uploading}
                    onPass={(v) => setItemPass(it.id, v)}
                    onRemark={(v) => setItemRemark(it.id, v)}
                    onUpload={(files, kind) => uploadFiles(files, kind, it.id)}
                    onRemoveMedia={(i) => removeItemMedia(it.id, i)} />
                );
              })}
            </div>
          </section>
        )}

        {job_id && categoryId && checklist.length > 0 && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">หมายเหตุภาพรวม / หลักฐานรวม</h2>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุภาพรวม (ถ้ามี)..." rows={3} maxLength={2000}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" />
            <input ref={imgInput} type="file" accept="image/*" multiple capture="environment" className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files, "image", "overall")} />
            <input ref={vidInput} type="file" accept="video/*" capture="environment" className="hidden"
              onChange={(e) => { if (e.target.files) { warnIfMovFiles(e.target.files); uploadFiles(e.target.files, "video", "overall"); } }} />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="gap-1" onClick={() => imgInput.current?.click()} disabled={uploading}><Camera className="h-4 w-4" /> เพิ่มรูป</Button>
              <Button type="button" variant="outline" className="gap-1" onClick={() => vidInput.current?.click()} disabled={uploading}><VideoIcon className="h-4 w-4" /> เพิ่มวิดีโอ</Button>
            </div>
            {uploading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> กำลังอัปโหลด...</div>}
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                    {m.type === "image" ? <img src={m.previewUrl ?? m.url} alt="" className="h-full w-full object-cover" /> : <video src={m.previewUrl ?? m.url} className="h-full w-full object-cover" muted />}
                    <button type="button" onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))} aria-label="ลบ" className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {job_id && categoryId && checklist.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <span className="font-semibold">สรุป:</span> <span className="text-success">ผ่าน {passCount}</span> / <span className="text-destructive">ไม่ผ่าน {failCount}</span> / <span className="text-muted-foreground">ทั้งหมด {total}</span>
            </div>
            <Button onClick={submit} disabled={submitting || uploading || answeredCount < total} className="h-14 w-full gap-2 text-base font-semibold">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} ส่งรายงานแพ็คของ
            </Button>
          </section>
        )}
      </main>

      <QrScannerDialog open={scannerStream !== null} onOpenChange={(v) => { if (!v) setScannerStream(null); }} onScanned={handleScanned} initialStream={scannerStream} />
    </div>
  );
}

function PackingRow({ index, item, state, uploading, onPass, onRemark, onUpload, onRemoveMedia }: {
  index: number; item: ChecklistItem; state: ItemState; uploading: boolean;
  onPass: (v: boolean) => void; onRemark: (v: string) => void;
  onUpload: (files: FileList, kind: "image" | "video") => void; onRemoveMedia: (i: number) => void;
}) {
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const failed = state.is_passed === false;
  const passed = state.is_passed === true;

  return (
    <div className={`rounded-2xl border-2 bg-card p-3 transition-colors ${passed ? "border-success/40 bg-success/5" : failed ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">{index}</span>
        <p className="flex-1 text-sm font-medium leading-snug">{item.item_text}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" onClick={() => onPass(true)} className={`h-11 gap-1 text-sm font-semibold ${passed ? "bg-success text-success-foreground hover:bg-success/90" : "bg-success/15 text-success hover:bg-success/25"}`}>
          <CheckCircle2 className="h-4 w-4" /> ผ่าน
        </Button>
        <Button type="button" onClick={() => onPass(false)} className={`h-11 gap-1 text-sm font-semibold ${failed ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-destructive/15 text-destructive hover:bg-destructive/25"}`}>
          <XCircle className="h-4 w-4" /> ไม่ผ่าน
        </Button>
      </div>
      {failed && (
        <div className="mt-3 space-y-2">
          <textarea value={state.remark} onChange={(e) => onRemark(e.target.value)} placeholder="หมายเหตุ: ไม่ผ่านเพราะ... (จำเป็น)" rows={2} maxLength={2000}
            className="w-full rounded-lg border border-destructive/40 bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive" />
          <input ref={imgRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
            onChange={(e) => { if (e.target.files) onUpload(e.target.files, "image"); if (imgRef.current) imgRef.current.value = ""; }} />
          <input ref={vidRef} type="file" accept="video/*" capture="environment" className="hidden"
            onChange={(e) => { if (e.target.files) { warnIfMovFiles(e.target.files); onUpload(e.target.files, "video"); } if (vidRef.current) vidRef.current.value = ""; }} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1" disabled={uploading} onClick={() => imgRef.current?.click()}><Camera className="h-4 w-4" /> รูป</Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" disabled={uploading} onClick={() => vidRef.current?.click()}><VideoIcon className="h-4 w-4" /> วิดีโอ</Button>
          </div>
          {state.media.length === 0 ? (
            <p className="text-xs font-medium text-destructive">* ต้องแนบรูป/วิดีโออย่างน้อย 1 รายการ</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {state.media.map((m, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                  {m.type === "image" ? <img src={m.previewUrl ?? m.url} alt="" className="h-full w-full object-cover" /> : <video src={m.previewUrl ?? m.url} className="h-full w-full object-cover" muted />}
                  <button type="button" onClick={() => onRemoveMedia(i)} aria-label="ลบ" className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 shadow"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
