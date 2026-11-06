import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, ImagePlus, Loader2, Play, ScanLine, Square, X } from "lucide-react";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { readJobCode } from "@/lib/intake-codes";
import { decodeQrCodes } from "@/lib/qr-image";
import {
  confirmTrialBatch,
  finishTrialBatch,
  inspectTrialBatchJob,
  listMyTrialBatch,
  startTrialBatch,
} from "@/lib/scan-trial.functions";
import { trialProductLabel, type BatchStep, type TrialFlowId } from "@/lib/scan-trial";

type JobRow = { jobId: string; product: TrialFlowId };
type LockState = {
  batchId: string;
  status: "held" | "running";
  startedAt: number | null;
  jobs: JobRow[];
};

function clockLabel(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function BatchStepPanel({
  step,
  employeeId,
  employeeName,
  onLeave,
  onLockChange,
  onDraftCount,
}: {
  step: BatchStep;
  employeeId: string;
  employeeName: string;
  onLeave: () => void;
  onLockChange: (locked: boolean) => void;
  onDraftCount: (count: number) => void;
}) {
  const inspect = useServerFn(inspectTrialBatchJob);
  const listMine = useServerFn(listMyTrialBatch);
  const confirmBatch = useServerFn(confirmTrialBatch);
  const startBatch = useServerFn(startTrialBatch);
  const finishBatch = useServerFn(finishTrialBatch);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [lock, setLock] = useState<LockState | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const photoRef = useRef<HTMLInputElement>(null);
  const locked = lock != null;

  useEffect(() => {
    onLockChange(locked);
  }, [locked, onLockChange]);

  useEffect(() => {
    onDraftCount(locked ? 0 : jobs.length);
  }, [jobs.length, locked, onDraftCount]);

  useEffect(() => {
    let cancelled = false;
    void listMine({ data: { employeeId } })
      .then((res) => {
        if (cancelled || !res.batch || res.batch.step !== step) return;
        const status = res.batch.status === "running" ? "running" : "held";
        setLock({
          batchId: res.batch.batchId,
          status,
          startedAt: status === "running" ? res.batch.startedAt : null,
          jobs: res.batch.jobs,
        });
        setJobs(res.batch.jobs);
      })
      .catch(() => {
        if (!cancelled) setNote("โหลดชุดเดิมไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, listMine, step]);

  useEffect(() => {
    if (lock?.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [lock?.status]);

  async function addCodes(raws: string[]) {
    const incoming: string[] = [];
    const seen = new Set(jobs.map((job) => job.jobId));
    let skipped = 0;
    for (const raw of raws) {
      const code = readJobCode(raw);
      if (!code || seen.has(code)) {
        if (code) skipped += 1;
        continue;
      }
      seen.add(code);
      incoming.push(code);
    }
    if (!incoming.length) {
      setNote(skipped ? "สแกนแล้ว" : "สแกนหรือพิมพ์รหัสงานก่อน");
      return;
    }
    setBusy(true);
    const accepted: JobRow[] = [];
    const problems: string[] = [];
    await Promise.all(
      incoming.map(async (code) => {
        try {
          const result = await inspect({ data: { jobId: code, step } });
          if (!result.ok) problems.push(`${code} ${result.message}`);
          else accepted.push({ jobId: code, product: result.product });
        } catch (error) {
          problems.push(error instanceof Error ? error.message : `${code} ตรวจไม่สำเร็จ`);
        }
      }),
    );
    if (accepted.length) {
      setJobs((current) => {
        const have = new Set(current.map((job) => job.jobId));
        return [...current, ...accepted.filter((job) => !have.has(job.jobId))];
      });
    }
    setNote(problems.length ? problems.slice(0, 4).join("\n") : null);
    setBusy(false);
  }

  async function confirm() {
    if (!jobs.length || busy || locked) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await confirmBatch({
        data: { step, employeeId, employeeName, jobIds: jobs.map((job) => job.jobId) },
      });
      setJobs(result.jobs);
      setLock({ batchId: result.batchId, status: "held", startedAt: null, jobs: result.jobs });
    } catch (error) {
      setNote(error instanceof Error ? error.message : "ยืนยันชุดไม่สำเร็จ");
    }
    setBusy(false);
  }

  async function start() {
    if (!lock || lock.status !== "held" || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await startBatch({ data: { batchId: lock.batchId, employeeId } });
      setLock({ ...lock, status: "running", startedAt: result.startedAt });
    } catch (error) {
      setNote(error instanceof Error ? error.message : "เริ่มชุดไม่สำเร็จ");
    }
    setBusy(false);
  }

  async function finish() {
    if (!lock || lock.status !== "running" || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await finishBatch({ data: { batchId: lock.batchId, employeeId } });
      setLock(null);
      setJobs([]);
      setNote(`จบทั้งชุดแล้ว ${result.finished} ใบ`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "จบชุดไม่สำเร็จ");
    }
    setBusy(false);
  }

  const shown = lock?.jobs ?? jobs;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {step} · {shown.length} ใบ
        </p>
        {!locked && (
          <button
            type="button"
            onClick={onLeave}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold"
          >
            กลับไปงานทีละใบ
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีรหัสในชุดนี้</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {shown.map((job) => (
            <li
              key={job.jobId}
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-muted/60 px-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{job.jobId}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {trialProductLabel(job.product)}
                </span>
              </span>
              {!locked && (
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-red-700"
                  onClick={() =>
                    setJobs((current) => current.filter((item) => item.jobId !== job.jobId))
                  }
                >
                  เอาออก
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const result = await acquireCameraStream("environment");
                if ("errorInfo" in result) {
                  setNote(result.errorInfo.message);
                  return;
                }
                setScannerStream(result.stream);
              }}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white disabled:opacity-40"
            >
              <ScanLine className="h-5 w-5" /> สแกน QR
            </button>
            <button
              type="button"
              disabled={busy || reading}
              onClick={() => photoRef.current?.click()}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-base font-bold disabled:opacity-40"
            >
              {reading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
              อัปโหลดรูป
            </button>
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setReading(true);
              void decodeQrCodes(file)
                .then((found) => {
                  if (!found.length) setNote("ไม่พบ QR ในรูปนี้");
                  else return addCodes(found);
                })
                .catch(() => setNote("อ่านรูปไม่สำเร็จ"))
                .finally(() => setReading(false));
            }}
          />
          <div className="flex gap-2">
            <input
              value={typed}
              disabled={busy}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const value = typed;
                setTyped("");
                void addCodes([value]);
              }}
              placeholder="หรือพิมพ์รหัสงาน"
              className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2.5 text-sm disabled:opacity-40"
            />
            <button
              type="button"
              aria-label="เพิ่มรหัสงาน"
              disabled={busy}
              onClick={() => {
                const value = typed;
                setTyped("");
                void addCodes([value]);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            disabled={busy || jobs.length === 0}
            onClick={() => void confirm()}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-bold text-white disabled:opacity-40"
          >
            {busy ? "กำลังตรวจ" : "ยืนยันชุด"}
          </button>
        </>
      )}
      {lock?.status === "held" && (
        <>
          <p className="text-sm font-medium">
            ยืนยันแล้ว แก้บนมือถือไม่ได้ ถ้าสแกนผิดให้แจ้งแอดมินถอนออกจากชุด
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 text-base font-bold text-white disabled:opacity-40"
          >
            <Play className="h-5 w-5" /> เริ่ม
          </button>
        </>
      )}
      {lock?.status === "running" && (
        <>
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-700">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-4 w-4" /> กำลังทำทั้งชุด
            </span>
            <span className="font-mono text-xl font-bold tabular-nums">
              {clockLabel(lock.startedAt ?? now, now)}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void finish()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-bold text-white disabled:opacity-40"
          >
            <Square className="h-5 w-5 fill-current" /> จบ
          </button>
        </>
      )}
      {note && (
        <p
          className={`whitespace-pre-line text-center text-xs font-medium ${note.startsWith("จบทั้งชุดแล้ว") ? "text-emerald-700" : "text-destructive"}`}
        >
          {note}
        </p>
      )}
      <QrScannerDialog
        open={scannerStream !== null}
        onOpenChange={(open) => {
          if (!open) setScannerStream(null);
        }}
        onScanned={(text) => {
          setScannerStream(null);
          void addCodes([text]);
        }}
        initialStream={scannerStream}
      />
    </div>
  );
}
