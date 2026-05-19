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
import { SwitchCamera, Loader2, ImagePlus } from "lucide-react";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScanned: (text: string) => void;
}

const REGION_ID = "qr-scan-region";

// Detect iOS / Safari for tailored behavior (e.g. playsInline patching)
const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as MacIntel with touch
    (ua.includes("Mac") && "ontouchend" in document)
  );
};

// Force inline playback on the <video> element rendered by html5-qrcode.
// Without these attributes iOS Safari refuses to render the preview
// (or kicks it into fullscreen) so the scanner looks broken.
function patchVideoElement(container: HTMLElement) {
  const apply = (v: HTMLVideoElement) => {
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    v.setAttribute("muted", "true");
    v.setAttribute("autoplay", "true");
    v.muted = true;
    v.autoplay = true;
    v.playsInline = true;
    // Best-effort kickstart (some iOS versions need an explicit play())
    v.play().catch(() => {
      /* ignore — user gesture already happened on dialog open */
    });
  };
  const existing = container.querySelector("video");
  if (existing) apply(existing as HTMLVideoElement);
  const obs = new MutationObserver(() => {
    const v = container.querySelector("video");
    if (v) apply(v as HTMLVideoElement);
  });
  obs.observe(container, { childList: true, subtree: true });
  return () => obs.disconnect();
}

// Human-friendly error message for the most common getUserMedia failures.
function formatCameraError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const name = e?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดสิทธิ์กล้องในตั้งค่า Safari/เบราว์เซอร์แล้วลองใหม่";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "ไม่พบกล้องบนอุปกรณ์นี้";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "กล้องกำลังถูกใช้งานโดยแอปอื่น — ปิดแอปกล้องอื่นแล้วลองใหม่";
  }
  if (name === "OverconstrainedError") {
    return "อุปกรณ์ไม่รองรับการเปิดกล้องตามที่ขอ";
  }
  if (name === "SecurityError") {
    return "ต้องเปิดผ่าน HTTPS เพื่อใช้กล้อง";
  }
  return e?.message || "ไม่สามารถเข้าถึงกล้องได้";
}

type FacingMode = "environment" | "user";

