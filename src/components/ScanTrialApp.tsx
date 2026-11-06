import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { BatchStepPanel } from "@/components/BatchStepPanel";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { Button } from "@/components/ui/button";
import { TrialEndPanel } from "@/components/TrialEndPanel";
import {
  BATCH_STEP_LABELS,
  BATCH_STEPS,
  canUseBatchScan,
  canStartTrial,
  floorFlowSteps,
  isBatchStep,
  flowById,
  WOOD_ISSUE_QC_ITEMS,
  WOOD_ISSUE_QC_STEP,
  loadTrialRuns,
  mergeTrialRuns,
  nextTrialSteps,
  saveTrialRuns,
  stepLabel,
  TRIAL_FLOWS,
  type BatchStep,
  type TrialBadgePerson,
  type TrialFlowId,
  type TrialRun,
} from "@/lib/scan-trial";
import {
  listMyTrialBatch,
  listTrialJobRuns,
  listTrialStaff,
  lookupTrialRelease,
  releaseTrialJobs,
  saveTrialRun,
} from "@/lib/scan-trial.functions";
import { AppVersion } from "@/components/AppVersion";
import { loadHomeActor } from "@/lib/home-actor";
import { collectFreshJobCodes, intakeReviewNote, readJobCode } from "@/lib/intake-codes";
import { decodeQrCodes } from "@/lib/qr-image";
import { SEQUENTIAL_SCAN_ENABLED } from "@/lib/sequential-scan";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  ImagePlus,
  ListChecks,
  Loader2,
  Play,
  QrCode,
  ScanLine,
  Send,
  Square,
  X,
} from "lucide-react";

type Employee = TrialBadgePerson;
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
const FLOW_IDS = new Set(TRIAL_FLOWS.map((flow) => flow.id));

type IntakeSet = {
  id: string;
  product: TrialFlowId | null;
  codes: string[];
  sent: boolean;
  sentAt: string | null;
};

function productLabel(id: TrialFlowId | null): string {
  if (!id) return "ชุดที่บันทึกไว้";
  return TRIAL_FLOWS.find((flow) => flow.id === id)?.label ?? id;
}

function bangkokDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sentStillToday(sentAt: string | null, now = new Date()): boolean {
  if (!sentAt) return false;
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return false;
  return bangkokDay(sent) === bangkokDay(now);
}

function formatSentAt(sentAt: string): string {
  return new Date(sentAt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function asIntakeSet(value: unknown): IntakeSet | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    id?: unknown;
    product?: unknown;
    codes?: unknown;
    sent?: unknown;
    sentAt?: unknown;
  };
  if (typeof row.id !== "string") return null;
  const codes = Array.isArray(row.codes)
    ? row.codes.filter((code): code is string => typeof code === "string" && code.trim() !== "")
    : [];
  if (!codes.length) return null;
  const product =
    typeof row.product === "string" && FLOW_IDS.has(row.product as TrialFlowId)
      ? (row.product as TrialFlowId)
      : null;
  const sentAt = typeof row.sentAt === "string" ? row.sentAt : null;
  const sent = row.sent === true;
  if (sent && !sentStillToday(sentAt)) return null;
  return { id: row.id, product, codes, sent, sentAt };
}

function loadIntake(): { batch: string[]; sets: IntakeSet[] } {
  if (typeof window === "undefined") return { batch: [], sets: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INTAKE_KEY) ?? "") as {
      batch?: string[];
      saved?: string[];
      sets?: unknown[];
    };
    const batch = Array.isArray(parsed.batch)
      ? parsed.batch.filter((code): code is string => typeof code === "string")
      : [];
    if (Array.isArray(parsed.sets)) {
      return { batch, sets: parsed.sets.flatMap((row) => asIntakeSet(row) ?? []) };
    }
    const saved = Array.isArray(parsed.saved)
      ? parsed.saved.filter(
          (code): code is string => typeof code === "string" && code.trim() !== "",
        )
      : [];
    return {
      batch,
      sets: [],
    };
  } catch {
    return { batch: [], sets: [] };
  }
}

function saveIntake(batch: string[], sets: IntakeSet[]) {
  window.localStorage.setItem(INTAKE_KEY, JSON.stringify({ batch, sets }));
}

