import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import {
  canStartTrial,
  flowSteps,
  loadTrialRuns,
  saveTrialRuns,
  stepLabel,
  trialJob,
  type TrialRun,
} from "@/lib/scan-trial";
import {
  Check,
  Clock,
  CreditCard,
  ListChecks,
  Play,
  QrCode,
  ScanLine,
  Square,
  UserRound,
} from "lucide-react";

type Employee = { id: string; name: string; emp_code: string | null; avatar_url: string | null };
type ScanTarget = "badge" | "job";

function splitName(full: string): { name: string; nickname: string | null } {
  const match = full.trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return match
    ? { name: match[1].trim(), nickname: match[2].trim() }
    : { name: full.trim(), nickname: null };
}

function clockLabel(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function readJobCode(text: string): string {
  const raw = text.trim();
  try {
    const fromQuery = new URL(raw).searchParams.get("job_id");
    if (fromQuery) return fromQuery.trim();
  } catch {
    // The QR is a plain job id, not a link.
  }
  return raw;
}

export function ScanTrialApp() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [worker, setWorker] = useState<Employee | null>(null);
  const [jobId, setJobId] = useState("");
  const [jobInput, setJobInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [step, setStep] = useState("");
  const [runs, setRuns] = useState<TrialRun[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);

  const selected = trialJob(jobId);
  const steps = selected ? flowSteps(selected.flow) : [];
  const mine = runs.find(
    (run) => run.employeeId === worker?.id && run.jobId === jobId && run.status === "running",
  );
  const running = mine != null;

  useEffect(() => {
    setRuns(loadTrialRuns());
    const onStorage = (event: StorageEvent) => {
      if (event.key === "wsc:scan-trial:v1") setRuns(loadTrialRuns());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,name,emp_code,avatar_url")
        .eq("active", true)
        .order("name");
      if (cancelled) return;
      if (error) {
        setLoadState("error");
        return;
      }
      setEmployees(data ?? []);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  function persist(next: TrialRun[]) {
    saveTrialRuns(next);
    setRuns(next);
  }

  function assignWorker(person: Employee) {
    if (running) return;
    setWorker(person);
    setCodeInput("");
    setNote(null);
  }

  function applyBadgeCode(raw: string) {
    const code = raw.trim();
    if (!code) {
      setNote("สแกนบัตรหรือพิมพ์เลขพนักงานก่อน");
      return;
    }
    const person = employees.find((row) => (row.emp_code ?? "").trim() === code);
    if (!person) {
      setNote("ไม่พบเลขพนักงานนี้");
      return;
    }
    assignWorker(person);
  }

  function applyJobCode(raw: string) {
    if (running) return;
    const code = readJobCode(raw);
    if (!code) {
      setNote("สแกนหรือพิมพ์รหัสงานก่อน");
      return;
    }
    const match = trialJob(code);
    if (!match) {
      setJobId("");
      setStep("");
      setNote("งานทดลองใช้รหัส 123, 456, 789 หรือ 111");
      return;
    }
    setJobId(match.jobId);
    setJobInput(match.jobId);
    setStep("");
    setBlocked([]);
    setNote(null);
  }

  async function openScanner(target: ScanTarget) {
    if (running) return;
    if (target === "badge" && loadState !== "ready") return;
    const result = await acquireCameraStream("environment");
    if ("errorInfo" in result) {
      setNote(
        result.errorInfo.hint
          ? `${result.errorInfo.message} — ${result.errorInfo.hint}`
          : result.errorInfo.message,
      );
      return;
    }
    setNote(null);
    setScanTarget(target);
    setScannerStream(result.stream);
  }

  function closeScanner() {
    setScannerStream(null);
    setScanTarget(null);
  }

  function handleScanned(text: string) {
    if (scanTarget === "badge") applyBadgeCode(text);
    else applyJobCode(text);
    closeScanner();
  }

  function startWork() {
    if (!worker || !selected || running) return;
    if (!step) {
      setNote("เลือกขั้นตอนก่อน");
      return;
    }
    const gate = canStartTrial({
      runs,
      jobId: selected.jobId,
      flow: selected.flow,
      step,
      employeeId: worker.id,
    });
    if (!gate.ok) {
      setNote(gate.message);
      setBlocked(gate.blocked);
      return;
    }
    setBlocked([]);
    persist([
      ...runs,
      {
        jobId: selected.jobId,
        flow: selected.flow.id,
        step,
        employeeId: worker.id,
        employeeName: worker.name,
        status: "running",
        startedAt: Date.now(),
        finishedAt: null,
      },
    ]);
    setNote(null);
    setNow(Date.now());
  }

  function finishWork() {
    if (!mine) return;
    persist(
      runs.map((run) => (run === mine ? { ...run, status: "done", finishedAt: Date.now() } : run)),
    );
    setStep("");
    setBlocked([]);
    setNote(null);
  }

  const shown = worker ? splitName(worker.name) : null;
  const jobRuns = runs.filter((run) => run.jobId === jobId);

  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
        แอปทดลอง ไม่บันทึกงานจริง และไม่เกี่ยวกับหน้าสแกนที่ใช้อยู่
      </div>
      <div className="rounded-[2rem] border-4 border-slate-800 bg-slate-800 p-1.5 shadow-lg">
        <div className="relative flex min-h-[40rem] flex-col overflow-hidden rounded-[1.5rem] bg-background">
          <div className="flex items-center justify-between bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground">
            <span>ทดลองสแกน</span>
            <span>ไม่ลงงานจริง</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {!worker ? (
              <>
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-4 py-8 text-center">
                  <CreditCard className="h-10 w-10 text-primary" />
                  <p className="text-sm font-semibold">สแกนบัตรพนักงาน</p>
                  <p className="text-[11px] text-muted-foreground">
                    สแกนเลขบนบัตร แล้วชื่อจะขึ้นเอง
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openScanner("badge")}
                  disabled={loadState !== "ready"}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 text-base font-bold text-white shadow disabled:opacity-50"
                >
                  <ScanLine className="h-5 w-5" />
                  {loadState === "loading" ? "กำลังโหลดรายชื่อ" : "สแกนบัตร"}
                </button>
                <div className="flex gap-1.5">
                  <input
                    value={codeInput}
                    onChange={(event) => setCodeInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyBadgeCode(codeInput);
                    }}
                    placeholder="หรือพิมพ์เลขพนักงาน"
                    inputMode="numeric"
                    className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => applyBadgeCode(codeInput)}
                    aria-label="ยืนยันเลขพนักงาน"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sky-700">
                  {worker.avatar_url ? (
                    <img
                      src={worker.avatar_url}
                      alt={shown?.nickname ?? shown?.name ?? ""}
                      className="h-12 w-12 shrink-0 rounded-full object-cover object-top"
                    />
                  ) : (
                    <UserRound className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {shown?.nickname ?? shown?.name}
                    </p>
                    <p className="truncate text-[11px] opacity-80">{worker.emp_code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorker(null)}
                    disabled={running}
                    className="min-h-11 shrink-0 px-1 text-xs font-semibold underline disabled:no-underline disabled:opacity-40"
                  >
                    เปลี่ยนคน
                  </button>
                </div>

                <div className="rounded-2xl border bg-card p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <QrCode className="h-3.5 w-3.5" /> รหัสงาน (JOB ID)
                  </p>
                  {selected ? (
                    <>
                      <p className="mt-1.5 text-lg font-bold text-primary">{selected.jobId}</p>
                      <p className="text-[11px] font-semibold">{selected.flow.label}</p>
                    </>
                  ) : (
                    <p className="mt-1.5 text-[11px] font-medium leading-snug text-destructive">
                      ยังไม่มีรหัสงาน — กดปุ่ม &quot;สแกน QR&quot; หรือกรอกด้วยตัวเอง
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void openScanner("job")}
                    disabled={running}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-40"
                  >
                    <ScanLine className="h-4 w-4" /> สแกน QR
                  </button>
                  <div className="mt-2 flex gap-1.5">
                    <input
                      value={jobInput}
                      disabled={running}
                      onChange={(event) => setJobInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyJobCode(jobInput);
                      }}
                      placeholder="หรือพิมพ์รหัสงาน เช่น 123"
                      className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-[11px] disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() => applyJobCode(jobInput)}
                      disabled={running}
                      aria-label="ยืนยันรหัสงาน"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {selected && (
                  <>
                    <label className="block">
                      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <ListChecks className="h-3.5 w-3.5" /> ขั้นตอน {selected.flow.label}
                      </span>
                      <select
                        value={running ? (mine?.step ?? "") : step}
                        disabled={running}
                        onChange={(event) => {
                          setStep(event.target.value);
                          setBlocked([]);
                          setNote(null);
                        }}
                        className="h-12 w-full rounded-xl border bg-card px-3 text-sm font-semibold disabled:opacity-60"
                      >
                        <option value="">เลือกขั้นตอน</option>
                        {steps.map((name) => {
                          const row = jobRuns.find((run) => run.step === name);
                          const mark =
                            row?.status === "done"
                              ? " · จบแล้ว"
                              : row?.status === "running"
                                ? " · กำลังทำ"
                                : "";
                          return (
                            <option key={name} value={name}>
                              {stepLabel(name)}
                              {mark}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={startWork}
                      disabled={running}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 text-base font-bold text-white shadow disabled:opacity-50"
                    >
                      <Play className="h-5 w-5" /> เริ่มงาน
                    </button>

                    {running && mine && (
                      <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-700">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Clock className="h-4 w-4" /> {stepLabel(mine.step)}
                        </span>
                        <span className="font-mono text-xl font-bold tabular-nums">
                          {clockLabel(mine.startedAt, now)}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={finishWork}
                      disabled={!running}
                      className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white ${running ? "bg-slate-900" : "bg-slate-400"}`}
                    >
                      <Square className="h-5 w-5 fill-current" /> เสร็จงาน
                    </button>

                    <ul className="space-y-1 text-[11px]">
                      {steps.map((name) => {
                        const row = jobRuns.find((run) => run.step === name);
                        const done = row?.status === "done";
                        const held = blocked.includes(name);
                        const label = done ? "จบ" : row?.status === "running" ? "กำลังทำ" : "รอ";
                        const tone = done
                          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                          : held
                            ? "border-red-300 bg-red-100 text-red-800"
                            : "border-transparent bg-muted/50";
                        return (
                          <li
                            key={name}
                            className={`flex min-h-9 items-center justify-between gap-2 rounded-lg border px-2 py-1 ${tone}`}
                          >
                            <span className="truncate">{stepLabel(name)}</span>
                            <span className="flex shrink-0 items-center gap-1 font-semibold">
                              {done && <Check className="h-3.5 w-3.5" aria-hidden />}
                              {label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
            {note && <p className="text-center text-xs font-medium text-destructive">{note}</p>}
            {loadState === "error" && (
              <p className="text-center text-xs font-medium text-destructive">
                โหลดรายชื่อไม่สำเร็จ
              </p>
            )}
          </div>
        </div>
      </div>
      <QrScannerDialog
        open={scannerStream !== null}
        onOpenChange={(open) => {
          if (!open) closeScanner();
        }}
        onScanned={handleScanned}
        initialStream={scannerStream}
      />
    </div>
  );
}
