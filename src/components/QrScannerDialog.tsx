import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SwitchCamera, Loader2 } from "lucide-react";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScanned: (text: string) => void;
}

const REGION_ID = "qr-scan-region";

export function QrScannerDialog({ open, onOpenChange, onScanned }: QrScannerDialogProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cancelledRef = useRef(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCam, setActiveCam] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Stop helper
  const stopScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      s.clear();
    } catch {
      /* noop */
    }
  };

  // Start scanning on a given camera
  const startWith = async (camId: string) => {
    await stopScanner();
    if (cancelledRef.current) return;
    setStarting(true);
    try {
      const scanner = new Html5Qrcode(REGION_ID, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      scannerRef.current = scanner;
      await scanner.start(
        camId,
        {
          fps: 15,
          qrbox: (vw, vh) => {
            const size = Math.floor(Math.min(vw, vh) * 0.85);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
          if (cancelledRef.current) return;
          cancelledRef.current = true;
          const text = decodedText.trim();
          stopScanner().finally(() => {
            onScanned(text);
            onOpenChange(false);
          });
        },
        () => {
          /* ignore per-frame */
        },
      );
      setActiveCam(camId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถเปิดกล้องได้";
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  // Init: enumerate cameras then start with the back-facing one
  useEffect(() => {
    if (!open) return;
    cancelledRef.current = false;

    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 50));
        if (cancelledRef.current) return;
        const devices = await Html5Qrcode.getCameras();
        if (!devices.length) {
          toast.error("ไม่พบกล้อง");
          onOpenChange(false);
          return;
        }
        setCameras(devices);
        const back =
          devices.find((d) => /back|rear|environment|หลัง/i.test(d.label)) ??
          devices[devices.length - 1];
        await startWith(back.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "ไม่สามารถเข้าถึงกล้องได้";
        toast.error(msg);
        onOpenChange(false);
      }
    })();

    return () => {
      cancelledRef.current = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    if (cameras.length < 2 || !activeCam) return;
    const idx = cameras.findIndex((c) => c.id === activeCam);
    const next = cameras[(idx + 1) % cameras.length];
    await startWith(next.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-w-full gap-2 rounded-none p-3 sm:h-auto sm:max-w-lg sm:rounded-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle>สแกน QR Code</DialogTitle>
          <DialogDescription>
            จัดให้ QR อยู่กลางกรอบ ระบบจะอ่านให้อัตโนมัติ
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full flex-1 overflow-hidden rounded-xl bg-black sm:aspect-square sm:flex-none">
          <div id={REGION_ID} className="h-full w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover" />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>
        {cameras.length > 1 && (
          <Button
            variant="outline"
            onClick={switchCamera}
            disabled={starting}
            className="h-11 w-full gap-2"
          >
            <SwitchCamera className="h-4 w-4" />
            สลับกล้อง ({cameras.findIndex((c) => c.id === activeCam) + 1}/{cameras.length})
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
