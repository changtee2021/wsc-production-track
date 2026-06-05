import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Play,
  Square,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  ScanLine,
  Clock,
  AlertTriangle,
  ListChecks,
  User,
  Layers,
  Camera,
  Loader2,
  X,
  ArrowLeft,
  RotateCcw,
  Check,
  Timer,
  Package,
} from "lucide-react";
import { flagFor, initialsOf, useI18n } from "@/lib/i18n";

import { useServerFn } from "@tanstack/react-start";
import { uploadWorkerNoteImage } from "@/lib/worker-upload.functions";
import { submitProductionLog } from "@/lib/scan.functions";

const ALLOWED_NOTE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_NOTE_BYTES = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const scanSearchSchema = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/scan")({
  validateSearch: zodValidator(scanSearchSchema),
  head: () => ({
    meta: [
      { title: "สแกนงาน — WSC ProductionTrack" },
      {
        name: "description",
        content: "สแกน QR code เพื่อบันทึกเวลาเริ่มและเสร็จงานในสายการผลิต ใช้งานง่ายบนมือถือ",
      },
      { property: "og:title", content: "สแกนงาน — WSC ProductionTrack" },
      {
        property: "og:description",
        content: "สแกน QR code เพื่อบันทึกเวลาเริ่ม–เสร็จงานในสายการผลิตอย่างรวดเร็ว",
      },
      { property: "og:url", content: "https://wsc-production-track.lovable.app/scan" },
    ],
    links: [{ rel: "canonical", href: "https://wsc-production-track.lovable.app/scan" }],
  }),
  component: ScanPage,
});

interface Employee {
  id: string;
  name: string;
  emp_code: string | null;
  nationality: string | null;
  avatar_url: string | null;
}
interface Step {
  id: string;
  step_name: string;
  description: string | null;
  image_url: string | null;
  std_duration_minutes: number | null;
}
interface Category {
  id: string;
  name: string;
}

