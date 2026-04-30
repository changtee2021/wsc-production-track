import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScanned: (text: string) => void;
}

const REGION_ID = "qr-scan-region";

export function QrScannerDialog({ open, onOpenChange, onScanned }: QrScannerDialogProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      try {
        // wait a tick for the DOM region to mount
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
        const el = document.getElementById(REGION_ID);
        if (!el) return;
        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (cancelled) return;
            cancelled = true;
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                scanner.clear();
                scannerRef.current = null;
                onScanned(decodedText.trim());
                onOpenChange(false);
              });
          },
          () => {
            // ignore per-frame errors
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "ไม่สามารถเปิดกล้องได้";
        toast.error(msg);
        onOpenChange(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {
              // noop
            }
            scannerRef.current = null;
          });
      }
    };
  }, [open, onOpenChange, onScanned]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>สแกน QR Code</DialogTitle>
          <DialogDescription>
            หันกล้องไปที่ QR code ของงาน ระบบจะอ่านอัตโนมัติ
          </DialogDescription>
        </DialogHeader>
        <div
          id={REGION_ID}
          className="aspect-square w-full overflow-hidden rounded-xl bg-black"
        />
      </DialogContent>
    </Dialog>
  );
}
