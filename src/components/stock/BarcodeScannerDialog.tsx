import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
};

/** สแกนบาร์โค้ด/QR ด้วยกล้องของอุปกรณ์ */
export function BarcodeScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls;
        if (cancelled) return;
        if (result) {
          const text = result.getText();
          controls.stop();
          onDetected(text);
          onOpenChange(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "ไม่สามารถเปิดกล้องได้");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            สแกนบาร์โค้ด / QR
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-destructive">
            <X className="h-6 w-6" />
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="aspect-square w-full object-cover" />
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          เล็งกล้องไปที่บาร์โค้ดหรือ QR ของสินค้า
        </p>
      </DialogContent>
    </Dialog>
  );
}
