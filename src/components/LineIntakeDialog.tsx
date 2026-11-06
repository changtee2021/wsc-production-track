import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ImagePlus, Loader2, ScanLine, X } from "lucide-react";
import { QrScannerDialog, acquireCameraStream } from "@/components/QrScannerDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { collectFreshJobCodes, intakeReviewNote, readJobCode } from "@/lib/intake-codes";
import { decodeQrCodes } from "@/lib/qr-image";
import { lookupTrialRelease, releaseTrialJobs } from "@/lib/scan-trial.functions";
import { TRIAL_FLOWS, type TrialFlowId } from "@/lib/scan-trial";

export function LineIntakeDialog({
  open,
  onOpenChange,
  sentByName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sentByName: string;
  onSent: () => void;
}) {
  const lookupRelease = useServerFn(lookupTrialRelease);
  const release = useServerFn(releaseTrialJobs);
  const fileRef = useRef<HTMLInputElement>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [product, setProduct] = useState<TrialFlowId | null>(null);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);

  function reset() {
    setCodes([]);
    setTyped("");
    setNote(null);
    setProduct(null);
    setReading(false);
    setSending(false);
    setScannerStream(null);
  }

  async function stage(raws: string[]) {
    const blocked = new Set(codes);
    const result = await collectFreshJobCodes(raws, blocked, async (code) => {
      const known = await lookupRelease({ data: { jobId: code } });
      return known.product != null;
    });
    if (result.fresh.length > 0) {
      setCodes((current) => [...current, ...result.fresh.filter((code) => !current.includes(code))]);
    }
    setNote(
      intakeReviewNote({
        found: raws.map(readJobCode).filter(Boolean).length,
        fresh: result.fresh.length,
        skipped: result.skipped,
        failed: result.failed,
      }),
    );
  }

  async function onPhoto(file: File) {
    setReading(true);
    setNote(null);
    try {
      const found = await decodeQrCodes(file);
      if (found.length === 0) setNote("ไม่พบ QR ในรูปนี้");
      else await stage(found);
    } catch {
      setNote("อ่านรูปไม่สำเร็จ");
    }
    setReading(false);
  }

  async function send() {
    if (!codes.length || !product || sending) return;
    setSending(true);
    setNote(null);
    try {
      await release({
        data: {
          jobs: codes.map((jobId) => ({ jobId, product })),
          sentByName,
        },
      });
      reset();
      onOpenChange(false);
      onSent();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "ส่งเข้าไลน์ผลิตไม่สำเร็จ");
      setSending(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) reset();
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>สแกนเข้าไลน์ผลิตใหม่</DialogTitle>
            <DialogDescription>
              อ่าน QR ทั้งรูป แล้วตรวจรายการก่อนส่ง รหัสที่ซ้ำจะไม่ขึ้น
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              disabled={reading || sending}
              onClick={() => fileRef.current?.click()}
            >
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              อัปโหลดรูป
            </Button>
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={reading || sending}
              onClick={async () => {
                const result = await acquireCameraStream("environment");
                if ("errorInfo" in result) {
                  setNote(result.errorInfo.message);
                  return;
                }
                setScannerStream(result.stream);
              }}
            >
              <ScanLine className="h-4 w-4" /> สแกน QR
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onPhoto(file);
            }}
          />
          <div className="flex gap-2">
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const code = readJobCode(typed);
                setTyped("");
                if (!code) {
                  setNote("พิมพ์รหัสงานก่อน");
                  return;
                }
                void stage([code]);
              }}
              placeholder="หรือพิมพ์รหัสงาน"
              className="h-11"
              disabled={sending}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-11 shrink-0"
              aria-label="เพิ่มรหัสงาน"
              disabled={sending}
              onClick={() => {
                const code = readJobCode(typed);
                setTyped("");
                if (!code) {
                  setNote("พิมพ์รหัสงานก่อน");
                  return;
                }
                void stage([code]);
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีรหัสในรายการ</p>
          ) : (
            <ul className="max-h-52 space-y-1 overflow-y-auto">
              {codes.map((code) => (
                <li
                  key={code}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-muted/60 px-2 text-sm"
                >
                  <span className="truncate font-medium">{code}</span>
                  <button
                    type="button"
                    aria-label={`ลบ ${code}`}
                    className="flex h-11 w-11 items-center justify-center"
                    onClick={() => setCodes((current) => current.filter((item) => item !== code))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {note && <p className="text-sm font-medium text-amber-700">{note}</p>}
          <p className="text-sm font-semibold">สินค้าทั้งชุด</p>
          <div className="grid grid-cols-2 gap-2">
            {TRIAL_FLOWS.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => setProduct(flow.id)}
                className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${product === flow.id ? "border-sky-500 bg-sky-50" : "bg-card"}`}
              >
                {flow.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            className="h-12 w-full text-base font-bold"
            disabled={sending || codes.length === 0 || !product}
            onClick={() => void send()}
          >
            {sending ? "กำลังส่ง" : "ยืนยันส่งเข้าไลน์"}
          </Button>
        </DialogContent>
      </Dialog>
      <QrScannerDialog
        open={scannerStream !== null}
        onOpenChange={(next) => {
          if (!next) setScannerStream(null);
        }}
        onScanned={(text) => {
          setScannerStream(null);
          void stage([text]);
        }}
        initialStream={scannerStream}
      />
    </>
  );
}
