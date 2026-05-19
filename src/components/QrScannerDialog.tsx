import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SwitchCamera, Loader2, ImagePlus, Camera, AlertCircle } from "lucide-react";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScanned: (text: string) => void;
  /**
   * Camera stream pre-acquired from a user-gesture context (e.g. a button
   * onClick). Required on iOS Safari / WKWebView, which lose transient
   * activation by the time this dialog's effect fires and would otherwise
   * silently reject `getUserMedia`. Use {@link acquireCameraStream} in the
   * click handler and pass the result here.
   */
  initialStream?: MediaStream | null;
}

const REGION_ID = "qr-scan-region";

// ---- Environment detection ------------------------------------------------
const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
};

const getIOSVersion = (): number | null => {
  if (typeof navigator === "undefined") return null;
  const m = navigator.userAgent.match(/OS (\d+)_/);
  return m ? parseInt(m[1], 10) : null;
};

const isInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Line|FBAN|FBAV|Instagram|MicroMessenger|TikTok/i.test(ua);
};

const isSecureCtx = (): boolean => {
  if (typeof window === "undefined") return true;
  return window.isSecureContext === true || location.hostname === "localhost";
};

// Apply iOS-friendly attributes to the <video> element rendered by html5-qrcode
function patchVideoElement(container: HTMLElement) {
  const apply = (v: HTMLVideoElement) => {
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    v.setAttribute("muted", "true");
    v.setAttribute("autoplay", "true");
    v.muted = true;
    v.autoplay = true;
    v.playsInline = true;
    v.play().catch(() => {});
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

export interface CameraErrorInfo {
  message: string;
  hint?: string;
  showRetry: boolean;
}

export function formatCameraError(err: unknown): CameraErrorInfo {
  const e = err as { name?: string; message?: string } | undefined;
  const name = e?.name || "";

  if (!isSecureCtx()) {
    return {
      message: "ต้องเปิดผ่าน HTTPS เพื่อใช้กล้อง",
      hint: "เปิดเว็บไซต์ผ่าน https:// แล้วลองใหม่",
      showRetry: false,
    };
  }
  if (isInAppBrowser()) {
    return {
      message: "เบราว์เซอร์ในแอปไม่รองรับกล้องอย่างเต็มที่",
      hint: "กดเมนู (•••) มุมขวาบน แล้วเลือก ‘เปิดใน Safari/Chrome’",
      showRetry: true,
    };
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    if (isIOS()) {
      return {
        message: "ไม่ได้รับอนุญาตให้ใช้กล้อง",
        hint: "iOS: ไปที่ ตั้งค่า > Safari > กล้อง > อนุญาต  หรือแตะ ‘อา’ ในแถบที่อยู่ > Website Settings > Camera > Allow แล้วโหลดหน้าใหม่",
        showRetry: true,
      };
    }
    return {
      message: "ไม่ได้รับอนุญาตให้ใช้กล้อง",
      hint: "เปิดสิทธิ์กล้องในตั้งค่าเบราว์เซอร์ แล้วลองใหม่",
      showRetry: true,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { message: "ไม่พบกล้องบนอุปกรณ์นี้", showRetry: false };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      message: "กล้องถูกใช้งานโดยแอปอื่น",
      hint: "ปิดแอปกล้อง/วิดีโอคอลที่ใช้กล้องอยู่ แล้วกดลองใหม่",
      showRetry: true,
    };
  }
  if (name === "OverconstrainedError") {
    return {
      message: "อุปกรณ์ไม่รองรับการตั้งค่ากล้องนี้",
      hint: "กด ‘ลองใหม่’ ระบบจะลองโหมดเข้ากันได้",
      showRetry: true,
    };
  }
  if (name === "SecurityError") {
    return {
      message: "ต้องเปิดผ่าน HTTPS เพื่อใช้กล้อง",
      showRetry: false,
    };
  }
  return {
    message: e?.message || "ไม่สามารถเข้าถึงกล้องได้",
    hint: "กด ‘ลองใหม่’ หรือใช้ ‘ถ่ายภาพ QR แทน’",
    showRetry: true,
  };
}

type FacingMode = "environment" | "user";

/**
 * Open the camera from a synchronous user-gesture context (e.g. a button
 * onClick) so iOS Safari / WKWebView honor the request. The function must
 * not `await` anything before calling `getUserMedia`, otherwise the
 * transient activation is lost.
 *
 * On success the caller is responsible for the returned stream — pass it
 * straight into <QrScannerDialog initialStream={stream}/>; the dialog
 * takes ownership and stops the tracks when it closes.
 */
export async function acquireCameraStream(
  facing: FacingMode = "environment",
): Promise<{ stream: MediaStream } | { errorInfo: CameraErrorInfo }> {
  try {
    if (!isSecureCtx()) {
      throw Object.assign(new Error("Insecure context"), {
        name: "SecurityError",
      });
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error("ไม่รองรับกล้องบนเบราว์เซอร์นี้"), {
        name: "NotFoundError",
      });
    }
    if (isInAppBrowser()) {
      throw Object.assign(new Error("In-app browser"), {
        name: "NotAllowedError",
      });
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing } },
    });
    return { stream };
  } catch (err) {
    return { errorInfo: formatCameraError(err) };
  }
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

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

