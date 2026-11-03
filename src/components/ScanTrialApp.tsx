import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  canStartTrial,
  flowSteps,
  loadTrialRuns,
  saveTrialRuns,
  TRIAL_JOBS,
  trialJob,
  type TrialRun,
} from "@/lib/scan-trial";
import {
  Check,
  Clock,
  CreditCard,
  ListChecks,
  Play,
  ScanLine,
  Square,
  UserRound,
  X,
} from "lucide-react";

type Employee = { id: string; name: string; emp_code: string | null };

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

export function ScanTrialApp() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [worker, setWorker] = useState<Employee | null>(null);
  const [jobId, setJobId] = useState("123");
  const [step, setStep] = useState("");
  const [runs, setRuns] = useState<TrialRun[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [codeInput, setCodeInput] = useState("");

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
        .select("id,name,emp_code")
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (person) =>
        person.name.toLowerCase().includes(q) || (person.emp_code ?? "").toLowerCase().includes(q),
    );
  }, [employees, query]);

  function persist(next: TrialRun[]) {
    saveTrialRuns(next);
    setRuns(next);
  }

  function assignWorker(person: Employee) {
    if (running) return;
    setWorker(person);
    setPicking(false);
    setQuery("");
    setCodeInput("");
    setNote(null);
  }

  function applyCode() {
    const code = codeInput.trim();
    const person = employees.find((row) => (row.emp_code ?? "").trim() === code);
    if (!person) {
      setNote("ไม่พบเลขพนักงานนี้");
      return;
    }
    assignWorker(person);
  }

  function pickJob(nextJob: string) {
    if (running) return;
    setJobId(nextJob);
    setStep("");
    setNote(null);
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
      return;
    }
    const next: TrialRun = {
      jobId: selected.jobId,
      flow: selected.flow.id,
      step,
      employeeId: worker.id,
      employeeName: worker.name,
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
    };
    persist([...runs, next]);
    setNote(null);
    setNow(Date.now());
  }

  function finishWork() {
    if (!mine) return;
    persist(
      runs.map((run) => (run === mine ? { ...run, status: "done", finishedAt: Date.now() } : run)),
    );
    setStep("");
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
          <div className="flex flex-1 flex-col gap-3 p-4">
            {!worker ? (
              <>
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-4 text-center">
                  <CreditCard className="h-10 w-10 text-primary" />
                  <p className="text-sm font-semibold">สแกนบัตรพนักงาน</p>
                  <p className="text-[11px] text-muted-foreground">ชื่อค้างจนกว่าจะกดเปลี่ยนคน</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
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
                      if (event.key === "Enter") applyCode();
                    }}
                    placeholder="หรือพิมพ์เลขพนักงาน"
                    inputMode="numeric"
                    className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyCode}
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
                  <UserRound className="h-4 w-4 shrink-0" />
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

                <div>
                  <p className="mb-1 text-[11px] font-semibold text-muted-foreground">งานทดลอง</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TRIAL_JOBS.map((job) => {
                      const flow = trialJob(job.jobId)?.flow;
                      const active = job.jobId === jobId;
                      return (
                        <button
                          key={job.jobId}
                          type="button"
                          disabled={running}
                          onClick={() => pickJob(job.jobId)}
                          className={`min-h-11 rounded-xl border px-2 py-1.5 text-left disabled:opacity-60 ${active ? "border-sky-500 bg-sky-50" : "bg-card"}`}
                        >
                          <span className="block font-mono text-sm font-bold">{job.jobId}</span>
                          <span className="block truncate text-[11px]">{flow?.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" /> ขั้นตอน {selected?.flow.label}
                  </span>
                  <select
                    value={running ? (mine?.step ?? "") : step}
                    disabled={running}
                    onChange={(event) => {
                      setStep(event.target.value);
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
                          {name}
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
                      <Clock className="h-4 w-4" /> {mine.step}
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
                    const label =
                      row?.status === "done" ? "จบ" : row?.status === "running" ? "กำลังทำ" : "รอ";
                    return (
                      <li
                        key={name}
                        className="flex justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1"
                      >
                        <span className="truncate">{name}</span>
                        <span className="shrink-0 font-semibold">{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {note && <p className="text-center text-xs font-medium text-destructive">{note}</p>}
            {loadState === "error" && (
              <p className="text-center text-xs font-medium text-destructive">
                โหลดรายชื่อไม่สำเร็จ
              </p>
            )}
          </div>

          {picking && (
            <div className="absolute inset-0 z-10 flex flex-col bg-background">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <p className="text-sm font-semibold">เลือกพนักงานทดลอง</p>
                <button
                  type="button"
                  onClick={() => setPicking(false)}
                  aria-label="ปิด"
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นชื่อหรือเลขพนักงาน"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {filtered.map((person) => {
                  const parts = splitName(person.name);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => assignWorker(person)}
                      className="mb-1.5 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left"
                    >
                      <span className="truncate text-sm font-semibold">
                        {parts.nickname ?? parts.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs">{person.emp_code ?? "—"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
