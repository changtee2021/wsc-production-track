import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Loader2,
  ShieldCheck,
  ScanLine,
  Clock,
  AlertTriangle,
  ListChecks,
  User,
} from "lucide-react";
import { flagFor, initialsOf } from "@/lib/i18n";
import { SlideToConfirm } from "@/components/SlideToConfirm";
import { RotateCcw } from "lucide-react";

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

function ScanHomePage() {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [manualJob, setManualJob] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [stepId, setStepId] = useState<string>("");
  const [submitting, setSubmitting] = useState<"start" | "finish" | null>(null);
  const [lastSubmit, setLastSubmit] = useState<{ action: string; at: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [e, s] = await Promise.all([
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
      ]);
      if (e.data) setEmployees(e.data);
      if (s.data) setSteps(s.data);
      setLoading(false);
    })();
  }, []);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === stepId) ?? null,
    [steps, stepId],
  );

  const submit = async (action: "start" | "finish") => {
    if (!job_id) {
      toast.error("ไม่พบรหัสงาน — กรุณาสแกน QR code");
      return;
    }
    if (!employeeId || !stepId) {
      toast.error("กรุณาเลือกพนักงานและขั้นตอน");
      return;
    }
    setSubmitting(action);
    const { error } = await supabase.from("production_logs").insert({
      job_id,
      employee_id: employeeId,
      step_id: stepId,
      action,
    });
    setSubmitting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const at = new Date().toLocaleString("th-TH");
    setLastSubmit({ action, at });
    toast.success(`${action === "start" ? "เริ่มงาน" : "เสร็จงาน"} เมื่อ ${at}`);
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
    toast.success(`สแกนสำเร็จ: ${jobValue}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <AppHeader>
        <Link to="/admin">
          <Button variant="secondary" size="sm" className="gap-1">
            <ShieldCheck className="h-4 w-4" />
            ผู้ดูแล
          </Button>
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-md px-4 py-6 pb-32">
        <h1 className="sr-only">สแกน QR code เพื่อบันทึกการผลิต</h1>

        {/* Job ID */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <QrCode className="h-4 w-4" />
            รหัสงาน (Job ID)
          </div>
          {job_id ? (
            <>
              <div className="mt-1 text-3xl font-bold text-primary">{job_id}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                ระบบดึงรหัสจาก QR code อัตโนมัติ ไม่ต้องพิมพ์เอง
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-destructive">
              ยังไม่มีรหัสงาน — กดปุ่ม "สแกน QR" หรือกรอกด้วยตัวเอง
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => setScannerOpen(true)}
              className="h-11 flex-1 gap-1 bg-secondary hover:bg-secondary/90"
            >
              <ScanLine className="h-4 w-4" />
              สแกน QR
            </Button>
          </div>

          <div className="mt-2 flex gap-2">
            <Input
              value={manualJob}
              onChange={(e) => setManualJob(e.target.value)}
              placeholder="หรือพิมพ์รหัสงาน เช่น JOB123"
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
                title="ล้างรหัสงานเพื่อสแกนใหม่"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            ) : (
              <Button onClick={applyManualJob} variant="outline" className="h-11">
                ใช้
              </Button>
            )}
          </div>
        </div>

        {/* Employee dropdown */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-secondary" />
            เลือกพนักงาน
          </h2>
          <Select value={employeeId} onValueChange={setEmployeeId} disabled={loading}>
            <SelectTrigger className="h-16 w-full text-base">
              <SelectValue placeholder={loading ? "กำลังโหลด…" : "-- เลือกพนักงาน --"} />
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
            เลือกขั้นตอนการผลิต
          </h2>
          <Select value={stepId} onValueChange={setStepId} disabled={loading}>
            <SelectTrigger className="h-12 w-full">
              <SelectValue placeholder={loading ? "กำลังโหลด…" : "-- เลือกขั้นตอน --"} />
            </SelectTrigger>
            <SelectContent>
              {steps.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-muted">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.step_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ListChecks className="h-4 w-4 text-secondary" />
                      )}
                    </div>
                    <span className="font-medium">{s.step_name}</span>
                    {s.std_duration_minutes != null && (
                      <span className="ml-1 flex items-center gap-1 text-[10px] font-medium text-destructive">
                        <Clock className="h-3 w-3" />≤ {s.std_duration_minutes} นาที
                      </span>
                    )}
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
              ขั้นตอนนี้ไม่ควรเกิน {selectedStep.std_duration_minutes} นาที
            </div>
          </div>
        )}

        {/* Actions — slide to confirm to prevent accidental taps */}
        <div className="mt-6 space-y-3">
          <SlideToConfirm
            label="เริ่มงาน"
            icon={Play}
            loading={submitting === "start"}
            disabled={submitting !== null}
            onConfirm={() => submit("start")}
            colorClass="bg-secondary text-secondary-foreground"
            thumbClass="bg-white text-secondary"
          />
          <SlideToConfirm
            label="เสร็จงาน"
            icon={Square}
            loading={submitting === "finish"}
            disabled={submitting !== null}
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
                บันทึก{lastSubmit.action === "start" ? "การเริ่มงาน" : "การเสร็จงาน"}เรียบร้อย
              </div>
              <div className="text-xs opacity-80">{lastSubmit.at}</div>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          🇹🇭 ไทย · 🇲🇲 พม่า · 🇱🇦 ลาว · 🇰🇭 กัมพูชา
        </p>
      </main>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanned={handleScanned}
      />
    </div>
  );
}