function clockLabel(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ScanTrialApp({
  initialJobId = "",
  desk = "floor",
}: {
  initialJobId?: string;
  desk?: "office" | "floor";
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [worker, setWorker] = useState<Employee | null>(null);
  const [jobId, setJobId] = useState("");
  const [jobFlow, setJobFlow] = useState<TrialFlowId | null>(null);
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
  const [sets, setSets] = useState<IntakeSet[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState("สแกนแล้ว");
  const [sending, setSending] = useState(false);
  const [choosingProduct, setChoosingProduct] = useState(false);
  const [batchProduct, setBatchProduct] = useState<TrialFlowId | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [woodQcMode, setWoodQcMode] = useState<"issue" | "final">("issue");
  const navigate = useNavigate();
  const flashTimer = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [batchStep, setBatchStep] = useState<BatchStep | null>(null);
  const [batchLocked, setBatchLocked] = useState(false);
  const [batchDraftCount, setBatchDraftCount] = useState(0);
  const seededJob = useRef("");
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const setRefs = useRef(new Map<string, HTMLLIElement>());
  const lookupRelease = useServerFn(lookupTrialRelease);
  const releaseJobs = useServerFn(releaseTrialJobs);
  const listStaff = useServerFn(listTrialStaff);
  const publishRun = useServerFn(saveTrialRun);
  const listJobRuns = useServerFn(listTrialJobRuns);
  const listMine = useServerFn(listMyTrialBatch);

  const flow = jobFlow ? flowById(jobFlow) : null;
  const selected = jobId && flow ? { jobId, flow } : null;
  const showOffice = desk === "office" || worker?.department === "office";
  const endDesk =
    worker?.department === "qc" ||
    worker?.department === "packing" ||
    worker?.department === "final";
  const batchDesk = Boolean(worker) && !endDesk && canUseBatchScan(worker?.emp_code);
  const steps = selected ? floorFlowSteps(selected.flow) : [];
  const woodQcDesk =
    selected?.flow.id === "wood" &&
    (worker?.department === "qc" || (worker?.department === "final" && step === "QC"));
  const mine = runs.find(
    (run) => run.employeeId === worker?.id && run.jobId === jobId && run.status === "running",
  );
  const running = mine != null;

  useEffect(() => {
    const intake = loadIntake();
    setBatch(intake.batch);
    setSets(intake.sets);
    saveIntake(intake.batch, intake.sets);
    setRuns(loadTrialRuns());
    const onStorage = (event: StorageEvent) => {
      if (event.key === "wsc:scan-trial:v1") setRuns(loadTrialRuns());
    };
    window.addEventListener("storage", onStorage);
    const tick = window.setInterval(() => {
      setSets((current) => {
        const next = current.filter((row) => !row.sent || sentStillToday(row.sentAt));
        if (next.length === current.length) return current;
        const stored = loadIntake();
        saveIntake(stored.batch, next);
        return next;
      });
    }, 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roster = await listStaff({ data: {} });
        if (cancelled) return;
        setEmployees(roster.rows);
        setLoadState("ready");
        const actor = loadHomeActor();
        if (actor) {
          const person = roster.rows.find((row) => (row.emp_code ?? "").trim() === actor.empCode);
          if (person) setWorker(person);
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listStaff]);

  useEffect(() => {
    if (SEQUENTIAL_SCAN_ENABLED || desk !== "office" || !worker) return;
    if (worker.department === "office" || loadHomeActor()?.office === true) return;
    void navigate({ to: "/scan", search: { job_id: "" }, replace: true });
  }, [desk, navigate, worker]);

  useEffect(() => {
    setStepsOpen(false);
    setWoodQcMode("issue");
  }, [jobId]);

  const seenBatchWorker = useRef<string | null>(null);

  function pickBatch(step: BatchStep) {
    if (batchLocked) {
      setNote("ชุดนี้ล็อกแล้ว จบงานหรือให้แอดมินถอนก่อน");
      return;
    }
    if (batchStep === step) {
      if (batchDraftCount > 0 && !window.confirm("ปิดชุดนี้แล้ว ลิสต์ที่ยังไม่ยืนยันจะหาย")) return;
      setBatchStep(null);
      return;
    }
    if (
      batchStep &&
      batchDraftCount > 0 &&
      !window.confirm("เปลี่ยนจุดแล้ว ลิสต์ที่ยังไม่ยืนยันจะหาย")
    ) {
      return;
    }
    setBatchStep(step);
    setNote(null);
  }

  function pickGeneral() {
    if (batchLocked) {
      setNote("ชุดนี้ล็อกแล้ว จบงานหรือให้แอดมินถอนก่อน");
      return;
    }
    if (batchDraftCount > 0 && !window.confirm("ปิดชุดนี้แล้ว ลิสต์ที่ยังไม่ยืนยันจะหาย")) return;
    setBatchStep(null);
    setNote(null);
  }

  useEffect(() => {
    if (!worker || showOffice || endDesk || !canUseBatchScan(worker.emp_code)) {
      seenBatchWorker.current = null;
      setBatchStep(null);
      setBatchLocked(false);
      return;
    }
    if (seenBatchWorker.current !== worker.id) {
      seenBatchWorker.current = worker.id;
      setBatchStep(null);
      setBatchLocked(false);
    }
    let cancelled = false;
    void listMine({ data: { employeeId: worker.id } })
      .then((res) => {
        if (cancelled || !res.batch) return;
        setBatchStep(res.batch.step);
        setBatchLocked(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [worker, showOffice, endDesk, listMine]);

  useEffect(() => {
    if (worker?.department === "qc") setStep("QC");
    else if (worker?.department === "packing") setStep("PACK");
    else if (worker?.department === "final") setStep("");
  }, [worker?.id, worker?.department, jobId]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  function persist(next: TrialRun[]) {
    saveTrialRuns(next);
    setRuns(next);
  }

  function publish(run: TrialRun) {
    void publishRun({
      data: {
        jobId: run.jobId,
        flow: run.flow,
        step: run.step,
        employeeId: run.employeeId,
        employeeName: run.employeeName,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
    }).catch(() => {
      setNote("บันทึกขั้นตอนขึ้นไลน์ไม่สำเร็จ");
    });
  }

  async function pullJobRuns(code: string) {
    try {
      const remote = await listJobRuns({ data: { jobId: code } });
      setRuns((current) => {
        const next = mergeTrialRuns(current, remote.runs, code);
        saveTrialRuns(next);
        return next;
      });
    } catch {
      // Keep the copy already on this phone.
    }
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

  async function applyJobCode(raw: string) {
    if (running) return;
    const code = readJobCode(raw);
    if (!code) {
      setNote("สแกนหรือพิมพ์รหัสงานก่อน");
      return;
    }
    try {
      const known = await lookupRelease({ data: { jobId: code } });
      setJobId(code);
      setJobInput(code);
      setJobFlow(known.product);
      setStep("");
      setBlocked([]);
      setNote(known.product ? null : "ยังไม่ส่งเข้าไลน์ผลิต");
      void pullJobRuns(code);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "ตรวจรหัสงานไม่สำเร็จ");
    }
  }

  useEffect(() => {
    const code = initialJobId.trim();
    if (!code || seededJob.current === code) return;
    seededJob.current = code;
    void applyJobCode(code);
  }, [initialJobId]);

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

  function markDuplicate(code: string, message: string) {
    setNote(message);
    setFlashMessage(message);
    setFlashId(code);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setFlashId((current) => (current === code ? null : current));
    }, 2000);
    const owner = sets.find((row) => row.codes.includes(code));
    window.requestAnimationFrame(() => {
      if (owner) setRefs.current.get(owner.id)?.scrollIntoView({ block: "nearest" });
      else rowRefs.current.get(code)?.scrollIntoView({ block: "nearest" });
    });
  }

  async function addIntake(raw: string) {
    const code = readJobCode(raw);
    if (!code) {
      setNote("สแกนหรือพิมพ์รหัสงานก่อน");
      return;
    }
    if (batch.includes(code) || sets.some((row) => !row.sent && row.codes.includes(code))) {
      markDuplicate(code, "สแกนแล้ว");
      return;
    }
    if (sets.some((row) => row.sent && row.codes.includes(code))) {
      markDuplicate(code, "ส่งไลน์ผลิตแล้ว");
      return;
    }
    try {
      const known = await lookupRelease({ data: { jobId: code } });
      if (known.product) {
        markDuplicate(code, "ส่งไลน์ผลิตแล้ว");
        return;
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "ตรวจรหัสงานไม่สำเร็จ");
      return;
    }
    const next = [...batch, code];
    setBatch(next);
    saveIntake(next, sets);
    setJobInput("");
    setFlashId(null);
    setNote(null);
  }

  function removeIntake(code: string) {
    const next = batch.filter((id) => id !== code);
    setBatch(next);
    saveIntake(next, sets);
  }

  function parkBatch(product: TrialFlowId) {
    if (!batch.length) {
      setNote("สแกนรหัสงานก่อน");
      return;
    }
    const nextSets = [
      ...sets,
      { id: crypto.randomUUID(), product, codes: [...batch], sent: false, sentAt: null },
    ];
    setSets(nextSets);
    setBatch([]);
    saveIntake([], nextSets);
    setChoosingProduct(false);
    setBatchProduct(null);
    setNote(null);
    window.requestAnimationFrame(() => {
      setRefs.current.get(nextSets[nextSets.length - 1]?.id ?? "")?.scrollIntoView({
        block: "nearest",
      });
    });
  }

  async function editSet(id: string) {
    if (batch.length) {
      setNote("ชุดที่กำลังสแกนยังไม่เสร็จ เลือกสินค้าหรือเอาออกก่อน");
      return;
    }
    const target = sets.find((row) => row.id === id);
    if (!target) return;
    if (target.sent) {
      setNote("รายการที่ส่งแล้ว แก้ได้ที่หลังบ้านแอดมิน");
      return;
    }
    const nextSets = sets.filter((row) => row.id !== id);
    setSets(nextSets);
    setBatch(target.codes);
    saveIntake(target.codes, nextSets);
    setChoosingProduct(true);
    setBatchProduct(target.product);
    setNote("ดึงชุดนี้กลับมาแก้แล้ว สแกนต่อจากปุ่มสแกน QR แล้วกดยืนยัน");
  }

  function confirmProduct() {
    if (!batchProduct) {
      setNote("เลือกสินค้าของชุดนี้ก่อน");
      return;
    }
    parkBatch(batchProduct);
  }

  async function deleteSet(id: string) {
    const target = sets.find((row) => row.id === id);
    if (!target) return;
    const ok = window.confirm(`ลบชุด${productLabel(target.product)} ${target.codes.length} ใบ?`);
    if (!ok) return;
    if (target.sent) {
      setNote("รายการที่ส่งแล้ว ลบได้ที่หลังบ้านแอดมิน");
      return;
    }
    const nextSets = sets.filter((row) => row.id !== id);
    setSets(nextSets);
    saveIntake(batch, nextSets);
    setNote(null);
  }

  async function sendSets() {
    if (sending) return;
    const waiting = sets.filter((row) => !row.sent);
    if (!waiting.length) {
      setNote("ยังไม่มีชุดที่จะส่ง");
      return;
    }
    if (waiting.some((row) => !row.product)) {
      setNote("เลือกสินค้าของชุดนี้ก่อน");
      return;
    }
    const jobs = waiting.flatMap((row) =>
      row.codes.map((jobId) => ({ jobId, product: row.product as TrialFlowId })),
    );
    setSending(true);
    try {
      const released = await releaseJobs({ data: { jobs, sentByName: worker?.name ?? null } });
      const sentAt = released.sentAt;
      const nextSets = sets.map((row) => (row.sent ? row : { ...row, sent: true, sentAt }));
      setSets(nextSets);
      saveIntake(batch, nextSets);
      setSending(false);
      setNote(`ส่งเข้าไลน์ผลิตแล้ว ${waiting.length} ชุด`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "ส่งเข้าไลน์ผลิตไม่สำเร็จ");
      setSending(false);
    }
  }

  function blockedIntakeCodes(): Set<string> {
    const blocked = new Set<string>([...batch, ...review]);
    for (const row of sets) for (const code of row.codes) blocked.add(code);
    return blocked;
  }

  async function stageCodes(raws: string[]) {
    const result = await collectFreshJobCodes(raws, blockedIntakeCodes(), async (code) => {
      const known = await lookupRelease({ data: { jobId: code } });
      return known.product != null;
    });
    if (result.fresh.length > 0) {
      setReview((current) => [
        ...current,
        ...result.fresh.filter((code) => !current.includes(code)),
      ]);
    }
    setReviewNote(
      intakeReviewNote({
        found: raws.map(readJobCode).filter(Boolean).length,
        fresh: result.fresh.length,
        skipped: result.skipped,
        failed: result.failed,
      }),
    );
  }

  function confirmReview() {
    if (review.length === 0) return;
    const next = [...batch];
    for (const code of review) if (!next.includes(code)) next.push(code);
    setBatch(next);
    saveIntake(next, sets);
    setReview([]);
    setReviewNote(null);
    setNote(null);
  }

  async function onPhoto(file: File) {
    setReadingPhoto(true);
    setReviewNote(null);
    try {
      const found = await decodeQrCodes(file);
      if (found.length === 0) setReviewNote("ไม่พบ QR ในรูปนี้");
      else await stageCodes(found);
    } catch {
      setReviewNote("อ่านรูปไม่สำเร็จ");
    }
    setReadingPhoto(false);
  }

  function handleScanned(text: string) {
    if (scanTarget === "badge") applyBadgeCode(text);
    else if (showOffice) void stageCodes([text]);
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
    const started: TrialRun = {
      jobId: selected.jobId,
      flow: selected.flow.id,
      step,
      employeeId: worker.id,
      employeeName: worker.name,
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
    };
    persist([...runs, started]);
    publish(started);
    setNote(null);
    setNow(Date.now());
  }

  function finishWork() {
    if (!mine) return;
    const finished: TrialRun = { ...mine, status: "done", finishedAt: Date.now() };
    persist(runs.map((run) => (run === mine ? finished : run)));
    publish(finished);
    setStep("");
    setBlocked([]);
    setNote(null);
  }

  function completeEndStep(stepName: string) {
    if (!worker || !selected) return;
    const now = Date.now();
    const existing = runs.find(
      (run) =>
        run.jobId === selected.jobId && run.flow === selected.flow.id && run.step === stepName,
    );
    if (existing) {
      const finished: TrialRun = {
        ...existing,
        status: "done",
        finishedAt: now,
        employeeId: worker.id,
        employeeName: worker.name,
      };
      persist(runs.map((run) => (run === existing ? finished : run)));
      publish(finished);
      return;
    }
    const finished: TrialRun = {
      jobId: selected.jobId,
      flow: selected.flow.id,
      step: stepName,
      employeeId: worker.id,
      employeeName: worker.name,
      status: "done",
      startedAt: now,
      finishedAt: now,
    };
    persist([...runs, finished]);
    publish(finished);
  }

  useEffect(() => {
    if (!jobId) return;
    const id = window.setInterval(() => {
      void pullJobRuns(jobId);
    }, 8000);
    return () => window.clearInterval(id);
  }, [jobId, listJobRuns]);

  const shown = worker ? splitName(worker.name) : null;
  const jobRuns = runs.filter((run) => run.jobId === jobId);
  const woodIssueDone = jobRuns.some(
    (run) => run.step === WOOD_ISSUE_QC_STEP && run.status === "done",
  );
  const woodIssueGate =
    woodQcDesk && woodQcMode === "issue" && !woodIssueDone && worker && selected
      ? canStartTrial({
          runs,
          jobId: selected.jobId,
          flow: selected.flow,
          step: WOOD_ISSUE_QC_STEP,
          employeeId: worker.id,
        })
      : ({ ok: true } as const);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader mark="white">
        <Link to="/">
          <Button
            variant="ghost"
            size="sm"
            className="h-11 gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            หน้าแรก
          </Button>
        </Link>
      </AppHeader>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {!worker ? (
            <>
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-4 py-8 text-center">
                <CreditCard className="h-10 w-10 text-primary" />
                <p className="text-sm font-semibold leading-snug">สแกนบัตรพนักงาน</p>
                <p className="text-sm font-semibold leading-snug">ဝန်ထမ်းကတ် ဖတ်ပါ</p>
                <p className="text-[11px] text-muted-foreground">สแกนเลขบนบัตร แล้วชื่อจะขึ้นเอง</p>
                <p className="text-[11px] text-muted-foreground">
                  ကတ်ပေါ်ကနံပါတ်ကို ဖတ်ရင် နာမည်ပေါ်လာမယ်
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openScanner("badge")}
                disabled={loadState !== "ready"}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 text-base font-bold text-white shadow disabled:opacity-50"
              >
                <ScanLine className="h-5 w-5" />
                {loadState === "loading" ? (
                  "กำลังโหลดรายชื่อ"
                ) : (
                  <span className="leading-tight">
                    สแกนบัตร <span className="font-semibold">ကတ်ဖတ်</span>
                  </span>
                )}
              </button>
              <div className="flex gap-1.5">
                <input
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyBadgeCode(codeInput);
                  }}
                  placeholder="หรือพิมพ์เลขพนักงาน သို့မဟုတ် ဝန်ထမ်းနံပါတ် ရိုက်ပါ"
                  inputMode="numeric"
                  className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-sm placeholder:text-[10px]"
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
                  <p className="truncate text-xs font-semibold">{shown?.nickname ?? shown?.name}</p>
                  <p className="truncate text-[11px] opacity-80">
                    {worker.emp_code}
                    {showOffice
                      ? " · ออฟฟิศ"
                      : worker.department === "qc"
                        ? " · QC"
                        : worker.department === "packing"
                          ? " · แพ็คของ"
                          : worker.department === "final"
                            ? " · QC / แพ็คของ"
                            : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="เปลี่ยนคน"
                  onClick={() => {
                    setWorker(null);
                    setJobId("");
                    setJobFlow(null);
                    setJobInput("");
                    setStep("");
                    setNote(null);
                  }}
                  disabled={running}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6 text-neutral-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 8h13" />
                    <path d="M14 4.5 17.5 8 14 11.5" />
                    <path d="M20 16H7" />
                    <path d="M10 12.5 6.5 16 10 19.5" />
                  </svg>
                </button>
              </div>

              {showOffice ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">รับออเดอร์</p>
                    <p className="text-sm font-bold">{batch.length} ใบ</p>
                  </div>
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {flashId && !batch.includes(flashId) && (
                      <li className="rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                        {flashId} · {flashMessage}
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
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void openScanner("job")}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white"
                    >
                      <ScanLine className="h-5 w-5" /> สแกน QR
                    </button>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={readingPhoto}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-base font-bold disabled:opacity-40"
                    >
                      {readingPhoto ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ImagePlus className="h-5 w-5" />
                      )}
                      อัปโหลดรูป
                    </button>
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void onPhoto(file);
                    }}
                  />
                  {(review.length > 0 || reviewNote) && (
                    <div className="space-y-2 rounded-2xl border bg-card p-3">
                      <p className="text-sm font-semibold">ตรวจรหัสจากรูป</p>
                      {review.length === 0 ? (
                        <p className="text-sm text-muted-foreground">ยังไม่มีรหัสใหม่</p>
                      ) : (
                        <ul className="max-h-48 space-y-1 overflow-y-auto">
                          {review.map((code) => (
                            <li
                              key={code}
                              className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-muted/60 px-2 text-sm"
                            >
                              <span className="truncate">{code}</span>
                              <button
                                type="button"
                                aria-label={`ลบ ${code}`}
                                className="flex h-11 w-11 items-center justify-center"
                                onClick={() =>
                                  setReview((current) => current.filter((item) => item !== code))
                                }
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {reviewNote && (
                        <p className="text-sm font-medium text-amber-700">{reviewNote}</p>
                      )}
                      <button
                        type="button"
                        onClick={confirmReview}
                        disabled={review.length === 0}
                        className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white disabled:opacity-40"
                      >
                        ยืนยันเข้ารายการ
                      </button>
                    </div>
                  )}
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
                        onClick={confirmProduct}
                        className="flex h-14 items-center justify-center rounded-2xl bg-sky-500 text-base font-bold text-white"
                      >
                        ยืนยัน
                      </button>
                    </>
                  )}
                  <div className="border-t pt-3">
                    <p className="text-sm font-semibold">รายการชุด</p>
                    {sets.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        เลือกสินค้าแล้ว ชุดจะมาอยู่ตรงนี้ก่อนส่ง
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {sets.map((row) => {
                          const flashed = row.codes.includes(flashId ?? "");
                          const tone = flashed
                            ? "border-red-500 bg-red-50"
                            : row.sent
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-border bg-card";
                          return (
                            <li
                              key={row.id}
                              ref={(node) => {
                                if (node) setRefs.current.set(row.id, node);
                                else setRefs.current.delete(row.id);
                              }}
                              className={`rounded-xl border-2 p-2 ${tone}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">
                                  {productLabel(row.product)} · {row.codes.length} ใบ
                                </p>
                                <p
                                  className={`text-xs font-semibold ${row.sent ? "text-emerald-700" : "text-amber-700"}`}
                                >
                                  {row.sent ? "ส่งแล้ว" : "รอส่ง"}
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {row.codes.join(", ")}
                              </p>
                              {row.sent && row.sentAt && (
                                <p className="mt-1 text-xs font-medium text-emerald-800">
                                  ส่งเมื่อ {formatSentAt(row.sentAt)}
                                </p>
                              )}
                              {!row.sent && (
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => editSet(row.id)}
                                    className="min-h-11 flex-1 rounded-xl border bg-background text-sm font-semibold"
                                  >
                                    แก้ไข
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteSet(row.id)}
                                    className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700"
                                  >
                                    ลบ
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <button
                      type="button"
                      disabled={sending || !sets.some((row) => !row.sent)}
                      onClick={sendSets}
                      className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white disabled:opacity-40"
                    >
                      <Send className="h-5 w-5" /> ส่งออเดอร์เข้าไลน์ผลิต
                    </button>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      รายการที่ส่งแล้วอยู่ถึงเที่ยงคืน ดูย้อนหลังหรือแก้ไขได้ที่หลังบ้านแอดมิน
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {batchDesk && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Scan</p>
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={pickGeneral}
                          disabled={batchLocked}
                          className={`min-h-11 rounded-xl border px-1 text-xs font-bold leading-tight disabled:opacity-40 ${batchStep == null ? "border-sky-600 bg-sky-600 text-white" : "bg-card"}`}
                        >
                          General
                        </button>
                        {BATCH_STEPS.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => pickBatch(name)}
                            disabled={batchLocked && batchStep !== name}
                            className={`min-h-11 rounded-xl border px-1 text-xs font-bold leading-tight disabled:opacity-40 ${batchStep === name ? "border-sky-600 bg-sky-600 text-white" : "bg-card"}`}
                          >
                            {BATCH_STEP_LABELS[name]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {batchDesk && batchStep ? (
                    <BatchStepPanel
                      key={`${worker.id}-${batchStep}`}
                      step={batchStep}
                      employeeId={worker.id}
                      employeeName={worker.name}
                      onLeave={() => {
                        if (
                          batchDraftCount > 0 &&
                          !window.confirm("ปิดชุดนี้แล้ว ลิสต์ที่ยังไม่ยืนยันจะหาย")
                        ) {
                          return;
                        }
                        setBatchStep(null);
                      }}
                      onLockChange={setBatchLocked}
                      onDraftCount={setBatchDraftCount}
                    />
                  ) : (
                    <>
                      <div className="rounded-2xl border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <QrCode className="h-3.5 w-3.5" /> รหัสงาน (JOB ID)
                          </p>
                          {woodQcDesk && (
                            <div className="flex shrink-0 gap-1.5">
                              {(
                                [
                                  ["issue", "QC ไม้"],
                                  ["final", "QC จบงาน"],
                                ] as const
                              ).map(([mode, label]) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setWoodQcMode(mode)}
                                  className={`h-11 rounded-xl px-3 text-sm font-bold ${
                                    woodQcMode === mode
                                      ? "bg-sky-600 text-white"
                                      : "border bg-background"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {jobId ? (
                          <>
                            <div className="mt-1.5 flex items-center gap-1">
                              <p className="text-lg font-bold text-primary">{jobId}</p>
                              <button
                                type="button"
                                aria-label="ล้างรหัสงาน"
                                disabled={running}
                                onClick={() => {
                                  setJobId("");
                                  setJobInput("");
                                  setJobFlow(null);
                                  setStep("");
                                  setBlocked([]);
                                  setNote(null);
                                }}
                                className="flex h-11 w-11 items-center justify-center rounded-full text-red-600 disabled:opacity-40"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                            {flow && <p className="text-[11px] font-semibold">{flow.label}</p>}
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
                            placeholder="หรือพิมพ์รหัสงาน"
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

                      {selected && endDesk && (step === "QC" || step === "PACK") && (
                        <>
                          <p className={woodQcDesk ? "text-xl font-bold" : "text-sm font-semibold"}>
                            {woodQcDesk
                              ? woodQcMode === "issue"
                                ? "QC ไม้"
                                : "QC จบงาน"
                              : `ขั้นตอน ${stepLabel(step)}`}
                          </p>
                          {worker?.department === "final" && (
                            <div className="grid grid-cols-2 gap-2">
                              {(["QC", "PACK"] as const).map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => setStep(name)}
                                  className={`h-11 rounded-xl text-sm font-bold ${step === name ? "bg-sky-600 text-white" : "border bg-background"}`}
                                >
                                  {stepLabel(name)}
                                </button>
                              ))}
                            </div>
                          )}
                          {woodQcDesk && woodQcMode === "issue" && !woodIssueGate.ok ? (
                            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-800">
                              {woodIssueGate.message}
                            </p>
                          ) : (
                            <TrialEndPanel
                              key={`${selected.jobId}-${step}-${woodQcDesk ? woodQcMode : "end"}`}
                              flowId={selected.flow.id}
                              kind={step === "PACK" ? "packing" : "qc"}
                              fixedItems={
                                woodQcDesk && woodQcMode === "issue"
                                  ? WOOD_ISSUE_QC_ITEMS
                                  : undefined
                              }
                              done={
                                woodQcDesk && woodQcMode === "issue"
                                  ? woodIssueDone
                                  : jobRuns.some(
                                      (run) => run.step === step && run.status === "done",
                                    )
                              }
                              onDone={(message) => {
                                completeEndStep(
                                  woodQcDesk && woodQcMode === "issue" ? WOOD_ISSUE_QC_STEP : step,
                                );
                                setNote(message);
                              }}
                            />
                          )}
                        </>
                      )}
                      {selected &&
                        worker?.department === "final" &&
                        step !== "QC" &&
                        step !== "PACK" && (
                          <div className="grid grid-cols-2 gap-2">
                            {(["QC", "PACK"] as const).map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setStep(name)}
                                className="h-11 rounded-xl border bg-background text-sm font-bold"
                              >
                                {stepLabel(name)}
                              </button>
                            ))}
                          </div>
                        )}

                      {selected && !endDesk && (
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
                              {steps
                                .filter((name) => !isBatchStep(name))
                                .map((name) => {
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

                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              ลำดับงาน
                            </p>
                            <button
                              type="button"
                              onClick={() => setStepsOpen((open) => !open)}
                              className="flex min-h-11 items-center gap-1 px-1 text-xs font-semibold"
                            >
                              {stepsOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              {stepsOpen ? "หุบ" : "ดูกำหนดทั้งหมด"}
                            </button>
                          </div>
                          <ul className="space-y-1 text-[11px]">
                            {(stepsOpen
                              ? steps
                              : nextTrialSteps(selected.flow, runs, jobId).filter(
                                  (name) => name !== WOOD_ISSUE_QC_STEP,
                                )
                            ).map((name) => {
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
                          {!stepsOpen &&
                            nextTrialSteps(selected.flow, runs, jobId).length === 0 && (
                              <p className="text-center text-xs font-medium text-emerald-700">
                                ครบทุกขั้นแล้ว
                              </p>
                            )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {note && (
            <p
              className={`text-center text-xs font-medium ${
                note.startsWith("ส่งเข้าไลน์ผลิตแล้ว") || note.startsWith("ส่งรายงานสำเร็จ")
                  ? "text-emerald-700"
                  : note.includes("แก้แล้ว")
                    ? "text-foreground"
                    : "text-destructive"
              }`}
            >
              {note === "ยังไม่ส่งเข้าไลน์ผลิต" ? (
                <>
                  <span className="block">ยังไม่ส่งเข้าไลน์ผลิต</span>
                  <span className="block">ထုတ်လုပ်ရေးလိုင်းကို မပို့ရသေးပါ</span>
                </>
              ) : (
                note
              )}
            </p>
          )}
          {loadState === "error" && (
            <p className="text-center text-xs font-medium text-destructive">โหลดรายชื่อไม่สำเร็จ</p>
          )}
        </div>
        {!worker && (
          <div className="flex shrink-0 flex-col items-center gap-1 px-4 pb-3 text-center">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="block">หากพบปัญหาเข้าแจ้งหัวหน้างานทันที</span>
              <span className="block">ပြဿနာတွေ့ရင် အကြီးအကဲကို ချက်ချင်းပြောပါ</span>
            </p>
            <AppVersion className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-sky-800" />
          </div>
        )}
        <QrScannerDialog
          open={scannerStream !== null}
          onOpenChange={(open) => {
            if (!open) closeScanner();
          }}
          onScanned={handleScanned}
          initialStream={scannerStream}
        />
      </div>
    </div>
  );
}
