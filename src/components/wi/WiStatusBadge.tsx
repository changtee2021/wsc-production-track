import { cn } from "@/lib/utils";
import { WI_STATUS_LABEL, type WiStatus } from "@/lib/wi/wi-schema";

const STATUS_CLASS: Record<WiStatus, string> = {
  draft: "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  pending_review:
    "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  published:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  archived: "border-zinc-300 bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
};

export function WiStatusBadge({ status, className }: { status: WiStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "draft" && "bg-slate-400",
          status === "pending_review" && "bg-amber-500",
          status === "published" && "bg-emerald-500",
          status === "archived" && "bg-zinc-400",
        )}
      />
      {WI_STATUS_LABEL[status]}
    </span>
  );
}

export function WiVersionTag({ label }: { label: string | null }) {
  if (!label) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs">
      {label}
    </span>
  );
}
