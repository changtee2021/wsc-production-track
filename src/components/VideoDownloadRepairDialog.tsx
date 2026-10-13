import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Circle, Download, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inspectMp4, needsWebSafeRemux, repairMp4IfNeeded } from "@/lib/utils/mp4-repair";
import { canBrowserCompressVideo } from "@/lib/utils/media-compress";
import { CLIENT_TRANSCODE_MAX_BYTES, transcodeToWebMp4 } from "@/lib/utils/video-transcode";

type StepId = "fetch" | "inspect" | "repair" | "convert" | "save";
type StepStatus = "pending" | "active" | "done" | "skip" | "error";

type Step = {
  id: StepId;
  label: string;
  status: StepStatus;
  detail?: string;
};

const INITIAL_STEPS: Step[] = [
  { id: "fetch", label: "โหลด", status: "pending" },
  { id: "inspect", label: "ตรวจ", status: "pending" },
  { id: "repair", label: "ซ่อม", status: "pending" },
  { id: "convert", label: "แปลง", status: "pending" },
  { id: "save", label: "บันทึก", status: "pending" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Signed URL (or absolute URL) of the video */
  src: string;
  /** Storage path / original ref — used for filename */
  originalRef: string;
};

function fileNameFromRef(ref: string): string {
  const base = ref.split("/").pop()?.split("?")[0] || "video.mp4";
  return base.replace(/\.(mov|m4v|webm)$/i, ".mp4");
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".mp4") ? name : `${name}.mp4`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === "done" || status === "skip") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-4 w-4" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white">
        <X className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-muted-foreground/40 bg-background text-muted-foreground">
      <Circle className="h-3.5 w-3.5" />
    </span>
  );
}