// Build a ladder of constraints from strictest -> loosest.
function buildConstraintLadder(mode: FacingMode): MediaStreamConstraints[] {
  return [
    {
      audio: false,
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    {
      audio: false,
      video: { facingMode: { ideal: mode } },
    },
    {
      audio: false,
      video: { facingMode: mode },
    },
    { audio: false, video: true },
  ];
}

export function QrScannerDialog({ open, onOpenChange, onScanned, initialStream = null }: QrScannerDialogProps) {
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const observerCleanupRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Stream pre-acquired by the caller during the user gesture. Consumed on
  // first use; camera switches / retries fall back to getUserMedia (which
  // works without a gesture because permission is now cached).
  const pendingStreamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<FacingMode>("environment");
  const [starting, setStarting] = useState(false);
  const [usingNative, setUsingNative] = useState(false);
  const [legacyMode, setLegacyMode] = useState(false);
  const [errorInfo, setErrorInfo] = useState<CameraErrorInfo | null>(null);
  // Temporary on-screen diagnostic; remove after the iOS issue is solved.
  const [diag, setDiag] = useState<string | null>(null);

  const stopAll = async () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (observerCleanupRef.current) {
      observerCleanupRef.current();
      observerCleanupRef.current = null;
    }
    // NB: do NOT stop pendingStreamRef here. stopAll is called at the top of
    // startWith() to reset mid-flow state, and we must preserve the
    // pre-acquired stream so the iOS path can consume it. The pending stream
    // is stopped by the useEffect cleanup when the dialog actually closes.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
      videoRef.current.srcObject = null;
    }
    const s = html5Ref.current;
    html5Ref.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {}
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

  // ---- Path A: native BarcodeDetector with constraint ladder -------------
  const startNative = async (mode: FacingMode): Promise<void> => {
    const region = document.getElementById(REGION_ID);
    if (!region) throw new Error("ไม่พบพื้นที่แสดงผลกล้อง");

    let stream: MediaStream | null = null;

    // Prefer the stream the caller acquired during the user gesture. Only
    // a fresh request can hit the user-activation requirement on iOS, so
    // we never want to re-acquire if we already have one.
    const pending = pendingStreamRef.current;
    if (pending && pending.active && pending.getVideoTracks().length > 0) {
      stream = pending;
      pendingStreamRef.current = null;
    } else {
      const ladder = buildConstraintLadder(mode);
      let lastErr: unknown = null;
      for (let i = 0; i < ladder.length; i++) {
        if (cancelledRef.current) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia(ladder[i]);
          if (i > 0) setLegacyMode(true);
          break;
        } catch (e) {
          lastErr = e;
          const name = (e as { name?: string })?.name;
          // Permission/secure errors → don't retry the ladder
          if (
            name === "NotAllowedError" ||
            name === "PermissionDeniedError" ||
            name === "SecurityError" ||
            name === "NotFoundError"
          ) {
            throw e;
          }
        }
      }
      if (!stream) throw lastErr ?? new Error("ไม่สามารถเปิดกล้องได้");
    }

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
    await video.play().catch(() => {});

    const detector = detectorRef.current!;
    let lastTick = 0;
    const tick = async (ts: number) => {
      if (cancelledRef.current) return;
      if (ts - lastTick >= 200 && video!.readyState >= 2) {
        lastTick = ts;
        try {
          const results = await detector.detect(video!);
          if (results && results.length > 0 && results[0].rawValue) {
            finishWith(results[0].rawValue);
            return;
          }
        } catch {}
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // ---- Path A2: pre-acquired stream + html5-qrcode scanFile loop ---------
  // Used on iOS / any browser without BarcodeDetector when the caller
  // pre-acquired the stream. We attach the stream to our own <video> element
  // (with `playsinline` set BEFORE `srcObject`, which iOS requires) and
  // decode by snapshotting frames to canvas → Blob → Html5Qrcode.scanFile.
  const startWithExistingStream = async (stream: MediaStream): Promise<void> => {
    const region = document.getElementById(REGION_ID);
    if (!region) throw new Error("ไม่พบพื้นที่แสดงผลกล้อง");

    // Remove any leftover video so we own the element and its attributes.
    region.querySelectorAll("video").forEach((v) => v.remove());

    const video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("muted", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.className = "h-full w-full object-cover";
    region.appendChild(video);
    video.srcObject = stream;
    videoRef.current = video;
    streamRef.current = stream;
    pendingStreamRef.current = null;

    let playError = "";
    try {
      await video.play();
    } catch (e) {
      playError = (e as Error)?.name || "playError";
      // iOS may need a beat after srcObject; retry once.
      await new Promise((r) => setTimeout(r, 50));
      try {
        await video.play();
        playError = "";
      } catch (e2) {
        playError = (e2 as Error)?.name || "playError2";
      }
    }

    // Snapshot video state ~600ms after play() to expose what iOS is doing.
    setTimeout(() => {
      const tracks = stream.getVideoTracks();
      const settings = tracks[0]?.getSettings?.() ?? {};
      const snap = {
        play: playError || "ok",
        ready: video.readyState,
        vw: video.videoWidth,
        vh: video.videoHeight,
        cw: video.clientWidth,
        ch: video.clientHeight,
        paused: video.paused,
        srcObj: !!video.srcObject,
        active: stream.active,
        tracks: tracks.length,
        live: tracks[0]?.readyState,
        w: settings.width,
        h: settings.height,
      };
      setDiag(JSON.stringify(snap));
    }, 600);

    // scanFile decoder — reuses REGION_ID but with showImage=false it does
    // not add or render anything in there.
    const decoder = new Html5Qrcode(REGION_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    html5Ref.current = decoder;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("ไม่สามารถสร้าง canvas");

    let lastScan = 0;
    let scanning = false;
    const tick = async (ts: number) => {
      if (cancelledRef.current) return;
      const ready = !scanning && ts - lastScan >= 350 && video.readyState >= 2 && video.videoWidth > 0;
      if (ready) {
        lastScan = ts;
        scanning = true;
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.7));
          if (blob) {
            const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
            try {
              const text = await decoder.scanFile(file, false);
              scanning = false;
              finishWith(text);
              return;
            } catch {
              // QR not present in this frame — keep scanning.
            }
          }
        } catch {
          // drawImage / toBlob can transiently fail while video is warming up.
        }
        scanning = false;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // ---- Path B: html5-qrcode fallback with legacy-friendly settings -------
  const startHtml5 = async (mode: FacingMode): Promise<void> => {
    const region = document.getElementById(REGION_ID);
    if (!region) throw new Error("ไม่พบพื้นที่แสดงผลกล้อง");

    observerCleanupRef.current = patchVideoElement(region);

    const iosVer = getIOSVersion();
    const useLegacy = legacyMode || (isIOS() && (iosVer ?? 99) < 15);
    const fps = useLegacy ? 5 : 10;

    const scanner = new Html5Qrcode(REGION_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    html5Ref.current = scanner;

    // Try several configurations from strictest to loosest
    const configs: Array<{
      camera: MediaTrackConstraints | { facingMode: string };
      config: Parameters<Html5Qrcode["start"]>[1];
    }> = [
      {
        camera: { facingMode: { ideal: mode } } as MediaTrackConstraints,
        config: {
          fps,
          qrbox: (vw, vh) => {
            const size = Math.floor(Math.min(vw, vh) * (useLegacy ? 0.7 : 0.85));
            return { width: size, height: size };
          },
          disableFlip: false,
        },
      },
      {
        camera: { facingMode: mode },
        config: {
          fps,
          qrbox: (vw, vh) => {
            const size = Math.floor(Math.min(vw, vh) * 0.7);
            return { width: size, height: size };
          },
          disableFlip: false,
        },
      },
      {
        camera: { facingMode: "environment" },
        config: { fps: 5, disableFlip: false },
      },
    ];

    let lastErr: unknown = null;
    for (let i = 0; i < configs.length; i++) {
      if (cancelledRef.current) return;
      try {
        await scanner.start(
          configs[i].camera as never,
          configs[i].config,
          (decodedText) => finishWith(decodedText),
          () => {},
        );
        if (i > 0) setLegacyMode(true);
        return;
      } catch (e) {
        lastErr = e;
        const name = (e as { name?: string })?.name;
        if (
          name === "NotAllowedError" ||
          name === "PermissionDeniedError" ||
          name === "SecurityError" ||
          name === "NotFoundError"
        ) {
          throw e;
        }
      }
    }
    throw lastErr ?? new Error("ไม่สามารถเปิดกล้องได้");
  };

  const startWith = async (mode: FacingMode) => {
    await stopAll();
    if (cancelledRef.current) return;
    setStarting(true);
    setErrorInfo(null);

    try {
      // Preflight checks
      if (!isSecureCtx()) {
        throw Object.assign(new Error("Insecure context"), {
          name: "SecurityError",
        });
      }
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw Object.assign(new Error("ไม่รองรับกล้องบนเบราว์เซอร์นี้"), {
          name: "NotFoundError",
        });
      }

      if (detectorRef.current) {
        try {
          await startNative(mode);
          setUsingNative(true);
          setFacing(mode);
          return;
        } catch (err) {
          const name = (err as { name?: string })?.name;
          if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
            throw err;
          }
          console.warn("Native BarcodeDetector failed, falling back", err);
          await stopAll();
          if (cancelledRef.current) return;
        }
      }

      // iOS / no-BarcodeDetector path: if the caller pre-acquired a stream
      // during the user gesture, use it directly. This avoids handing the
      // camera to html5-qrcode (which re-runs getUserMedia and whose
      // <video> element doesn't reliably honor `playsinline` on iOS — the
      // root cause of the "permission granted but no video feed" bug).
      const pending = pendingStreamRef.current;
      if (pending && pending.active && pending.getVideoTracks().length > 0) {
        await startWithExistingStream(pending);
        setUsingNative(false);
        setFacing(mode);
        return;
      }

      // No usable pre-acquired stream — release any leftover before letting
      // html5-qrcode manage its own getUserMedia.
      if (pendingStreamRef.current) {
        pendingStreamRef.current.getTracks().forEach((t) => t.stop());
        pendingStreamRef.current = null;
      }
      await startHtml5(mode);
      setUsingNative(false);
      setFacing(mode);
    } catch (err) {
      const info = formatCameraError(err);
      setErrorInfo(info);
      const e = err as { name?: string; message?: string };
      setDiag(`ERR name=${e?.name || "?"} msg=${String(e?.message || err).slice(0, 200)}`);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    cancelledRef.current = false;
    setErrorInfo(null);
    setLegacyMode(false);
    setDiag(null);
    pendingStreamRef.current = initialStream ?? null;

    (async () => {
      if (await hasNativeQrDetector()) {
        const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
        detectorRef.current = new Ctor({ formats: ["qr_code"] });
      } else {
        detectorRef.current = null;
      }
      await startWith("environment");
    })();

    return () => {
      cancelledRef.current = true;
      if (pendingStreamRef.current) {
        pendingStreamRef.current.getTracks().forEach((t) => t.stop());
        pendingStreamRef.current = null;
      }
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    const next: FacingMode = facing === "environment" ? "user" : "environment";
    await startWith(next);
  };

  const retryCamera = async () => {
    setLegacyMode(false);
    await startWith(facing);
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      if (detectorRef.current && "createImageBitmap" in window) {
        const bitmap = await createImageBitmap(file);
        const results = await detectorRef.current.detect(bitmap);
        if (results && results.length > 0 && results[0].rawValue) {
          finishWith(results[0].rawValue);
          return;
        }
      }
      await stopAll();
      const tmp = new Html5Qrcode(REGION_ID, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      try {
        const text = await tmp.scanFile(file, false);
        finishWith(text);
        return;
      } finally {
        try {
          tmp.clear();
        } catch {}
      }
    } catch (err) {
      toast.error(err instanceof Error ? `อ่าน QR จากรูปไม่สำเร็จ: ${err.message}` : "อ่าน QR จากรูปไม่สำเร็จ");
      if (!cancelledRef.current) await startWith(facing);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-w-full flex-col gap-2 rounded-none p-3 sm:h-auto sm:max-w-lg sm:rounded-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle>สแกน QR Code</DialogTitle>
          <DialogDescription>
            จัดให้ QR อยู่กลางกรอบ ระบบจะอ่านให้อัตโนมัติ
            {isIOS() && !usingNative && !starting && !errorInfo && (
              <span className="ml-1 text-xs text-muted-foreground">
                {legacyMode ? "(โหมดเข้ากันได้ iOS เก่า)" : "(โหมดเข้ากันได้)"}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {errorInfo && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-destructive">{errorInfo.message}</p>
              {errorInfo.hint && <p className="text-xs text-muted-foreground">{errorInfo.hint}</p>}
            </div>
          </div>
        )}

        {diag && (
          <div className="rounded border border-yellow-400/60 bg-yellow-50 p-2 text-[11px] leading-tight text-yellow-900 break-all">
            <span className="font-bold">DIAG:</span> {diag}
          </div>
        )}

        <div className="relative w-full flex-1 min-h-[55vh] overflow-hidden rounded-xl bg-black sm:aspect-square sm:flex-none sm:min-h-0">
          <div id={REGION_ID} className="h-full w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover" />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {errorInfo && !starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-4 text-center text-white">
              <Camera className="h-10 w-10 opacity-80" />
              <p className="text-sm">กล้องยังไม่พร้อมใช้งาน</p>
            </div>
          )}
        </div>

        {errorInfo?.showRetry && (
          <Button onClick={retryCamera} disabled={starting} className="h-11 gap-2">
            <Camera className="h-4 w-4" />
            อนุญาตและเปิดกล้องอีกครั้ง
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={switchCamera} disabled={starting} className="h-11 gap-2">
            <SwitchCamera className="h-4 w-4" />
            สลับกล้อง
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={starting}
            className="h-11 gap-2"
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
