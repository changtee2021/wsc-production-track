import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { QrScannerDialog } from "@/components/QrScannerDialog";
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
  ShieldCheck,
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
} from "lucide-react";
import {
  verifyQcPassword,
  qcFetchJobLogs,
  qcSubmitReport,
  qcCreateUploadUrl,
} from "@/lib/qc.functions";
import {
  isQcSession,
  setQcToken,
  getQcToken,
  clearQcSession,
} from "@/lib/qc-session";

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
        content:
          "หน้าตรวจสอบคุณภาพงาน (QC) แนบรูปและวิดีโอข้อผิดพลาดส่งให้แอดมิน",
      },
    ],
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
          <Button variant="ghost" size="sm" className="gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground">
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
          <Label htmlFor="qcpw" className="text-sm font-medium">รหัสผ่าน QC</Label>
          <Input
            id="qcpw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-12 text-base"
            autoFocus
            required
          />
          <Button type="submit" disabled={loading} className="mt-4 h-12 w-full text-base font-semibold">
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

interface MediaItem {
  url: string;
  type: "image" | "video";
}

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const VIDEO_EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

function QcWorkbench({ onLogout }: { onLogout: () => void }) {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/qc" });
  const [manualJob, setManualJob] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const [qcEmployees, setQcEmployees] = useState<QcEmployee[]>([]);
  const [qcEmployeeId, setQcEmployeeId] = useState("");

  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const selectedLog = useMemo(
    () => logs.find((l) => l.id === selectedLogId) ?? null,
    [logs, selectedLogId],
  );

  const [note, setNote] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);

  const fetchLogs = useServerFn(qcFetchJobLogs);
  const createUpload = useServerFn(qcCreateUploadUrl);
  const submitReport = useServerFn(qcSubmitReport);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("qc_employees")
        .select("id, name, emp_code")
        .eq("active", true)
        .order("name");
      if (data) setQcEmployees(data);
    })();
  }, []);

  useEffect(() => {
    if (!job_id) {
      setLogs([]);
      setSelectedLogId(null);
      return;
    }
    const token = getQcToken();
    if (!token) return;
    setLoadingLogs(true);
    fetchLogs({ data: { token, job_id } })
      .then((res) => {
        setLogs((res.rows ?? []) as unknown as JobLog[]);
        setSelectedLogId(null);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoadingLogs(false));
  }, [job_id, fetchLogs]);

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

  const uploadFiles = async (files: FileList, kind: "image" | "video") => {
    const token = getQcToken();
    if (!token) {
      onLogout();
      return;
    }
    setUploading(true);
    try {
      const items: MediaItem[] = [];
      for (const f of Array.from(files)) {
        const map = kind === "image" ? IMAGE_EXT_BY_MIME : VIDEO_EXT_BY_MIME;
        const ext = map[f.type];
        if (!ext) {
          toast.error(
            kind === "image"
              ? "รองรับเฉพาะ JPG, PNG, WEBP, GIF"
              : "รองรับเฉพาะ MP4, WEBM, MOV, M4V",
          );
          continue;
        }
        const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
        if (f.size > max) {
          toast.error(`ไฟล์ใหญ่เกิน ${Math.round(max / (1024 * 1024))}MB`);
          continue;
        }
        const signed = await createUpload({
          data: { token, ext: ext as any, kind },
        });
        const { error } = await supabase.storage
          .from("qc-media")
          .uploadToSignedUrl(signed.path, signed.token, f, {
            contentType: f.type,
          });
        if (error) {
          toast.error(error.message);
          continue;
        }
        items.push({ url: signed.publicUrl, type: kind });
      }
      if (items.length) setMedia((prev) => [...prev, ...items]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (imgInput.current) imgInput.current.value = "";
      if (vidInput.current) vidInput.current.value = "";
    }
  };

  const submit = async () => {
    if (!job_id) return toast.error("ยังไม่ได้กรอก Job");
    if (!qcEmployeeId) return toast.error("กรุณาเลือกพนักงาน QC");
    if (!selectedLog) return toast.error("กรุณาเลือกขั้นตอนที่ต้องการรายงาน");
    if (!note.trim() && media.length === 0)
      return toast.error("กรุณากรอกข้อความหรือแนบไฟล์อย่างน้อย 1 รายการ");
    const token = getQcToken();
    if (!token) return onLogout();
    setSubmitting(true);
    try {
      await submitReport({
        data: {
          token,
          job_id,
          qc_employee_id: qcEmployeeId,
          production_log_id: selectedLog.id,
          step_id: selectedLog.step_id,
          category_id: selectedLog.category_id,
          employee_id: selectedLog.employee_id,
          note: note.trim() || null,
          media,
        },
      });
      toast.success("ส่งรายงานสำเร็จ");
      setNote("");
      setMedia([]);
      setSelectedLogId(null);
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
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] bg-gradient-to-br from-card to-secondary/5">
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
              onClick={() => setScannerOpen(true)}
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
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={applyManualJob} variant="outline" className="h-11 gap-1">
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

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

        {/* Job log list */}
        {job_id && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListChecks className="h-4 w-4 text-secondary" /> ขั้นตอนที่ทำในงานนี้
            </h2>
            <div className="rounded-2xl border border-border bg-card p-2 space-y-1.5 max-h-[360px] overflow-y-auto">
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
              {logs.map((l) => {
                const active = l.id === selectedLogId;
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLogId(l.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      active
                        ? "border-secondary bg-secondary/10"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
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
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Report form */}
        {selectedLog && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">รายงานข้อผิดพลาด</h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="อธิบายปัญหาที่พบ..."
              rows={4}
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
              onChange={(e) => e.target.files && uploadFiles(e.target.files, "image")}
            />
            <input
              ref={vidInput}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files, "video")}
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

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> กำลังอัปโหลด...
              </div>
            )}

            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                    {m.type === "image" ? (
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video src={m.url} className="h-full w-full object-cover" muted />
                    )}
                    <button
                      type="button"
                      onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={submit}
              disabled={submitting || uploading}
              className="h-12 w-full gap-2 text-base font-semibold"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              ส่งรายงานไปแอดมิน
            </Button>
          </section>
        )}
      </main>

      <QrScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScanned={handleScanned} />
    </div>
  );
}
