import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Play,
  Square,
  QrCode,
  User,
  ListChecks,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";

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
      { property: "og:title", content: "ProductionTrack — ระบบติดตามการผลิต" },
      {
        property: "og:description",
        content: "สแกน QR code เพื่อบันทึกขั้นตอนการผลิต",
      },
    ],
  }),
  component: ScanHomePage,
});

interface Employee {
  id: string;
  name: string;
  nationality: string | null;
}
interface Step {
  id: string;
  step_name: string;
  description: string | null;
}

function ScanHomePage() {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [manualJob, setManualJob] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [stepId, setStepId] = useState<string>("");
  const [submitting, setSubmitting] = useState<"start" | "finish" | null>(null);
  const [lastSubmit, setLastSubmit] = useState<{
    action: string;
    at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [e, s] = await Promise.all([
        supabase
          .from("employees")
          .select("id,name,nationality")
          .eq("active", true)
          .order("name"),
        supabase
          .from("steps")
          .select("id,step_name,description")
          .eq("active", true)
          .order("step_name"),
      ]);
      if (e.data) setEmployees(e.data);
      if (s.data) setSteps(s.data);
      setLoading(false);
    })();
  }, []);

  const flag = useMemo(() => {
    const emp = employees.find((x) => x.id === employeeId);
    return flagFor(emp?.nationality ?? null);
  }, [employees, employeeId]);

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

      <main className="mx-auto max-w-md px-4 py-6">
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
            <div className="mt-2">
              <p className="text-sm text-destructive">
                ไม่พบรหัสงานใน URL — กรุณาสแกน QR code หรือกรอกด้วยตัวเอง
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={manualJob}
                  onChange={(e) => setManualJob(e.target.value)}
                  placeholder="เช่น JOB123"
                  className="h-11"
                  onKeyDown={(e) => e.key === "Enter" && applyManualJob()}
                />
                <Button onClick={applyManualJob} className="h-11">
                  ใช้งาน
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Employee */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-secondary" />
            พนักงาน
          </Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-14 text-base">
              <SelectValue placeholder={loading ? "กำลังโหลด..." : "เลือกพนักงาน"}>
                {employeeId && (
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{flag}</span>
                    {employees.find((e) => e.id === employeeId)?.name}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-base">
                  <span className="mr-2">{flagFor(e.nationality)}</span>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Step */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <ListChecks className="h-4 w-4 text-secondary" />
            ขั้นตอนการผลิต
          </Label>
          <Select value={stepId} onValueChange={setStepId}>
            <SelectTrigger className="h-14 text-base">
              <SelectValue placeholder={loading ? "กำลังโหลด..." : "เลือกขั้นตอน"} />
            </SelectTrigger>
            <SelectContent>
              {steps.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-base">
                  {s.step_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            onClick={() => submit("start")}
            disabled={submitting !== null}
            className="h-24 flex-col gap-1 rounded-2xl bg-secondary text-xl font-bold text-secondary-foreground shadow-md hover:bg-secondary/90"
          >
            {submitting === "start" ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Play className="h-8 w-8 fill-current" />
            )}
            เริ่มงาน
          </Button>
          <Button
            onClick={() => submit("finish")}
            disabled={submitting !== null}
            className="h-24 flex-col gap-1 rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-md hover:bg-primary/90"
          >
            {submitting === "finish" ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Square className="h-8 w-8 fill-current" />
            )}
            เสร็จงาน
          </Button>
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
    </div>
  );
}

function flagFor(nat: string | null): string {
  switch (nat?.toLowerCase()) {
    case "thai":
      return "🇹🇭";
    case "burmese":
    case "myanmar":
      return "🇲🇲";
    case "lao":
      return "🇱🇦";
    case "khmer":
    case "cambodian":
      return "🇰🇭";
    default:
      return "👤";
  }
}
