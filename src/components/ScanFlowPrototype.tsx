import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  CreditCard,
  Layers,
  ListChecks,
  Play,
  QrCode,
  ScanLine,
  Square,
  UserRound,
  X,
} from "lucide-react";

type Employee = { id: string; name: string; emp_code: string | null };
type Named = { id: string; name: string };
type Step = Named & { step_name: string };

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

export function ScanFlowPrototype() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Named[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [worker, setWorker] = useState<Employee | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [stepId, setStepId] = useState("");
  const [jobId, setJobId] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [jobInput, setJobInput] = useState("");
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [hasIssue, setHasIssue] = useState(false);
  const [issueNote, setIssueNote] = useState("");
  const [issuePhoto, setIssuePhoto] = useState<string | null>(null);
  const issueFileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [employeeRes, stepRes, categoryRes] = await Promise.all([
        supabase.from("employees").select("id,name,emp_code").eq("active", true).order("name"),
        supabase.from("steps").select("id,step_name").eq("active", true).order("step_name"),
        supabase.from("categories").select("id,name").eq("active", true).order("name"),
      ]);
      if (cancelled) return;
      if (employeeRes.error || stepRes.error || categoryRes.error) {
        setLoadState("error");
        return;
      }
      setEmployees(employeeRes.data ?? []);
      setSteps(
        (stepRes.data ?? []).map((row) => ({
          id: row.id,
          name: row.step_name,
          step_name: row.step_name,
        })),
      );
      setCategories(categoryRes.data ?? []);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (runningSince == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [runningSince]);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(id);
  }, [saved]);

  const running = runningSince != null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (person) =>
        person.name.toLowerCase().includes(q) || (person.emp_code ?? "").toLowerCase().includes(q),
    );
  }, [employees, query]);

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
    if (!code) {
      setNote("พิมพ์เลขพนักงานก่อน");
      return;
    }
    const person = employees.find((row) => (row.emp_code ?? "").trim() === code);
    if (!person) {
      setNote("ไม่พบเลขพนักงานนี้");
      return;
    }
    assignWorker(person);
  }

  function applyJob() {
    if (running) return;
    const next = jobInput.trim();
    if (!next) {
      setNote("พิมพ์รหัสงานก่อน");
      return;
    }
    setJobId(next);
    setNote(null);
  }

  function simulateJobScan() {
    if (running) return;
    const sample = `JOB${100 + Math.floor(Math.random() * 900)}`;
    setJobId(sample);
    setJobInput(sample);
    setNote(null);
  }

  function startWork() {
    if (running) return;
    if (!categoryId) {
      setNote("เลือกหมวดก่อน");
      return;
    }
    if (!stepId) {
      setNote("เลือกขั้นตอนก่อน");
      return;
    }
    if (!jobId) {
      setNote("สแกนหรือพิมพ์รหัสงานก่อน");
      return;
    }
    setNote(null);
    setSaved(false);
    setRunningSince(Date.now());
    setNow(Date.now());
  }

  function clearIssue() {
    setHasIssue(false);
    setIssueNote("");
    setIssuePhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (issueFileRef.current) issueFileRef.current.value = "";
  }

  function pickIssuePhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      setNote("ใช้ไฟล์รูปเท่านั้น");
      return;
    }
    setNote(null);
    const url = URL.createObjectURL(file);
    setIssuePhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  function finishWork() {
    if (!running) return;
    if (hasIssue && !issueNote.trim()) {
      setNote("กรุณากรอกหมายเหตุก่อนจบงาน");
      return;
    }
    setRunningSince(null);
    setJobId("");
    setJobInput("");
    setNote(null);
    clearIssue();
    setSaved(true);
  }

  function changePerson() {
    if (running) return;
    setWorker(null);
    setJobId("");
    setJobInput("");
    setSaved(false);
    setNote(null);
  }

  const shown = worker ? splitName(worker.name) : null;

  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <div className="rounded-[2rem] border-4 border-slate-800 bg-slate-800 p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-600">
        <div className="relative flex min-h-[40rem] flex-col overflow-hidden rounded-[1.5rem] bg-background">
          <div className="flex items-center justify-between bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground">
            <span>WSC ProductionTrack</span>
            <span>🇹🇭 ไทย</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            {!worker ? (
              <>
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-4 text-center">
                  <CreditCard className="h-10 w-10 text-primary" />
                  <p className="text-sm font-semibold">สแกนบัตรพนักงาน</p>
                  <p className="text-[11px] text-muted-foreground">
                    แทนการกดเลือกชื่อ ชื่อจะค้างทั้งวัน
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNote(null);
                    setPicking(true);
                  }}
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
                <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  <UserRound className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {shown?.nickname ?? shown?.name} · ค้างทั้งวันนี้
                    </p>
                    <p className="truncate text-[11px] opacity-80">
                      {shown?.nickname ? shown.name : worker.emp_code}
                      {shown?.nickname && worker.emp_code ? ` · ${worker.emp_code}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={changePerson}
                    disabled={running}
                    className="min-h-11 shrink-0 px-1 text-xs font-semibold underline-offset-2 hover:underline disabled:no-underline disabled:opacity-40"
                  >
                    เปลี่ยนคน
                  </button>
                </div>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" /> หมวดหมู่งานม่าน
                  </span>
                  <select
                    value={categoryId}
                    disabled={running}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setNote(null);
                    }}
                    className="h-12 w-full rounded-xl border bg-card px-3 text-sm font-semibold disabled:opacity-60"
                  >
                    <option value="">เลือกหมวด</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" /> ขั้นตอนการผลิต
                  </span>
                  <select
                    value={stepId}
                    disabled={running}
                    onChange={(event) => {
                      setStepId(event.target.value);
                      setNote(null);
                    }}
                    className="h-12 w-full rounded-xl border bg-card px-3 text-sm font-semibold disabled:opacity-60"
                  >
                    <option value="">เลือกขั้นตอน</option>
                    {steps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.step_name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border bg-card p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <QrCode className="h-3.5 w-3.5" /> รหัสงาน (JOB ID)
                  </p>
                  {jobId ? (
                    <p className="mt-1.5 text-lg font-bold text-primary">{jobId}</p>
                  ) : (
                    <p className="mt-1.5 text-[11px] font-medium leading-snug text-destructive">
                      ยังไม่มีรหัสงาน — กดปุ่ม &quot;สแกน QR&quot; หรือกรอกด้วยตัวเอง
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={simulateJobScan}
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
                        if (event.key === "Enter") applyJob();
                      }}
                      placeholder="หรือพิมพ์รหัสงาน เช่น JOB123"
                      className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-[11px] disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={applyJob}
                      disabled={running}
                      aria-label="ยืนยันรหัสงาน"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startWork}
                  disabled={running}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 text-base font-bold text-white shadow disabled:opacity-50"
                >
                  <Play className="h-5 w-5" /> เริ่มงาน
                </button>

                {running && runningSince != null && (
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <Clock className="h-4 w-4" /> กำลังจับเวลา
                    </span>
                    <span className="font-mono text-xl font-bold tabular-nums">
                      {clockLabel(runningSince, now)}
                    </span>
                  </div>
                )}

                <div className="rounded-2xl border bg-card p-3">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasIssue}
                      onChange={(event) => {
                        setHasIssue(event.target.checked);
                        setNote(null);
                      }}
                      className="h-5 w-5 accent-red-600"
                    />
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      มีปัญหา? เพิ่มหมายเหตุก่อนจบงาน
                    </span>
                  </label>
                  {hasIssue && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={issueNote}
                        onChange={(event) => {
                          setIssueNote(event.target.value);
                          setNote(null);
                        }}
                        placeholder="อธิบายปัญหาที่พบ…"
                        rows={3}
                        maxLength={1000}
                        className="w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                      />
                      <input
                        ref={issueFileRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) pickIssuePhoto(file);
                        }}
                      />
                      {issuePhoto ? (
                        <div>
                          <div className="relative">
                            <img
                              src={issuePhoto}
                              alt="รูปปัญหา"
                              className="h-36 w-full rounded-lg border object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIssuePhoto((prev) => {
                                  if (prev) URL.revokeObjectURL(prev);
                                  return null;
                                })
                              }
                              aria-label="ลบรูปหมายเหตุ"
                              className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 shadow"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => issueFileRef.current?.click()}
                            className="mt-2 flex h-11 w-full items-center justify-center gap-1 rounded-xl border text-sm font-semibold"
                          >
                            <Camera className="h-4 w-4" /> เปลี่ยนรูป
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => issueFileRef.current?.click()}
                          className="flex h-11 w-full items-center justify-center gap-1 rounded-xl border text-sm font-semibold"
                        >
                          <Camera className="h-4 w-4" /> เพิ่มรูปภาพ
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={finishWork}
                  disabled={!running}
                  className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white ${running ? "bg-slate-900" : "bg-slate-400"}`}
                >
                  <Square className="h-5 w-5 fill-current" /> เสร็จงาน
                </button>

                {saved && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    บันทึกการเสร็จงานเรียบร้อย
                  </div>
                )}
              </>
            )}
            {note && <p className="text-center text-xs font-medium text-destructive">{note}</p>}
            {loadState === "error" && (
              <p className="text-center text-xs font-medium text-destructive">
                โหลดรายชื่อไม่สำเร็จ ลองรีเฟรชหน้า
              </p>
            )}
          </div>

          {picking && (
            <div className="absolute inset-0 z-10 flex flex-col bg-background">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <p className="text-sm font-semibold">จำลองสแกนบัตร</p>
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
                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบชื่อนี้</p>
                ) : (
                  filtered.map((person) => {
                    const parts = splitName(person.name);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => assignWorker(person)}
                        className="mb-1.5 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left hover:bg-muted/60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {parts.nickname ?? parts.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {parts.nickname ? parts.name : "ไม่มีชื่อเล่น"}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-xs">{person.emp_code ?? "—"}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        กดลองเล่นได้ ยังไม่บันทึกงานลงระบบ
      </p>
    </div>
  );
}
