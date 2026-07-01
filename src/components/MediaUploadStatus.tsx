import { Loader2 } from "lucide-react";

export type MediaUploadStatus =
  | { phase: "idle" }
  | { phase: "compressing"; percent: number }
  | { phase: "uploading" };

export function MediaUploadStatusLine({ status }: { status: MediaUploadStatus }) {
  if (status.phase === "idle") return null;

  const label =
    status.phase === "compressing"
      ? `กำลังบีบอัดวิดีโอ ${status.percent}%`
      : "กำลังอัปโหลด...";

  const barPercent = status.phase === "compressing" ? status.percent : undefined;

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>{label}</span>
      </div>
      {barPercent !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-secondary transition-[width] duration-300"
            style={{ width: `${barPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