function ScanPage() {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/scan" });
  const [manualJob, setManualJob] = useState("");
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);
  const scannerOpen = scannerStream !== null;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [stepId, setStepId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [submitting, setSubmitting] = useState<"start" | "finish" | null>(null);
  const [lastSubmit, setLastSubmit] = useState<{ action: string; at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasIssue, setHasIssue] = useState(false);
  const [note, setNote] = useState("");
  const [noteImage, setNoteImage] = useState<{ path: string; previewUrl: string } | null>(null);
  const [uploadingNote, setUploadingNote] = useState(false);
  const noteFileRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const uploadNote = useServerFn(uploadWorkerNoteImage);

  const activeKey = job_id && employeeId && stepId ? `wsc:active-start:${job_id}:${stepId}:${employeeId}` : null;
  const [activeStartAt, setActiveStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeKey) {
      setActiveStartAt(null);
      return;
    }
    const v = localStorage.getItem(activeKey);
    setActiveStartAt(v ? Number(v) : null);
  }, [activeKey]);

  useEffect(() => {
    if (activeStartAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeStartAt]);

  useEffect(() => {
    (async () => {
      const [e, s, c] = await Promise.all([
        supabase.from("employees").select("id,name,emp_code,nationality,avatar_url").eq("active", true).order("name"),
        supabase
          .from("steps")
          .select("id,step_name,description,image_url,std_duration_minutes")
          .eq("active", true)
          .order("step_name"),
        supabase.from("categories").select("id,name").eq("active", true).order("name"),
      ]);
      if (e.data) setEmployees(e.data);
      if (s.data) setSteps(s.data);
      if (c.data) setCategories(c.data);
      setLoading(false);
    })();
  }, []);

  const selectedStep = useMemo(() => steps.find((s) => s.id === stepId) ?? null, [steps, stepId]);

  const submit = async (action: "start" | "finish") => {
    if (!job_id) {
      toast.error(t("toast.noJob"));
      return;
    }
    if (!employeeId || !stepId || !categoryId) {
      toast.error(t("toast.noSelect"));
      return;
    }
    if (action === "finish" && hasIssue && !note.trim()) {
      toast.error(t("note.required"));
      return;
    }
    setSubmitting(action);
    const { error } = await supabase.from("production_logs").insert({
      job_id,
      employee_id: employeeId,
      step_id: stepId,
      category_id: categoryId,
      action,
      note: action === "finish" && hasIssue ? note.trim() : null,
      note_image_url: action === "finish" && hasIssue ? (noteImage?.path ?? null) : null,
    });
    setSubmitting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const at = new Date().toLocaleString("th-TH");
    setLastSubmit({ action, at });
    if (action === "start" && activeKey) {
      const ts = Date.now();
      localStorage.setItem(activeKey, String(ts));
      setActiveStartAt(ts);
      setNow(ts);
    }
    if (action === "finish") {
      if (activeKey) localStorage.removeItem(activeKey);
      setActiveStartAt(null);
      setHasIssue(false);
      setNote("");
      setNoteImage(null);
    }
    toast.success(action === "start" ? t("toast.startedAt", { t: at }) : t("toast.finishedAt", { t: at }));
  };

  const uploadNoteImage = async (file: File) => {
    if (!ALLOWED_NOTE_MIME.includes(file.type)) {
      toast.error("รองรับเฉพาะรูปภาพ JPG, PNG, WEBP, GIF");
      return;
    }
    if (file.size > MAX_NOTE_BYTES) {
      toast.error("ไฟล์ใหญ่เกิน 5MB");
      return;
    }
    setUploadingNote(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await uploadNote({ data: { dataBase64 } });
      setNoteImage({ path: res.path, previewUrl: res.previewUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploadingNote(false);
    }
  };

  const applyManualJob = () => {
    const trimmed = manualJob.trim();
    if (!trimmed) return;
    navigate({ search: { job_id: trimmed } });
  };

  const handleScanned = (text: string) => {
    let jobValue = text;
    try {
      const url = new URL(text);
      const fromQuery = url.searchParams.get("job_id");
      if (fromQuery) jobValue = fromQuery;
    } catch {
      // not a URL — use raw text
    }
    setManualJob(jobValue);
    navigate({ search: { job_id: jobValue } });
    toast.success(t("toast.scanned", { v: jobValue }));
  };

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
        <Link to="/admin">
          <Button variant="secondary" size="sm" className="gap-1">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">{t("header.admin")}</span>
          </Button>
        </Link>
      </AppHeader>

      <AnnouncementBar />

      <main className="mx-auto max-w-md px-4 py-6 pb-32">
        <h1 className="sr-only">{t("page.title")}</h1>

        {/* Job ID */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] bg-gradient-to-br from-card to-secondary/5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <QrCode className="h-4 w-4" />
            {t("job.label")}
          </div>
          {job_id ? (
            <>
              <div className="mt-1 text-3xl font-bold text-primary">{job_id}</div>
              <p className="mt-2 text-xs text-muted-foreground">{t("job.autoHint")}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-destructive">{t("job.empty")}</p>
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
              className="h-11 flex-[2] gap-1 bg-secondary hover:bg-secondary/90 shadow-md shadow-secondary/30"
            >
              <ScanLine className="h-4 w-4" />
              {t("job.scan")}
            </Button>
            <Link to="/packing" search={{ job_id: "" }}>
              <Button className="h-11 flex-1 gap-1 bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/30">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">แพ็คของ</span>
              </Button>
            </Link>
          </div>

          <div className="mt-2 flex gap-2">
            <Input
              value={manualJob}
              onChange={(e) => setManualJob(e.target.value)}
              placeholder={t("job.placeholder")}
              className="h-11"
              onKeyDown={(e) => e.key === "Enter" && applyManualJob()}
            />
            {job_id ? (
              <Button
                onClick={() => {
                  setManualJob("");
                  setLastSubmit(null);
                  navigate({ search: { job_id: "" } });
                }}
                variant="outline"
                className="h-11 gap-1"
                aria-label={t("job.resetTitle")}
                title={t("job.resetTitle")}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={applyManualJob}
                variant="outline"
                className="h-11 gap-1"
                aria-label={t("job.confirmTitle")}
                title={t("job.confirmTitle")}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Category dropdown */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="h-4 w-4 text-secondary" />
            {t("cat.title")}
          </h2>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={loading}>
            <SelectTrigger className="h-16 w-full rounded-2xl text-base">
              <SelectValue placeholder={loading ? t("emp.loading") : t("cat.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="py-3">
                  <span className="text-base font-semibold">{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Employee dropdown */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-secondary" />
            {t("emp.title")}
          </h2>
          <Select value={employeeId} onValueChange={setEmployeeId} disabled={loading}>
            <SelectTrigger className="h-16 w-full rounded-2xl text-base">
              <SelectValue placeholder={loading ? t("emp.loading") : t("emp.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-border">
                      {e.avatar_url ? <AvatarImage src={e.avatar_url} alt={e.name} /> : null}
                      <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                        {initialsOf(e.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xl">{flagFor(e.nationality)}</span>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-semibold leading-tight">{e.name}</span>
                      {e.emp_code && <span className="font-mono text-xs text-muted-foreground">{e.emp_code}</span>}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Step dropdown */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-secondary" />
            {t("step.title")}
          </h2>
          <Select value={stepId} onValueChange={setStepId} disabled={loading}>
            <SelectTrigger className="h-16 w-full rounded-2xl text-base">
              <SelectValue placeholder={loading ? t("emp.loading") : t("step.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {steps.map((s) => (
                <SelectItem key={s.id} value={s.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border-2 border-border bg-muted">
                      {s.image_url ? (
                        <img src={s.image_url} alt={s.step_name} className="h-full w-full object-cover" />
                      ) : (
                        <ListChecks className="h-6 w-6 text-secondary" />
                      )}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-semibold leading-tight">{s.step_name}</span>
                      {s.std_duration_minutes != null && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-destructive">
                          <Clock className="h-3 w-3" />≤ {s.std_duration_minutes} {t("step.minutes")}
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Standard-time warning */}
        {selectedStep?.std_duration_minutes != null && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="text-sm font-semibold leading-snug">
              {t("step.warning", { n: selectedStep.std_duration_minutes })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button
            onClick={() => submit("start")}
            disabled={submitting !== null || activeStartAt !== null}
            className="h-16 w-full rounded-2xl bg-secondary text-lg font-bold text-secondary-foreground shadow-md hover:bg-secondary/90 disabled:opacity-60"
          >
            {submitting === "start" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Play className="mr-2 h-5 w-5 fill-current" />
            )}
            {t("action.start")}
          </Button>

          {activeStartAt !== null &&
            (() => {
              const elapsed = Math.max(0, Math.floor((now - activeStartAt) / 1000));
              const limit = selectedStep?.std_duration_minutes ? selectedStep.std_duration_minutes * 60 : null;
              const over = limit != null && elapsed >= limit;
              const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
              const ss = String(elapsed % 60).padStart(2, "0");
              return (
                <div
                  className={`flex items-center justify-between rounded-2xl border-2 p-4 ${
                    over
                      ? "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
                      : "border-success/40 bg-success/10 text-success"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {over ? <AlertTriangle className="h-6 w-6" /> : <Timer className="h-6 w-6" />}
                    <span className="text-sm font-semibold">{over ? "เกินเวลามาตรฐาน" : "กำลังจับเวลา"}</span>
                  </div>
                  <div className="font-mono text-3xl font-bold tabular-nums">
                    {mm}:{ss}
                  </div>
                </div>
              );
            })()}

          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasIssue}
                onChange={(e) => setHasIssue(e.target.checked)}
                className="h-5 w-5 accent-destructive"
              />
              <span className="flex items-center gap-1 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {t("note.toggle")}
              </span>
            </label>

            {hasIssue && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("note.placeholder")}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                />
                <input
                  ref={noteFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadNoteImage(f);
                  }}
                />
                {noteImage ? (
                  <div className="relative">
                    <img
                      src={noteImage.previewUrl}
                      alt="note"
                      className="h-40 w-full rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setNoteImage(null)}
                      aria-label="ลบรูปหมายเหตุ"
                      className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full gap-1"
                      onClick={() => noteFileRef.current?.click()}
                      disabled={uploadingNote}
                    >
                      <Camera className="h-4 w-4" /> {t("note.changePhoto")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-1"
                    onClick={() => noteFileRef.current?.click()}
                    disabled={uploadingNote}
                  >
                    {uploadingNote ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> {t("note.uploading")}
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" /> {t("note.addPhoto")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={() => submit("finish")}
            disabled={submitting !== null || uploadingNote}
            className="h-16 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-md hover:bg-primary/90"
          >
            {submitting === "finish" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Square className="mr-2 h-5 w-5 fill-current" />
            )}
            {t("action.finish")}
          </Button>
        </div>

        {lastSubmit && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 p-4 text-success animate-fade-in">
            <CheckCircle2 className="h-5 w-5" />
            <div className="text-sm">
              <div className="font-semibold">
                {lastSubmit.action === "start" ? t("log.startOk") : t("log.finishOk")}
              </div>
              <div className="text-xs opacity-80">{lastSubmit.at}</div>
            </div>
          </div>
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
