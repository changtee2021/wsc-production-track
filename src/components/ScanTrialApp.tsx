import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import {
  canStartTrial,
  flowSteps,
  loadTrialRuns,
  saveTrialRuns,
  stepLabel,
  TRIAL_FLOWS,
  trialJob,
  type TrialFlowId,
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
  X,
} from "lucide-react";

type Employee = {
  id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  department: "production" | "office";
};
type ScanTarget = "badge" | "job";

function splitName(full: string): { name: string; nickname: string | null } {
  const match = full.trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return match
    ? { name: match[1].trim(), nickname: match[2].trim() }
    : { name: full.trim(), nickname: null };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

const INTAKE_KEY = "wsc:scan-trial:intake:v1";

function loadIntake(): { batch: string[]; saved: string[] } {
  if (typeof window === "undefined") return { batch: [], saved: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INTAKE_KEY) ?? "") as {
      batch?: string[];
      saved?: string[];
    };
    return {
      batch: Array.isArray(parsed.batch) ? parsed.batch : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
    };
  } catch {
    return { batch: [], saved: [] };
  }
}

function saveIntake(batch: string[], saved: string[]) {
  window.localStorage.setItem(INTAKE_KEY, JSON.stringify({ batch, saved }));
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
  const [batch, setBatch] = useState<string[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [choosingProduct, setChoosingProduct] = useState(false);
  const [batchProduct, setBatchProduct] = useState<TrialFlowId | null>(null);
  const flashTimer = useRef<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const selected = trialJob(jobId);
  const steps = selected ? flowSteps(selected.flow) : [];
  const mine = runs.find(
    (run) => run.employeeId === worker?.id && run.jobId === jobId && run.status === "running",
  );
  const running = mine != null;

  useEffect(() => {
    const intake = loadIntake();
    setBatch(intake.batch);
    setSavedJobs(intake.saved);
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
      const [production, office] = await Promise.all([
        supabase
          .from("employees")
          .select("id,name,emp_code,avatar_url")
          .eq("active", true)
          .order("name"),
        supabase
          .from("office_employees")
          .select("id,name,emp_code,avatar_url")
          .eq("active", true)
          .order("name"),
      ]);
      if (cancelled) return;
      if (production.error || office.error) {
        setLoadState("error");
        return;
      }
      setEmployees([
        ...(production.data ?? []).map((row) => ({ ...row, department: "production" as const })),
        ...(office.data ?? []).map((row) => ({ ...row, department: "office" as const })),
      ]);
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

  function markDuplicate(code: string) {
    setNote("สแกนแล้ว");
    setFlashId(code);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setFlashId((current) => (current === code ? null : current));
    }, 2000);
    window.requestAnimationFrame(() => {
      rowRefs.current.get(code)?.scrollIntoView({ block: "nearest" });
    });
  }

  function addIntake(raw: string) {
    const code = readJobCode(raw);
    if (!code) {
      setNote("สแกนหรือพิมพ์รหัสงานก่อน");
      return;
    }
    if (batch.includes(code) || savedJobs.includes(code)) {
      markDuplicate(code);
      return;
    }
    const next = [...batch, code];
    setBatch(next);
    saveIntake(next, savedJobs);
    setJobInput("");
    setFlashId(null);
    setNote(null);
  }

  function removeIntake(code: string) {
    const next = batch.filter((id) => id !== code);
    setBatch(next);
    saveIntake(next, savedJobs);
  }

  function confirmBatch() {
    if (!batch.length || !batchProduct) {
      setNote("เลือกสินค้าของชุดนี้ก่อน");
      return;
    }
    const nextSaved = [...savedJobs, ...batch];
    setSavedJobs(nextSaved);
    setBatch([]);
    saveIntake([], nextSaved);
    setChoosingProduct(false);
    setBatchProduct(null);
    setNote(`บันทึกแล้ว ${batch.length} ใบ`);
  }

  function handleScanned(text: string) {
    if (scanTarget === "badge") applyBadgeCode(text);
    else if (worker?.department === "office") addIntake(text);
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
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-200 text-sm font-bold">
                      {initials(worker.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {shown?.nickname ?? shown?.name}
                    </p>
                    <p className="truncate text-[11px] opacity-80">
                      {worker.emp_code}
                      {worker.department === "office" ? " · ออฟฟิศ" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWorker(null);
                      setJobInput("");
                      setNote(null);
                    }}
                    disabled={running}
                    className="min-h-11 shrink-0 px-1 text-xs font-semibold underline disabled:no-underline disabled:opacity-40"
                  >
                    เปลี่ยนคน
                  </button>
                </div>

                {worker.department === "office" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">รับออเดอร์</p>
                      <p className="text-sm font-bold">{batch.length} ใบ</p>
                    </div>
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {flashId && !batch.includes(flashId) && (
                        <li className="rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                          {flashId} · สแกนแล้ว
                        </li>
                      )}
                      {batch.map((code) => (
                        <li
                          key={code}
                          ref={(node) => {
                            if (node) rowRefs.current.set(code, node);
                            else rowRefs.current.delete(code);
                          }}
                          className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border-2 px-2 text-sm ${flashId === code ? "border-red-500 bg-red-50 font-semibold text-red-700" : "border-transparent bg-muted/50"}`}
                        >
                          <span className="truncate">{code}</span>
                          <button
                            type="button"
                            onClick={() => removeIntake(code)}
                            aria-label="เอาใบนี้ออก"
                            className="flex h-11 w-11 shrink-0 items-center justify-center"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => void openScanner("job")}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white"
                    >
                      <ScanLine className="h-5 w-5" /> สแกน QR
                    </button>
                    <div className="flex gap-1.5">
                      <input
                        value={jobInput}
                        onChange={(event) => setJobInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") addIntake(jobInput);
                        }}
                        placeholder="หรือพิมพ์รหัสงาน"
                        className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => addIntake(jobInput)}
                        aria-label="เพิ่มรหัสงาน"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                    {!choosingProduct ? (
                      <button
                        type="button"
                        disabled={batch.length === 0}
                        onClick={() => {
                          setChoosingProduct(true);
                          setNote(null);
                        }}
                        className="flex h-14 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold text-white disabled:opacity-40"
                      >
                        ชุดนี้ครบแล้ว
                      </button>
                    ) : (
                      <>
                        <p className="text-sm font-semibold">เลือกสินค้าทั้งชุด</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {TRIAL_FLOWS.map((flow) => (
                            <button
                              key={flow.id}
                              type="button"
                              onClick={() => setBatchProduct(flow.id)}
                              className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${batchProduct === flow.id ? "border-sky-500 bg-sky-50" : "bg-card"}`}
                            >
                              {flow.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={confirmBatch}
                          className="flex h-14 items-center justify-center rounded-2xl bg-sky-500 text-base font-bold text-white"
                        >
                          ยืนยัน
                        </button>
                        <button
                          type="button"
                          onClick={() => setChoosingProduct(false)}
                          className="flex h-11 items-center justify-center rounded-xl border text-sm font-semibold"
                        >
                          สแกนเพิ่ม
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
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
                            const label = done
                              ? "จบ"
                              : row?.status === "running"
                                ? "กำลังทำ"
                                : "รอ";
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
              </>
            )}
            {note && (
              <p
                className={`text-center text-xs font-medium ${note.startsWith("บันทึกแล้ว") ? "text-emerald-700" : "text-destructive"}`}
              >
                {note}
              </p>
            )}
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
