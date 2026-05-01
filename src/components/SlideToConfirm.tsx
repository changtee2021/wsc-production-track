import { useEffect, useRef, useState } from "react";
import { ChevronsRight, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideToConfirmProps {
  label: string;
  onConfirm: () => void | Promise<void>;
  icon: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** tailwind bg + text classes for the track (e.g. "bg-secondary text-secondary-foreground") */
  colorClass?: string;
  /** tailwind bg class for the slider thumb (e.g. "bg-secondary-foreground text-secondary") */
  thumbClass?: string;
}

/**
 * Slide-to-confirm control to prevent accidental taps on critical actions.
 * Drag the thumb to the right ≥ 85% of the track width to fire onConfirm.
 */
export function SlideToConfirm({
  label,
  onConfirm,
  icon: Icon,
  loading = false,
  disabled = false,
  colorClass = "bg-secondary text-secondary-foreground",
  thumbClass = "bg-white text-secondary",
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const maxXRef = useRef(0);

  const THUMB_SIZE = 56;

  const reset = () => {
    setDragX(0);
    setDragging(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || loading) return;
    const track = trackRef.current;
    if (!track) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    maxXRef.current = track.clientWidth - THUMB_SIZE - 8;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = Math.max(0, Math.min(maxXRef.current, e.clientX - startXRef.current));
    setDragX(dx);
  };

  const onPointerUp = async () => {
    if (!dragging) return;
    const completed = dragX >= maxXRef.current * 0.85;
    setDragging(false);
    if (completed) {
      setDragX(maxXRef.current);
      await onConfirm();
      // small delay so user sees confirmation before snap-back
      setTimeout(reset, 300);
    } else {
      setDragX(0);
    }
  };

  // reset when disabled flips
  useEffect(() => {
    if (disabled) reset();
  }, [disabled]);

  const progress = maxXRef.current > 0 ? dragX / maxXRef.current : 0;

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-16 w-full select-none overflow-hidden rounded-2xl shadow-md",
        colorClass,
        disabled && "opacity-50",
      )}
    >
      {/* progress fill */}
      <div
        className="absolute inset-y-0 left-0 bg-black/15 transition-[width]"
        style={{ width: `${progress * 100}%` }}
      />
      {/* label */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-bold tracking-wide">
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            กำลังบันทึก…
          </span>
        ) : (
          <span style={{ opacity: 1 - progress * 1.2 }}>เลื่อนเพื่อ{label} →</span>
        )}
      </div>
      {/* thumb */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "absolute top-1 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg touch-none",
          thumbClass,
          !dragging && "transition-transform",
          (disabled || loading) && "pointer-events-none",
        )}
        style={{ transform: `translateX(${dragX + 4}px)` }}
        role="button"
        aria-label={`เลื่อนเพื่อ${label}`}
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : progress > 0.3 ? (
          <Icon className="h-6 w-6 fill-current" />
        ) : (
          <ChevronsRight className="h-7 w-7" />
        )}
      </div>
    </div>
  );
}