export function VideoDownloadRepairDialog({ open, onOpenChange, src, originalRef }: Props) {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("พร้อมตรวจและดาวน์โหลด");
  const [running, setRunning] = useState(false);
  const [finishedOk, setFinishedOk] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) {
      cancelRef.current = true;
      setSteps(INITIAL_STEPS);
      setPercent(0);
      setMessage("พร้อมตรวจและดาวน์โหลด");
      setRunning(false);
      setFinishedOk(false);
      return;
    }
    cancelRef.current = false;
  }, [open]);

  const patchStep = (id: StepId, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const run = async () => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setFinishedOk(false);
    setSteps(
      INITIAL_STEPS.map((s) => ({ ...s, status: "pending" as StepStatus, detail: undefined })),
    );
    setPercent(0);

    const name = fileNameFromRef(originalRef);

    try {
      // 1) Fetch
      patchStep("fetch", { status: "active", detail: "กำลังดึงไฟล์..." });
      setMessage("กำลังโหลดคลิปจาก Storage...");
      const res = await fetch(src);
      if (!res.ok) throw new Error(`โหลดไฟล์ไม่สำเร็จ (${res.status})`);
      const blob = await res.blob();
      if (cancelRef.current) return;
      let file = new File([blob], name, {
        type: blob.type || "video/mp4",
        lastModified: Date.now(),
      });
      patchStep("fetch", {
        status: "done",
        detail: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      });
      setPercent(15);

      // 2) Inspect
      patchStep("inspect", { status: "active", detail: "กำลังตรวจโครงสร้าง..." });
      setMessage("กำลังตรวจสอบว่ามีปัญหาหรือไม่...");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (cancelRef.current) return;
      const health = inspectMp4(bytes);
      const needsRemux = needsWebSafeRemux(health);
      const issues: string[] = [];
      if (health.mdatSwallowsMoov || health.brokenMdatSize) issues.push("กล่องไฟล์พัง");
      if (health.hasHevc) issues.push("HEVC");
      if (!health.hasMoov) issues.push("ไม่มี moov");
      if (/\.webm$/i.test(originalRef) || file.type === "video/webm") issues.push("WebM");
      if (/\.(mov|m4v)$/i.test(originalRef)) issues.push("MOV/M4V");
      patchStep("inspect", {
        status: "done",
        detail: issues.length ? issues.join(", ") : "ปกติ",
      });
      setPercent(30);

      // 3) Repair
      if (health.brokenMdatSize || health.mdatSwallowsMoov || !health.hasMoov) {
        patchStep("repair", { status: "active", detail: "กำลังซ่อม..." });
        setMessage("พบปัญหาโครงสร้าง — กำลังซ่อม...");
        const repaired = await repairMp4IfNeeded(file);
        if (cancelRef.current) return;
        file = repaired.file;
        patchStep("repair", {
          status: repaired.repaired ? "done" : "skip",
          detail: repaired.repaired ? "ซ่อมแล้ว" : "ข้าม",
        });
      } else {
        patchStep("repair", { status: "skip", detail: "ไม่ต้องซ่อม" });
      }
      setPercent(45);

      // 4) Convert if needed
      const afterBytes = new Uint8Array(await file.arrayBuffer());
      if (cancelRef.current) return;
      const afterHealth = inspectMp4(afterBytes);
      const stillNeeds =
        needsWebSafeRemux(afterHealth) ||
        needsRemux ||
        afterHealth.hasHevc ||
        file.type === "video/webm" ||
        /\.(mov|m4v|webm)$/i.test(originalRef);

      if (stillNeeds) {
        if (file.size > CLIENT_TRANSCODE_MAX_BYTES) {
          patchStep("convert", {
            status: "skip",
            detail: `ใหญ่เกิน ${Math.round(CLIENT_TRANSCODE_MAX_BYTES / (1024 * 1024))}MB`,
          });
          setMessage("ไฟล์ใหญ่เกินกว่าจะแปลงในเบราว์เซอร์ — จะดาวน์โหลดไฟล์ที่ซ่อมโครงสร้างแล้ว");
        } else if (!canBrowserCompressVideo()) {
          patchStep("convert", { status: "skip", detail: "เครื่องนี้แปลงไม่ได้" });
        } else {
          patchStep("convert", { status: "active", detail: "H.264..." });
          setMessage("กำลังแปลงเป็น H.264 ให้เล่นได้ทุกเครื่อง...");
          try {
            file = await transcodeToWebMp4(file, (p) => {
              setPercent(45 + Math.round(p * 0.45));
              patchStep("convert", { status: "active", detail: `${p}%` });
            });
            if (cancelRef.current) return;
            patchStep("convert", { status: "done", detail: "H.264 แล้ว" });
          } catch (e) {
            patchStep("convert", {
              status: "error",
              detail: e instanceof Error ? e.message : "แปลงไม่สำเร็จ",
            });
            setMessage("แปลงไม่สำเร็จ — จะดาวน์โหลดไฟล์ที่ซ่อมแล้วแทน");
          }
        }
      } else {
        patchStep("convert", { status: "skip", detail: "ไม่ต้องแปลง" });
      }
      setPercent(92);

      // 5) Save
      patchStep("save", { status: "active", detail: "กำลังบันทึก..." });
      setMessage("กำลังบันทึกลงเครื่อง...");
      const outBlob = file instanceof Blob ? file : new Blob([file], { type: "video/mp4" });
      const outName = fileNameFromRef(originalRef).replace(/\.[^.]+$/, "") + "-playable.mp4";
      triggerDownload(outBlob, outName);
      if (cancelRef.current) return;
      patchStep("save", { status: "done", detail: outName });
      setPercent(100);
      setMessage("ดาวน์โหลดเรียบร้อย");
      setFinishedOk(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      setMessage(msg);
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.status === "active");
        if (idx < 0) return prev;
        return prev.map((s, i) => (i === idx ? { ...s, status: "error", detail: msg } : s));
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>ตรวจและดาวน์โหลดคลิป</DialogTitle>
          <DialogDescription>
            ระบบจะตรวจโครงสร้างไฟล์ ซ่อม/แปลงถ้าจำเป็น แล้วบันทึกลงเครื่องอัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        {/* Horizontal timeline */}
        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-[420px] items-start justify-between gap-1 px-1">
            {steps.map((step, i) => (
              <li key={step.id} className="relative flex flex-1 flex-col items-center gap-1.5">
                {i < steps.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[calc(50%+16px)] right-[calc(-50%+16px)] top-4 h-0.5",
                      step.status === "done" || step.status === "skip"
                        ? "bg-emerald-400"
                        : "bg-muted",
                    )}
                    aria-hidden
                  />
                )}
                <StepDot status={step.status} />
                <span
                  className={cn(
                    "text-center text-xs font-medium",
                    step.status === "active" && "text-sky-600",
                    step.status === "done" && "text-emerald-700",
                    step.status === "error" && "text-rose-600",
                    step.status === "pending" && "text-muted-foreground",
                    step.status === "skip" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className="max-w-[88px] text-center text-[10px] leading-tight text-muted-foreground">
                    {step.detail}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>ความคืบหน้า</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm text-foreground">{message}</p>
          <p className="truncate text-xs text-muted-foreground" title={originalRef}>
            {originalRef}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={running}
            onClick={() => onOpenChange(false)}
          >
            {finishedOk ? "ปิด" : "ยกเลิก"}
          </Button>
          <Button type="button" disabled={running} onClick={() => void run()}>
            {running ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> กำลังทำ...
              </>
            ) : finishedOk ? (
              <>
                <Download className="mr-1 h-4 w-4" /> ดาวน์โหลดอีกครั้ง
              </>
            ) : (
              <>
                <Download className="mr-1 h-4 w-4" /> เริ่มตรวจและดาวน์โหลด
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
