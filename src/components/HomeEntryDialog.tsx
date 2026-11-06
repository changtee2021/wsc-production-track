import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, ScanLine } from "lucide-react";
import { lookupHomeEmployee } from "@/lib/scan-trial.functions";
import { saveHomeActor, type HomeActor } from "@/lib/home-actor";
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

export function HomeEntryDialog({
  label,
  open,
  onOpenChange,
  onEntered,
}: {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntered: (actor: HomeActor) => void;
}) {
  const lookup = useServerFn(lookupHomeEmployee);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);

  async function submit(raw: string) {
    const next = raw.trim();
    if (!next) {
      setError("สแกนบัตรหรือพิมพ์เลขพนักงานก่อน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const actor = await lookup({ data: { code: next } });
      saveHomeActor(actor);
      setCode("");
      onEntered(actor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ตรวจรหัสไม่สำเร็จ");
    }
    setBusy(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setError(null);
            setCode("");
          }
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ใส่รหัสพนักงาน</DialogTitle>
            <DialogDescription>ก่อนเข้า{label} สแกนบัตรหรือพิมพ์เลขพนักงาน เพื่อลงชื่อคนที่ใช้งาน</DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              const result = await acquireCameraStream("environment");
              if ("errorInfo" in result) {
                setError(
                  result.errorInfo.hint
                    ? `${result.errorInfo.message} — ${result.errorInfo.hint}`
                    : result.errorInfo.message,
                );
                return;
              }
              setScannerStream(result.stream);
            }}
            className="h-12 w-full gap-2 text-base font-semibold"
          >
            <ScanLine className="h-5 w-5" /> สแกนบัตรพนักงาน
          </Button>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit(code);
              }}
              placeholder="หรือพิมพ์เลขพนักงาน"
              inputMode="numeric"
              aria-label="รหัสพนักงาน"
              className="h-12 text-base"
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              aria-label="ยืนยันเลขพนักงาน"
              onClick={() => void submit(code)}
              className="h-12 w-12 shrink-0"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
      <QrScannerDialog
        open={scannerStream !== null}
        onOpenChange={(next) => {
          if (!next) setScannerStream(null);
        }}
        onScanned={(text) => {
          setScannerStream(null);
          setCode(text.trim());
          void submit(text);
        }}
        initialStream={scannerStream}
      />
    </>
  );
}
