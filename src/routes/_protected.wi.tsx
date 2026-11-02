import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ACTOR_NEEDED_EVENT, WI_ACCENT_BTN, useWiActor } from "@/lib/wi/wi-client";

export const Route = createFileRoute("/_protected/wi")({
  head: () => ({
    meta: [{ title: "Work Instructions — WSC ProductionTrack" }],
  }),
  component: WiLayout,
});

function WiLayout() {
  const [actor, setActor] = useWiActor();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(actor);
  useEffect(() => setValue(actor), [actor]);

  useEffect(() => {
    const onNeeded = () => setOpen(true);
    window.addEventListener(ACTOR_NEEDED_EVENT, onNeeded);
    return () => window.removeEventListener(ACTOR_NEEDED_EVENT, onNeeded);
  }, []);

  const commit = () => {
    if (!value.trim()) return;
    if (value.trim() !== actor) setActor(value);
    setOpen(false);
  };

  return (
    <div>
      <div className="mx-auto flex min-h-[3.25rem] max-w-7xl justify-end px-4 pt-3">
        {mounted && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  actor
                    ? "border-border bg-card text-muted-foreground hover:text-foreground"
                    : "border-amber-300 bg-amber-50 font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
                )}
              >
                <UserRound className="h-4 w-4" />
                {actor ? (
                  <>
                    ทำในนาม <span className="font-semibold text-foreground">{actor}</span>
                    <Pencil className="h-3.5 w-3.5" />
                  </>
                ) : (
                  "ใส่ชื่อผู้ทำรายการ"
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div>
                <label htmlFor="wi-actor" className="text-sm font-semibold">
                  ชื่อผู้ทำรายการ
                </label>
                <p className="text-xs text-muted-foreground">
                  บันทึกในประวัติทุกครั้งที่สร้าง แก้ไข หรืออนุมัติ WI
                </p>
              </div>
              <Input
                id="wi-actor"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                placeholder="พิมพ์ชื่อของคุณ"
                maxLength={120}
                autoFocus
                className="h-10"
              />
              <Button
                className={cn("h-10 w-full", WI_ACCENT_BTN)}
                disabled={!value.trim()}
                onClick={commit}
              >
                บันทึกชื่อ
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Outlet />
    </div>
  );
}
