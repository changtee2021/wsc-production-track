import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, AlertTriangle, Loader2 } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export type LightboxItem = { type: "image" | "video"; url: string };

interface Props {
  item: LightboxItem | null;
  signedSrc: (ref: string) => string;
  onClose: () => void;
}

function detectExt(ref: string): string | null {
  const m = ref.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Prefer local blob playback under this size — avoids signed-URL range/stutter issues. */
const BLOB_PLAY_MAX_BYTES = 80 * 1024 * 1024;

export function MediaLightbox({ item, signedSrc, onClose }: Props) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-0 bg-black/95 p-2 sm:p-4">
        <VisuallyHidden>
          <DialogTitle>แสดงสื่อ</DialogTitle>
          <DialogDescription>รูปภาพหรือวิดีโอประกอบรายงาน</DialogDescription>
        </VisuallyHidden>
        {item &&
          (item.type === "image" ? (
            <img
              src={signedSrc(item.url)}
              alt=""
              className="mx-auto max-h-[85vh] w-auto object-contain"
            />
          ) : (
            <VideoView src={signedSrc(item.url)} originalRef={item.url} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

type PlayState = "loading" | "ready" | "failed";

function VideoView({ src, originalRef }: { src: string; originalRef: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playSrc, setPlaySrc] = useState<string | null>(null);
  const [state, setState] = useState<PlayState>("loading");
  const [failReason, setFailReason] = useState<"network" | "codec" | "unknown">("unknown");
  const [progress, setProgress] = useState(0);
  const ext = detectExt(originalRef);
  const isMov = ext === "mov" || ext === "qt";
  const isM4v = ext === "m4v";
  const isWebm = ext === "webm";

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState("loading");
    setFailReason("unknown");
    setProgress(0);
    setPlaySrc(null);

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw Object.assign(new Error("network"), { network: true });

        const len = Number(res.headers.get("content-length") || 0);
        if (len > BLOB_PLAY_MAX_BYTES) {
          // Too large — stream directly from signed URL
          if (!cancelled) setPlaySrc(src);
          return;
        }

        if (!res.body) {
          const blob = await res.blob();
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPlaySrc(objectUrl);
          return;
        }

        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (len > 0) setProgress(Math.min(99, Math.round((received / len) * 100)));
            if (received > BLOB_PLAY_MAX_BYTES) {
              // Abort blob strategy — fall back to direct URL
              reader.cancel().catch(() => {});
              if (!cancelled) setPlaySrc(src);
              return;
            }
          }
        }
        if (cancelled) return;
        const mime =
          res.headers.get("content-type") || sniffMimeFromChunks(chunks) || guessMime(ext);
        const blob = new Blob(chunks as BlobPart[], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        setProgress(100);
        setPlaySrc(objectUrl);
      } catch (e) {
        if (cancelled) return;
        // Fallback: try playing signed URL directly
        setPlaySrc(src);
        if (e && typeof e === "object" && "network" in e) {
          setFailReason("network");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, ext]);

  const onLoaded = () => setState("ready");

  const onError = () => {
    const el = videoRef.current;
    const code = el?.error?.code;
    if (code === 2) setFailReason("network");
    else if (code === 3 || code === 4) setFailReason("codec");
    else if (failReason === "unknown") setFailReason("unknown");
    setState("failed");
  };

  const hint =
    failReason === "network"
      ? "โหลดไฟล์ไม่สำเร็จ (ลิงก์หมดอายุหรือเน็ตช้า) — ลองรีเฟรชหน้า หรือกดดาวน์โหลด"
      : isWebm
        ? "ไฟล์ WebM อาจเปิดใน Safari ไม่ได้ — ลองเปิดใน Chrome หรือกดดาวน์โหลด"
        : isMov || isM4v || failReason === "codec"
          ? "เบราว์เซอร์นี้เล่นไฟล์นี้ไม่ได้ (มักเป็น HEVC จาก iPhone หรือไฟล์จาก LINE) — กดดาวน์โหลดแล้วเปิดด้วย VLC"
          : "เล่นวิดีโอไม่สำเร็จ — ลองเปิดในแท็บใหม่หรือดาวน์โหลด";

  return (
    <div className="flex flex-col gap-3">
      {state !== "failed" ? (
        <div className="relative mx-auto flex min-h-[200px] max-h-[80vh] w-full items-center justify-center">
          {state === "loading" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>กำลังโหลดวิดีโอ{progress > 0 ? ` ${progress}%` : "..."}</span>
            </div>
          )}
          {playSrc && (
            <video
              ref={videoRef}
              key={playSrc}
              src={playSrc}
              controls
              playsInline
              preload="auto"
              className="mx-auto max-h-[80vh] w-auto bg-black"
              onLoadedData={onLoaded}
              onCanPlay={onLoaded}
              onError={onError}
              onPointerDownCapture={(e) => e.stopPropagation()}
            />
          )}
        </div>
      ) : (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg bg-background p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h3 className="text-base font-semibold">เล่นวิดีโอในเบราว์เซอร์นี้ไม่ได้</h3>
          <p className="text-sm text-muted-foreground">
            {hint}
            {(isMov || isM4v) && (
              <>
                <br />
                <span className="mt-1 inline-block text-xs">
                  แนะนำ iPhone: ตั้งค่า → กล้อง → รูปแบบ → &quot;เข้ากันได้สูงสุด&quot;
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={src} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-4 w-4" /> เปิดในแท็บใหม่
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href={src} download>
            <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด
          </a>
        </Button>
      </div>
    </div>
  );
}

function guessMime(ext: string | null): string {
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  return "video/mp4";
}

/** Prefer real container MIME after backfill may replace .mov bytes with H.264 MP4. */
function sniffMimeFromChunks(chunks: Uint8Array[]): string | null {
  if (!chunks.length) return null;
  const first = chunks[0]!;
  if (
    first.length >= 4 &&
    first[0] === 0x1a &&
    first[1] === 0x45 &&
    first[2] === 0xdf &&
    first[3] === 0xa3
  ) {
    return "video/webm";
  }
  if (
    first.length >= 8 &&
    first[4] === 0x66 &&
    first[5] === 0x74 &&
    first[6] === 0x79 &&
    first[7] === 0x70
  ) {
    return "video/mp4";
  }
  return null;
}

export function warnIfMovFiles(files: FileList | File[]): void {
  const arr = Array.from(files as ArrayLike<File>);
  const hasMov = arr.some((f) => f.type === "video/quicktime" || /\.mov$/i.test(f.name));
  if (hasMov) {
    import("sonner").then(({ toast }) =>
      toast.info("อัปได้เลย — ระบบจะแปลงวิดีโอเบื้องหลัง", {
        description: "ไฟล์จาก iPhone/LINE จะถูกแปลงเป็น MP4 (H.264) หลังอัป ไม่ต้องรอก่อนส่งงาน",
        duration: 5000,
      }),
    );
  }
}
