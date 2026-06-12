import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, AlertTriangle } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export type LightboxItem = { type: "image" | "video"; url: string };

interface Props {
  item: LightboxItem | null;
  signedSrc: (ref: string) => string;
  onClose: () => void;
}

// ตรวจชนิดไฟล์จาก ref ต้นทาง (เช่น "video/xxx.mov") ไม่ใช่ signed URL
function detectExt(ref: string): string | null {
  const m = ref.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
  return m ? m[1].toLowerCase() : null;
}

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

function VideoView({ src, originalRef }: { src: string; originalRef: string }) {
  const [failed, setFailed] = useState(false);
  const ext = detectExt(originalRef);
  const isMov = ext === "mov" || ext === "qt";
  const isM4v = ext === "m4v";

  return (
    <div className="flex flex-col gap-3">
      {!failed ? (
        <video
          key={src}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="mx-auto max-h-[80vh] w-auto"
          onError={() => setFailed(true)}
          onPointerDownCapture={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg bg-background p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h3 className="text-base font-semibold">เล่นวิดีโอในเบราว์เซอร์นี้ไม่ได้</h3>
          <p className="text-sm text-muted-foreground">
            {isMov || isM4v
              ? "ไฟล์ .mov/.m4v จาก iPhone (มักเข้ารหัส HEVC/H.265) Chrome/Edge บน Windows ส่วนใหญ่เล่นไม่ได้ในหน้าเว็บ"
              : "เบราว์เซอร์ไม่รองรับ codec ของวิดีโอนี้"}
            <br />
            ลองกด "เปิดในแท็บใหม่" หรือ "ดาวน์โหลด" เพื่อเล่นด้วยโปรแกรมในเครื่อง (เช่น VLC,
            QuickTime)
            {(isMov || isM4v) && (
              <>
                <br />
                <span className="mt-1 inline-block text-xs">
                  แนะนำ: ตั้งค่า iPhone → กล้อง → รูปแบบ → "เข้ากันได้สูงสุด" เพื่อให้บันทึกเป็น MP4
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

export function warnIfMovFiles(files: FileList | File[]): void {
  const arr = Array.from(files as ArrayLike<File>);
  const hasMov = arr.some((f) => f.type === "video/quicktime" || /\.mov$/i.test(f.name));
  if (hasMov) {
    import("sonner").then(({ toast }) =>
      toast.warning("ไฟล์ .mov อาจเปิดดูในเว็บไม่ได้", {
        description:
          "ผู้ดูบน Windows/Chrome อาจต้องกด 'ดาวน์โหลด' เพื่อเล่น แนะนำตั้งค่า iPhone: กล้อง → รูปแบบ → เข้ากันได้สูงสุด เพื่อให้ได้ไฟล์ MP4",
        duration: 7000,
      }),
    );
  }
}
