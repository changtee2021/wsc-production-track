import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, AlertTriangle } from "lucide-react";

export type LightboxItem = { type: "image" | "video"; url: string };

interface Props {
  item: LightboxItem | null;
  signedSrc: (ref: string) => string;
  onClose: () => void;
}

export function MediaLightbox({ item, signedSrc, onClose }: Props) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-0 bg-black/95 p-2 sm:p-4">
        {item && (
          item.type === "image" ? (
            <img
              src={signedSrc(item.url)}
              alt=""
              className="mx-auto max-h-[85vh] w-auto object-contain"
            />
          ) : (
            <VideoView src={signedSrc(item.url)} />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

function VideoView({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const isMov = /\.mov($|\?)/i.test(src);

  return (
    <div className="flex flex-col gap-3">
      {!failed ? (
        <video
          key={src}
          src={src}
          controls
          autoPlay
          playsInline
          className="mx-auto max-h-[80vh] w-auto"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg bg-background p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h3 className="text-base font-semibold">เล่นวิดีโอในเบราว์เซอร์ไม่ได้</h3>
          <p className="text-sm text-muted-foreground">
            {isMov
              ? "ไฟล์ .mov จาก iPhone (HEVC/H.265) มักเล่นไม่ได้บน Chrome/Edge บน Windows"
              : "เบราว์เซอร์ไม่รองรับวิดีโอรูปแบบนี้"}
            <br />
            ลองเปิดในแท็บใหม่หรือดาวน์โหลดเพื่อเล่นด้วยโปรแกรมในเครื่อง
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
  const hasMov = arr.some(
    (f) => f.type === "video/quicktime" || /\.mov$/i.test(f.name),
  );
  if (hasMov) {
    import("sonner").then(({ toast }) =>
      toast.warning("ไฟล์ .mov อาจเล่นไม่ได้บน Windows", {
        description:
          "แนะนำให้ตั้งค่า iPhone: กล้อง → รูปแบบ → เข้ากันได้สูงสุด (จะได้ MP4 แทน .mov)",
        duration: 6000,
      }),
    );
  }
}