// Minimal BarcodeDetector type (the lib.dom typings don't ship it yet)
type BarcodeDetectorLike = {
  detect: (
    source: CanvasImageSource,
  ) => Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => BarcodeDetectorLike;

async function hasNativeQrDetector(): Promise<boolean> {
  const w = window as unknown as {
    BarcodeDetector?: BarcodeDetectorCtor & {
      getSupportedFormats?: () => Promise<string[]>;
    };
  };
  if (!w.BarcodeDetector) return false;
  try {
    const formats = (await w.BarcodeDetector.getSupportedFormats?.()) ?? [];
    return formats.includes("qr_code");
  } catch {
    return false;
  }
}

export function QrScannerDialog({
  open,
  onOpenChange,
  onScanned,
}: QrScannerDialogProps) {
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const observerCleanupRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facing, setFacing] = useState<FacingMode>("environment");
  const [starting, setStarting] = useState(false);
  const [usingNative, setUsingNative] = useState(false);
  const [canSwitch, setCanSwitch] = useState(true);

  // Tear everything down (both code paths).
  const stopAll = async () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (observerCleanupRef.current) {
      observerCleanupRef.current();
      observerCleanupRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        /* noop */
      }
      videoRef.current.srcObject = null;
    }
    const s = html5Ref.current;
    html5Ref.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* noop */
      }
    }
  };

  const finishWith = (text: string) => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    const trimmed = text.trim();
    stopAll().finally(() => {
      onScanned(trimmed);
      onOpenChange(false);
    });
  };

  // ---- Path A: native BarcodeDetector (iOS 17+, Chrome) ------------------
  const startNative = async (mode: FacingMode) => {
    const region = document.getElementById(REGION_ID);
    if (!region) throw new Error("ไม่พบพื้นที่แสดงผลกล้อง");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    if (cancelledRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    let video = region.querySelector("video") as HTMLVideoElement | null;
    if (!video) {
      video = document.createElement("video");
      video.className = "h-full w-full object-cover";
      region.appendChild(video);
    }
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    videoRef.current = video;
    await video.play().catch(() => {
      /* iOS may resolve later — keep going */
    });

    const detector = detectorRef.current!;
    let lastTick = 0;
    const tick = async (ts: number) => {
      if (cancelledRef.current) return;
      // Throttle detect() to ~5 fps — plenty for QR, easy on battery
      if (ts - lastTick >= 180 && video!.readyState >= 2) {
        lastTick = ts;
        try {
          const results = await detector.detect(video!);
          if (results && results.length > 0 && results[0].rawValue) {
            finishWith(results[0].rawValue);
            return;
          }
        } catch {
          /* ignore single-frame errors */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // ---- Path B: html5-qrcode fallback (older iOS, in-app browsers) --------
  const startHtml5 = async (mode: FacingMode) => {
    const region = document.getElementById(REGION_ID);
    if (!region) throw new Error("ไม่พบพื้นที่แสดงผลกล้อง");

    // Patch <video> as soon as html5-qrcode injects it
    observerCleanupRef.current = patchVideoElement(region);

    const scanner = new Html5Qrcode(REGION_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    html5Ref.current = scanner;
    await scanner.start(
      { facingMode: { ideal: mode } },
      {
        fps: 10,
        qrbox: (vw, vh) => {
          const size = Math.floor(Math.min(vw, vh) * 0.85);
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
        disableFlip: false,
      },
      (decodedText) => finishWith(decodedText),
      () => {
        /* per-frame errors are normal; ignore */
      },
    );
  };

  const startWith = async (mode: FacingMode) => {
    await stopAll();
    if (cancelledRef.current) return;
    setStarting(true);
    try {
      // Wait one frame so the dialog is laid out (iOS dislikes getUserMedia
      // before the container has real dimensions)
      await new Promise((r) => setTimeout(r, 250));
      if (cancelledRef.current) return;

      if (detectorRef.current) {
        try {
          await startNative(mode);
          setUsingNative(true);
          setFacing(mode);
          return;
        } catch (err) {
          // Native path failed — try html5-qrcode (covers some iOS quirks)
          console.warn("Native BarcodeDetector failed, falling back", err);
          await stopAll();
          if (cancelledRef.current) return;
        }
      }

      await startHtml5(mode);
      setUsingNative(false);
      setFacing(mode);
    } catch (err) {
      toast.error(formatCameraError(err));
      // Don't auto-close — the file fallback should remain accessible
    } finally {
      setStarting(false);
    }
  };

  // Init on open
  useEffect(() => {
    if (!open) return;
    cancelledRef.current = false;

    (async () => {
      // Detect native QR support once per open
      if (await hasNativeQrDetector()) {
        const Ctor = (
          window as unknown as { BarcodeDetector: BarcodeDetectorCtor }
        ).BarcodeDetector;
        detectorRef.current = new Ctor({ formats: ["qr_code"] });
      } else {
        detectorRef.current = null;
      }
      // Most phones have both — keep button visible; on iOS Safari we'll
      // discover the second cam only if facingMode switch actually succeeds.
      setCanSwitch(true);
      await startWith("environment");
    })();

    return () => {
      cancelledRef.current = true;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    const next: FacingMode = facing === "environment" ? "user" : "environment";
    await startWith(next);
  };

  // ---- File fallback: decode a photo taken with the native Camera app ----
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      // Try native detector first
      if (detectorRef.current && "createImageBitmap" in window) {
        const bitmap = await createImageBitmap(file);
        const results = await detectorRef.current.detect(bitmap);
        if (results && results.length > 0 && results[0].rawValue) {
          finishWith(results[0].rawValue);
          return;
        }
      }
      // Fallback: html5-qrcode file scan (uses its own decoder)
      await stopAll();
      const tmp = new Html5Qrcode(REGION_ID, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      try {
        const text = await tmp.scanFile(file, false);
        finishWith(text);
      } finally {
        try {
          tmp.clear();
        } catch {
          /* noop */
        }
      }
      // Re-open camera if we're still on screen
      if (!cancelledRef.current) await startWith(facing);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `อ่าน QR จากรูปไม่สำเร็จ: ${err.message}`
          : "อ่าน QR จากรูปไม่สำเร็จ",
      );
      if (!cancelledRef.current) await startWith(facing);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-w-full gap-2 rounded-none p-3 sm:h-auto sm:max-w-lg sm:rounded-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle>สแกน QR Code</DialogTitle>
          <DialogDescription>
            จัดให้ QR อยู่กลางกรอบ ระบบจะอ่านให้อัตโนมัติ
            {isIOS() && !usingNative && !starting && (
              <span className="ml-1 text-xs text-muted-foreground">
                (โหมดเข้ากันได้)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full flex-1 overflow-hidden rounded-xl bg-black sm:aspect-square sm:flex-none">
          <div
            id={REGION_ID}
            className="h-full w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
          />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {canSwitch && (
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={starting}
              className="h-11 gap-2"
            >
              <SwitchCamera className="h-4 w-4" />
              สลับกล้อง
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={starting}
            className={`h-11 gap-2 ${canSwitch ? "" : "col-span-2"}`}
          >
            <ImagePlus className="h-4 w-4" />
            ถ่ายภาพ QR แทน
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFilePicked}
        />
      </DialogContent>
    </Dialog>
  );
}
