import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "lucide-react";
import { flagFor, initialsOf, useI18n } from "@/lib/i18n";
import { SlideToConfirm } from "@/components/SlideToConfirm";
import { RotateCcw } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const indexSearchSchema = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(indexSearchSchema),
  head: () => ({
    meta: [
      { title: "สแกนงาน — ProductionTrack" },
      {
        name: "description",
        content:
          "สแกน QR code เพื่อบันทึกเวลาเริ่มและเสร็จงานในสายการผลิต ใช้งานง่ายบนมือถือ",
      },
    ],
  }),
  component: ScanHomePage,
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

function ScanHomePage() {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [manualJob, setManualJob] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [stepId, setStepId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [submitting, setSubmitting] = useState<"start" | "finish" | null>(null);
  const [lastSubmit, setLastSubmit] = useState<{ action: string; at: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [hasIssue, setHasIssue] = useState(false);
  const [note, setNote] = useState("");
  const [noteImageUrl, setNoteImageUrl] = useState<string | null>(null);
  const [uploadingNote, setUploadingNote] = useState(false);
  const noteFileRef = useRef<HTMLInputElement>(null);
  const { t, lang } = useI18n();

  useEffect(() => {
    (async () => {
      const [e, s, c] = await Promise.all([
        supabase
          .from("employees")
          .select("id,name,emp_code,nationality,avatar_url")
          .eq("active", true)
          .order("name"),
        supabase
          .from("steps")
          .select("id,step_name,description,image_url,std_duration_minutes")
          .eq("active", true)
          .order("step_name"),
        supabase
          .from("categories")
          .select("id,name")
          .eq("active", true)
          .order("name"),
      ]);
      if (e.data) setEmployees(e.data);
      if (s.data) setSteps(s.data);
      if (c.data) setCategories(c.data);
      setLoading(false);
    })();
  }, []);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === stepId) ?? null,
    [steps, stepId],
  );

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
      note_image_url: action === "finish" && hasIssue ? noteImageUrl : null,
    });
    setSubmitting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const at = new Date().toLocaleString(lang === "my" ? "my-MM" : "th-TH");
    setLastSubmit({ action, at });
    if (action === "finish") {
      setHasIssue(false);
      setNote("");
      setNoteImageUrl(null);
    }
    toast.success(
      action === "start" ? t("toast.startedAt", { t: at }) : t("toast.finishedAt", { t: at }),
    );
  };

  const uploadNoteImage = async (file: File) => {
    setUploadingNote(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("log-notes")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("log-notes").getPublicUrl(path);
      setNoteImageUrl(data.publicUrl);
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
    // accept either a raw job id or a URL containing ?job_id=...
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
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <AppHeader>
        <LanguageSwitcher />
        <Link to="/admin">
          <Button variant="secondary" size="sm" className="gap-1">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">{t("header.admin")}</span>
          </Button>
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-md px-4 py-6 pb-32">
        <h1 className="sr-only">{t("page.title")}</h1>

        {/* Job ID */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
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
              onClick={() => setScannerOpen(true)}
              className="h-11 flex-1 gap-1 bg-secondary hover:bg-secondary/90"
            >
              <ScanLine className="h-4 w-4" />
              {t("job.scan")}
            </Button>
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
                title={t("job.resetTitle")}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={applyManualJob}
                variant="outline"
                className="h-11 gap-1"
                title={t("job.confirmTitle")}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Category dropdown */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <StepNumber n={1} done={!!categoryId} />
            <Layers className="h-4 w-4 text-secondary" />
            {t("cat.title")}
          </h2>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={loading}>
            <SelectTrigger className="h-16 w-full text-base">
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
            <StepNumber n={2} done={!!employeeId} />
            <User className="h-4 w-4 text-secondary" />
            {t("emp.title")}
          </h2>
          <Select value={employeeId} onValueChange={setEmployeeId} disabled={loading}>
            <SelectTrigger className="h-16 w-full text-base">
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
                      {e.emp_code && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {e.emp_code}
                        </span>
                      )}
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
            <SelectTrigger className="h-16 w-full text-base">
              <SelectValue placeholder={loading ? t("emp.loading") : t("step.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {steps.map((s) => (
                <SelectItem key={s.id} value={s.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border-2 border-border bg-muted">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.step_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ListChecks className="h-6 w-6 text-secondary" />
                      )}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-semibold leading-tight">
                        {s.step_name}
                      </span>
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
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="text-sm font-semibold leading-snug">
              {t("step.warning", { n: selectedStep.std_duration_minutes })}
            </div>
          </div>
        )}

        {/* Actions — slide to confirm to prevent accidental taps */}
        <div className="mt-6 space-y-3">
          <SlideToConfirm
            label={t("action.start")}
            icon={Play}
            loading={submitting === "start"}
            disabled={submitting !== null}
            onConfirm={() => submit("start")}
            colorClass="bg-secondary text-secondary-foreground"
            thumbClass="bg-white text-secondary"
          />

          {/* Optional issue note before finishing */}
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
                {noteImageUrl ? (
                  <div className="relative">
                    <img
                      src={noteImageUrl}
                      alt="note"
                      className="h-40 w-full rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setNoteImageUrl(null)}
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

          <SlideToConfirm
            label={t("action.finish")}
            icon={Square}
            loading={submitting === "finish"}
            disabled={submitting !== null || uploadingNote}
            onConfirm={() => submit("finish")}
            colorClass="bg-primary text-primary-foreground"
            thumbClass="bg-white text-primary"
          />
        </div>

        {lastSubmit && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-4 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <div className="text-sm">
              <div className="font-semibold">
                {lastSubmit.action === "start" ? t("log.startOk") : t("log.finishOk")}
              </div>
              <div className="text-xs opacity-80">{lastSubmit.at}</div>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">{t("footer.langs")}</p>
      </main>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanned={handleScanned}
      />
    </div>
  );
}
