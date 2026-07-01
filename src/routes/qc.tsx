import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
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
import { warnIfMovFiles } from "@/components/MediaLightbox";
import {
  MediaUploadStatusLine,
  type MediaUploadStatus,
} from "@/components/MediaUploadStatus";
import {
  ScanLine,
  QrCode,
  ArrowLeft,
  RotateCcw,
  Check,
  Loader2,
  Camera,
  Video as VideoIcon,
  X,
  Send,
  ClipboardCheck,
  User,
  Layers,
  ListChecks,
  LogOut,
  CheckCircle2,
  XCircle,
  Wrench,
} from "lucide-react";
import {
  verifyQcPassword,
  qcFetchJobLogs,
  qcFetchChecklist,
  qcSubmitReport,
  qcUploadMedia,
  qcCreateVideoUploadUrl,
  qcListEmployees,
} from "@/lib/features/qc.functions";
import { isQcSession, setQcToken, getQcToken, clearQcSession } from "@/lib/auth/qc-session";
import { compressMedia, canBrowserCompressVideo } from "@/lib/utils/media-compress";
import { uploadVideoViaSignedUrl } from "@/lib/utils/direct-video-upload";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, formatVideoMaxSizeError, normalizeVideoFile } from "@/lib/utils/media-limits";
import { clientAppPublicPath } from "@/lib/app-public-url";

const qcSearch = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/qc")({
  validateSearch: zodValidator(qcSearch),
  head: () => ({
    meta: [
      { title: "QC — WSC ProductionTrack" },
      {
        name: "description",
        content: "หน้าตรวจสอบคุณภาพงาน (QC) แบบ checklist พร้อมแนบรูปและวิดีโอเป็นหลักฐาน",
      },
      { property: "og:title", content: "QC — WSC ProductionTrack" },
      {
        property: "og:description",
        content:
          "ตรวจสอบคุณภาพงานแบบ checklist พร้อมแนบรูป/วิดีโอเป็นหลักฐาน บันทึกผลผ่าน–ไม่ผ่านแบบเรียลไทม์",
      },
      { property: "og:url", content: clientAppPublicPath("/qc") },
    ],
    links: [{ rel: "canonical", href: clientAppPublicPath("/qc") }],
  }),
  component: QcPage,
});

function QcPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(isQcSession());
  }, []);

  if (!authed) return <QcLogin onSuccess={() => setAuthed(true)} />;
  return <QcWorkbench onLogout={() => setAuthed(false)} />;
}

function QcLogin({ onSuccess }: { onSuccess: () => void }) {
  const verify = useServerFn(verifyQcPassword);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await verify({ data: { password } });
      if (res.ok) {
        setQcToken(res.token);
        toast.success("เข้าสู่ระบบ QC สำเร็จ");
        onSuccess();
      } else {
        toast.error(res.error || "เข้าสู่ระบบไม่สำเร็จ");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <AppHeader>
        <Link to="/">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">หน้าแรก</span>
          </Button>
        </Link>
      </AppHeader>
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-lg">
          <ClipboardCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">เข้าสู่ระบบ QC</h1>
        <p className="mt-1 text-sm text-muted-foreground">กรอกรหัสผ่านสำหรับพนักงาน QC</p>
        <form
          onSubmit={onSubmit}
          className="mt-6 w-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <Label htmlFor="qcpw" className="text-sm font-medium">
            รหัสผ่าน QC
          </Label>
          <Input
            id="qcpw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-12 text-base"
            autoFocus
            required
          />
          <Button
            type="submit"
            disabled={loading}
            className="mt-4 h-12 w-full text-base font-semibold"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </main>
    </div>
  );
}

interface QcEmployee {
  id: string;
  name: string;
  emp_code: string | null;
}

interface JobLog {
  id: string;
  job_id: string;
  created_at: string;
  note: string | null;
  employee_id: string | null;
  step_id: string | null;
  category_id: string | null;
  employees: { name: string; emp_code: string | null } | null;
  steps: { step_name: string } | null;
  categories: { name: string } | null;
}

interface ChecklistItem {
  id: string;
  item_text: string;
  item_order: number;
}

interface MediaItem {
  // `url` is the persisted storage reference (path inside qc-media bucket).
  url: string;
  // Short-lived signed URL used only for in-session preview before submit.
  previewUrl?: string;
  type: "image" | "video";
}

interface CategoryRow {
  id: string;
  name: string;
}

type ItemTag = "motor" | null;
type ItemState = {
  is_passed: boolean | null;
  tag: ItemTag;
  remark: string;
  media: MediaItem[];
};

const EMPTY_ITEM_STATE: ItemState = { is_passed: null, tag: null, remark: "", media: [] };

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function QcWorkbench({ onLogout }: { onLogout: () => void }) {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/qc" });
  const [manualJob, setManualJob] = useState("");
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);
  const scannerOpen = scannerStream !== null;

  const [qcEmployees, setQcEmployees] = useState<QcEmployee[]>([]);
  const [qcEmployeeId, setQcEmployeeId] = useState("");

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryAutoSet, setCategoryAutoSet] = useState(false);

  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});

  const [note, setNote] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<MediaUploadStatus>({ phase: "idle" });
  const [submitting, setSubmitting] = useState(false);

  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);

  const fetchLogs = useServerFn(qcFetchJobLogs);
  const fetchChecklist = useServerFn(qcFetchChecklist);
  const uploadMedia = useServerFn(qcUploadMedia);
  const prepareVideoUpload = useServerFn(qcCreateVideoUploadUrl);
  const listQcEmployees = useServerFn(qcListEmployees);
  const submitReport = useServerFn(qcSubmitReport);

  // Load QC employees (token-gated) and categories (public)
  useEffect(() => {
    (async () => {
      const token = getQcToken();
      const tasks: Promise<unknown>[] = [
        (async () => {
          const cat = await supabase
            .from("categories")
            .select("id, name")
            .eq("active", true)
            .order("name");
          if (cat.data) setCategories(cat.data);
        })(),
      ];
      if (token) {
        tasks.push(
          listQcEmployees({ data: { token } })
            .then((res) => setQcEmployees(res.rows as QcEmployee[]))
            .catch(() => {}),
        );
      }
      await Promise.all(tasks);
    })();
  }, [listQcEmployees]);

  // Load job logs when job_id changes
  useEffect(() => {
    if (!job_id) {
      setLogs([]);
      setCategoryAutoSet(false);
      return;
    }
    const token = getQcToken();
    if (!token) return;
    setLoadingLogs(true);
    fetchLogs({ data: { token, job_id } })
      .then((res) => {
        const rows = (res.rows ?? []) as unknown as JobLog[];
        setLogs(rows);
        // Auto-pick category from latest log that has one
        const withCat = [...rows].reverse().find((l) => l.category_id);
        if (withCat?.category_id) {
          setCategoryId(withCat.category_id);
          setCategoryAutoSet(true);
        } else {
          setCategoryAutoSet(false);
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoadingLogs(false));
  }, [job_id, fetchLogs]);

  // Load checklist when category changes
  useEffect(() => {
    if (!categoryId) {
      setChecklist([]);
      setItemStates({});
      return;
    }
    const token = getQcToken();
    if (!token) return;
    setLoadingChecklist(true);
    fetchChecklist({ data: { token, category_id: categoryId } })
      .then((res) => {
        const rows = (res.rows ?? []) as ChecklistItem[];
        setChecklist(rows);
        // Initialize empty states; preserve any existing entries
        setItemStates((prev) => {
          const next: Record<string, ItemState> = {};
          for (const r of rows) {
            next[r.id] = prev[r.id] ?? EMPTY_ITEM_STATE;
          }
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
    try {
      const url = new URL(text);
      const fromQ = url.searchParams.get("job_id");
      if (fromQ) v = fromQ;
    } catch {}
    setManualJob(v);
    navigate({ search: { job_id: v } });
    toast.success("สแกนแล้ว: " + v);
  };

  // Generic media uploader. target = "overall" or checklist item id
  const uploadFiles = async (
    files: FileList,
    kind: "image" | "video",
    target: "overall" | string,
  ) => {
    const token = getQcToken();
    if (!token) {
      onLogout();
      return;
    }
    setUploading(true);
    setUploadStatus(
      kind === "video" && canBrowserCompressVideo()
        ? { phase: "compressing", percent: 0 }
        : { phase: "uploading" },
    );
    try {
      const items: MediaItem[] = [];
      for (const original of Array.from(files)) {
        let file = original;
        if (kind === "image") {
          if (!IMAGE_EXT_BY_MIME[original.type]) {
            toast.error("รองรับเฉพาะ JPG, PNG, WEBP, GIF");
            continue;
          }
        } else {
          const normalized = normalizeVideoFile(original);
          if (!normalized) {
            toast.error("รองรับเฉพาะ MP4, WEBM, MOV, M4V");
            continue;
          }
          file = normalized;
          if (file.size > MAX_VIDEO_BYTES) {
            toast.error(formatVideoMaxSizeError());
            continue;
          }
        }

        let f: File;
        try {
          f = await compressMedia(file, kind, {
            onProgress:
              kind === "video"
                ? (percent) => setUploadStatus({ phase: "compressing", percent })
                : undefined,
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "บีบอัดวิดีโอไม่สำเร็จ");
          continue;
        }

        const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
        if (f.size > max) {
          toast.error(kind === "video" ? formatVideoMaxSizeError() : `ไฟล์ใหญ่เกิน ${Math.round(max / (1024 * 1024))}MB`);
          continue;
        }

        setUploadStatus({ phase: "uploading" });
        try {
          if (kind === "video") {
            const res = await uploadVideoViaSignedUrl({
              bucket: "qc-media",
              file: f,
              deptToken: token,
              prepareUpload: prepareVideoUpload,
            });
            items.push({ url: res.path, previewUrl: res.previewUrl, type: kind });
            continue;
          }
          // Images: small enough for base64 via server function (with compression).
          const buf = await f.arrayBuffer();
          let binary = "";
          const u8 = new Uint8Array(buf);
          const CHUNK = 0x8000;
          for (let i = 0; i < u8.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
          }
          const dataBase64 = btoa(binary);
          const res = await uploadMedia({
            data: { token, kind, dataBase64 },
          });
          items.push({ url: res.path, previewUrl: res.previewUrl, type: kind });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
          continue;
        }
      }
      if (items.length) {
        if (target === "overall") {
          setMedia((prev) => [...prev, ...items]);
        } else {
          setItemStates((prev) => ({
            ...prev,
            [target]: {
              ...(prev[target] ?? EMPTY_ITEM_STATE),
              media: [...(prev[target]?.media ?? []), ...items],
            },
          }));
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      setUploadStatus({ phase: "idle" });
      if (imgInput.current) imgInput.current.value = "";
      if (vidInput.current) vidInput.current.value = "";
    }
  };

  const setItemPass = (id: string, pass: boolean) => {
    setItemStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_ITEM_STATE), is_passed: pass, tag: null },
    }));
  };

  const setItemMotor = (id: string) => {
    setItemStates((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? EMPTY_ITEM_STATE),
        is_passed: true,
        tag: "motor",
        remark: "",
        media: [],
      },
    }));
  };

  const setItemRemark = (id: string, remark: string) => {
    setItemStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_ITEM_STATE), remark },
    }));
  };

  const removeItemMedia = (id: string, index: number) => {
    setItemStates((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? EMPTY_ITEM_STATE),
        media: (prev[id]?.media ?? []).filter((_, i) => i !== index),
      },
    }));
  };

  const { passCount, failCount, motorCount, answeredCount, total } = useMemo(() => {
    let p = 0,
      f = 0,
      m = 0,
      a = 0;
    for (const it of checklist) {
      const s = itemStates[it.id];
      if (s?.is_passed === true) {
        p++;
        a++;
        if (s.tag === "motor") m++;
      } else if (s?.is_passed === false) {
        f++;
        a++;
      }
    }
    return { passCount: p, failCount: f, motorCount: m, answeredCount: a, total: checklist.length };
  }, [checklist, itemStates]);

  const submit = async () => {
    if (!job_id) return toast.error("ยังไม่ได้กรอก Job");
    if (!qcEmployeeId) return toast.error("กรุณาเลือกพนักงาน QC");
    if (checklist.length === 0)
      return toast.error("ไม่มีรายการ checklist สำหรับหมวดนี้ — แจ้งแอดมินเพิ่ม");
    if (answeredCount < total) return toast.error(`ยังตรวจไม่ครบ (${answeredCount}/${total})`);
    // Every failed item must have a remark AND at least one media
    for (let idx = 0; idx < checklist.length; idx++) {
      const it = checklist[idx];
      const s = itemStates[it.id];
      if (s?.is_passed === false) {
        if (!s.remark.trim())
          return toast.error(`ข้อ ${idx + 1}: กรุณากรอกหมายเหตุเหตุผลที่ไม่ผ่าน`);
        if (!s.media || s.media.length === 0)
          return toast.error(`ข้อ ${idx + 1}: ต้องแนบรูป/วิดีโอหลักฐานอย่างน้อย 1 รายการ`);
      }
    }
    const token = getQcToken();
    if (!token) return onLogout();

    const overallResult: "pass" | "fail" = failCount > 0 ? "fail" : "pass";
    // Pick a representative log for back-compat columns (latest with matching category)
    const repLog =
      [...logs].reverse().find((l) => l.category_id === categoryId) ?? logs[logs.length - 1];

    setSubmitting(true);
    try {
      await submitReport({
        data: {
          token,
          job_id,
          qc_employee_id: qcEmployeeId,
          production_log_id: repLog?.id ?? null,
          step_id: repLog?.step_id ?? null,
          category_id: categoryId || null,
          employee_id: repLog?.employee_id ?? null,
          note: note.trim() || null,
          media: media.map((m) => ({ url: m.url, type: m.type })),
          overall_result: overallResult,
          items: checklist.map((it) => {
            const s = itemStates[it.id];
            return {
              checklist_id: it.id,
              item_text_snapshot: it.item_text,
              item_order: it.item_order,
              is_passed: s?.is_passed === true,
              tag: s?.tag ?? null,
              remark: s?.remark?.trim() || null,
              media: (s?.media ?? []).map((m) => ({ url: m.url, type: m.type })),
            };
          }),
        },
      });
      toast.success(
        overallResult === "pass"
          ? `ส่งรายงานสำเร็จ — ผ่าน ${passCount}/${total}`
          : `ส่งรายงานสำเร็จ — ไม่ผ่าน ${failCount} ข้อ`,
      );
      // Reset
      setNote("");
      setMedia([]);
      setItemStates({});
      setManualJob("");
      navigate({ search: { job_id: "" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งรายงานไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  // Stable refs for per-item file inputs would explode; use overall refs + per-item handlers via inline inputs
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <Toaster richColors position="top-center" />
      <AppHeader>
        <Link to="/">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">หน้าแรก</span>
          </Button>
        </Link>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1"
          onClick={() => {
            clearQcSession();
            onLogout();
          }}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">ออกจากระบบ</span>
        </Button>
      </AppHeader>

      <main className="mx-auto max-w-md px-4 py-6 pb-32">
        <h1 className="sr-only">QC — ตรวจสอบงาน</h1>

        {/* Job */}
        <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] bg-gradient-to-br from-card to-secondary/5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <QrCode className="h-4 w-4" /> Job ID
          </div>
          {job_id ? (
            <div className="mt-1 text-3xl font-bold text-primary">{job_id}</div>
          ) : (
            <p className="mt-2 text-sm text-destructive">ยังไม่ได้สแกน / กรอก Job</p>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              onClick={async () => {
                const result = await acquireCameraStream("environment");
                if ("errorInfo" in result) {
                  toast.error(
                    result.errorInfo.hint
                      ? `${result.errorInfo.message} — ${result.errorInfo.hint}`
                      : result.errorInfo.message,
                  );
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
            <Input
              value={manualJob}
              onChange={(e) => setManualJob(e.target.value)}
              placeholder="กรอก Job ID"
              className="h-11"
              onKeyDown={(e) => e.key === "Enter" && applyManualJob()}
            />
            {job_id ? (
              <Button
                onClick={() => {
                  setManualJob("");
                  navigate({ search: { job_id: "" } });
                }}
                variant="outline"
                className="h-11 gap-1"
                aria-label="ล้างหมายเลขงาน"
                title="ล้างหมายเลขงาน"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={applyManualJob}
                variant="outline"
                className="h-11 gap-1"
                aria-label="ยืนยันหมายเลขงาน"
                title="ยืนยันหมายเลขงาน"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </section>

        {/* QC employee */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardCheck className="h-4 w-4 text-secondary" /> พนักงาน QC
          </h2>
          <Select value={qcEmployeeId} onValueChange={setQcEmployeeId}>
            <SelectTrigger className="h-14 w-full rounded-2xl text-base">
              <SelectValue placeholder="เลือกพนักงาน QC" />
            </SelectTrigger>
            <SelectContent>
              {qcEmployees.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  ยังไม่มีพนักงาน QC — ให้แอดมินเพิ่มในหน้าจัดการ
                </div>
              )}
              {qcEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id} className="py-2">
                  <div className="flex flex-col text-left">
                    <span className="text-base font-semibold leading-tight">{e.name}</span>
                    {e.emp_code && (
                      <span className="font-mono text-xs text-muted-foreground">{e.emp_code}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Job history pass-through */}
        {job_id && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListChecks className="h-4 w-4 text-secondary" /> ประวัติงานนี้
            </h2>
            <div className="rounded-2xl border border-border bg-card p-2 space-y-1.5 max-h-[260px] overflow-y-auto">
              {loadingLogs && (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
                </div>
              )}
              {!loadingLogs && logs.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  ไม่พบบันทึกการทำงานของ Job นี้
                </div>
              )}
              {logs.map((l) => (
                <div key={l.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    <span>{l.categories?.name ?? "—"}</span>
                    <span>•</span>
                    <span>{new Date(l.created_at).toLocaleString("th-TH")}</span>
                  </div>
                  <div className="mt-1 text-base font-semibold leading-tight">
                    {l.steps?.step_name ?? "ขั้นตอนไม่ระบุ"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>{l.employees?.name ?? "—"}</span>
                    {l.employees?.emp_code && (
                      <span className="font-mono text-xs">({l.employees.emp_code})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Category selector */}
        {job_id && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-secondary" /> หมวดสินค้า
              {categoryAutoSet && (
                <span className="ml-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-secondary">
                  อัตโนมัติจากประวัติงาน
                </span>
              )}
            </h2>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setCategoryAutoSet(false);
              }}
            >
              <SelectTrigger className="h-12 w-full rounded-2xl text-base">
                <SelectValue placeholder="เลือกหมวดสินค้า" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
        )}

        {/* Checklist */}
        {job_id && categoryId && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListChecks className="h-4 w-4 text-secondary" /> รายการตรวจสอบ
              {total > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  ตรวจแล้ว {answeredCount}/{total}
                </span>
              )}
            </h2>

            {loadingChecklist && (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด checklist...
              </div>
            )}

            {!loadingChecklist && checklist.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                ไม่มีรายการตรวจสอบสำหรับหมวดนี้ — แจ้งแอดมินเพิ่มใน "จัดการ → Checklist QC"
              </div>
            )}

            <div className="space-y-3">
              {checklist.map((it, idx) => {
                const s = itemStates[it.id] ?? EMPTY_ITEM_STATE;
                return (
                  <ChecklistRow
                    key={it.id}
                    index={idx + 1}
                    item={it}
                    state={s}
                    uploading={uploading}
                    uploadStatus={uploadStatus}
                    onPass={(v) => setItemPass(it.id, v)}
                    onMotor={() => setItemMotor(it.id)}
                    onRemark={(v) => setItemRemark(it.id, v)}
                    onUpload={(files, kind) => uploadFiles(files, kind, it.id)}
                    onRemoveMedia={(i) => removeItemMedia(it.id, i)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Overall evidence */}
        {job_id && categoryId && checklist.length > 0 && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">หมายเหตุภาพรวม / หลักฐานรวม</h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุภาพรวม (ถ้ามี)..."
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />

            <input
              ref={imgInput}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files, "image", "overall")}
            />
            <input
              ref={vidInput}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  warnIfMovFiles(e.target.files);
                  uploadFiles(e.target.files, "video", "overall");
                }
              }}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                onClick={() => imgInput.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-4 w-4" /> เพิ่มรูป
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                onClick={() => vidInput.current?.click()}
                disabled={uploading}
              >
                <VideoIcon className="h-4 w-4" /> เพิ่มวิดีโอ
              </Button>
            </div>

            <MediaUploadStatusLine status={uploadStatus} />

            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                  >
                    {m.type === "image" ? (
                      <img
                        src={m.previewUrl ?? m.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={m.previewUrl ?? m.url}
                        className="h-full w-full object-cover"
                        preload="metadata"
                        muted
                        playsInline
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                      aria-label="ลบไฟล์หลักฐาน"
                      className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Submit */}
        {job_id && categoryId && checklist.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <span className="font-semibold">สรุป:</span>{" "}
              <span className="text-success">ผ่าน {passCount}</span>
              {motorCount > 0 && (
                <span className="text-amber-600"> (มอเตอร์ {motorCount})</span>
              )} / <span className="text-destructive">ไม่ผ่าน {failCount}</span> /{" "}
              <span className="text-muted-foreground">ทั้งหมด {total}</span>
            </div>
            <Button
              onClick={submit}
              disabled={submitting || uploading || answeredCount < total}
              className="h-14 w-full gap-2 text-base font-semibold"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              ส่งรายงาน QC
            </Button>
          </section>
        )}
      </main>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={(v) => {
          if (!v) setScannerStream(null);
        }}
        onScanned={handleScanned}
        initialStream={scannerStream}
      />
    </div>
  );
}

function ChecklistRow({
  index,
  item,
  state,
  uploading,
  uploadStatus,
  onPass,
  onMotor,
  onRemark,
  onUpload,
  onRemoveMedia,
}: {
  index: number;
  item: ChecklistItem;
  state: ItemState;
  uploading: boolean;
  uploadStatus: MediaUploadStatus;
  onPass: (v: boolean) => void;
  onMotor: () => void;
  onRemark: (v: string) => void;
  onUpload: (files: FileList, kind: "image" | "video") => void;
  onRemoveMedia: (i: number) => void;
}) {
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const failed = state.is_passed === false;
  const isMotor = state.is_passed === true && state.tag === "motor";
  const passed = state.is_passed === true && !isMotor;

  return (
    <div
      className={`rounded-2xl border-2 bg-card p-3 transition-colors ${
        passed
          ? "border-success/40 bg-success/5"
          : isMotor
            ? "border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20"
            : failed
              ? "border-destructive/40 bg-destructive/5"
              : "border-border"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
          {index}
        </span>
        <p className="flex-1 text-sm font-medium leading-snug">{item.item_text}</p>
        {isMotor && (
          <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
            มอเตอร์
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          type="button"
          onClick={() => onPass(true)}
          className={`h-11 gap-1 px-2 text-sm font-semibold ${
            passed
              ? "bg-success text-success-foreground hover:bg-success/90"
              : "bg-success/15 text-success hover:bg-success/25"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" /> ผ่าน
        </Button>
        <Button
          type="button"
          onClick={() => onPass(false)}
          className={`h-11 gap-1 px-2 text-sm font-semibold ${
            failed
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-destructive/15 text-destructive hover:bg-destructive/25"
          }`}
        >
          <XCircle className="h-4 w-4" /> ไม่ผ่าน
        </Button>
        <Button
          type="button"
          onClick={() => onMotor()}
          className={`h-11 gap-1 px-2 text-sm font-semibold ${
            isMotor
              ? "bg-amber-500 text-white hover:bg-amber-500/90"
              : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
          }`}
        >
          <Wrench className="h-4 w-4" /> มอเตอร์
        </Button>
      </div>

      {failed && (
        <div className="mt-3 space-y-2">
          <textarea
            value={state.remark}
            onChange={(e) => onRemark(e.target.value)}
            placeholder="หมายเหตุ: ไม่ผ่านเพราะ... (จำเป็น)"
            rows={2}
            maxLength={2000}
            className="w-full rounded-lg border border-destructive/40 bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
          />

          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onUpload(e.target.files, "image");
              if (imgRef.current) imgRef.current.value = "";
            }}
          />
          <input
            ref={vidRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                warnIfMovFiles(e.target.files);
                onUpload(e.target.files, "video");
              }
              if (vidRef.current) vidRef.current.value = "";
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={uploading}
              onClick={() => imgRef.current?.click()}
            >
              <Camera className="h-4 w-4" /> รูป
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={uploading}
              onClick={() => vidRef.current?.click()}
            >
              <VideoIcon className="h-4 w-4" /> วิดีโอ
            </Button>
          </div>

          {uploading && uploadStatus.phase !== "idle" && (
            <MediaUploadStatusLine status={uploadStatus} />
          )}

          {state.media.length === 0 ? (
            <p className="text-xs font-medium text-destructive">
              * ต้องแนบรูปหรือวิดีโอหลักฐานอย่างน้อย 1 รายการ
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {state.media.map((m, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
                >
                  {m.type === "image" ? (
                    <img
                      src={m.previewUrl ?? m.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={m.previewUrl ?? m.url}
                      className="h-full w-full object-cover"
                      preload="metadata"
                      muted
                      playsInline
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveMedia(i)}
                    aria-label="ลบไฟล์หลักฐานของรายการนี้"
                    className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
