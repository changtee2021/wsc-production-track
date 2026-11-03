// "ดูคู่มือ" button on the scan page: shows the published WI linked to the
// selected production step (and product category) in a sheet, so the worker
// never leaves the scan flow. Opening it does not touch production status.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, BookOpenCheck, ChevronRight, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { wiPublicForStep, type WiReadStatus } from "@/lib/features/wi.functions";
import { WiLiveManual } from "@/components/wi/WiLiveManual";
import { WiEmployeePicker, WiLangSwitch } from "@/components/wi/WiReaderControls";
import { useWiLang, useWiReader } from "@/lib/wi/wi-i18n";

type Item = { code: string; title: string; version: string | null; read_status: WiReadStatus };

export function WiStepManualButton({
  stepId,
  categoryId,
  employeeId,
}: {
  stepId: string;
  categoryId: string;
  /** Employee chosen on the scan page; falls back to the reader saved on this device. */
  employeeId?: string;
}) {
  const forStepFn = useServerFn(wiPublicForStep);
  const [lang, , t] = useWiLang();
  const [reader, setReader] = useWiReader();
  const readerId = employeeId || reader?.id || null;
  const [items, setItems] = useState<Item[]>([]);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setItems([]);
    if (!stepId) return;
    let alive = true;
    forStepFn({
      data: { step_id: stepId, category_id: categoryId || null, employee_id: readerId },
    })
      .then((r) => alive && setItems(r.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [stepId, categoryId, readerId, forStepFn]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="mt-3 space-y-2">
        {items.map((it) => {
          const needsRead = !!readerId && it.read_status !== "read";
          return (
            <button
              key={it.code}
              type="button"
              onClick={() => setOpenCode(it.code)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left",
                needsRead
                  ? "border-[#E32D24] bg-[#E32D24]/10"
                  : "border-[#E32D24]/40 bg-[#E32D24]/5",
              )}
            >
              <BookOpenCheck className="h-6 w-6 shrink-0 text-[#E32D24]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  {t("stepManual")}
                  {readerId && it.read_status === "read" && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">
                      <BadgeCheck className="h-3 w-3" /> {t("readDone")}
                    </span>
                  )}
                  {readerId && it.read_status === "outdated" && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">
                      <Sparkles className="h-3 w-3" /> {t("pleaseRead")}
                    </span>
                  )}
                  {readerId && (it.read_status === "none" || it.read_status === "viewed") && (
                    <span className="rounded-full bg-[#E32D24] px-1.5 py-0.5 text-[11px] text-white">
                      {t("unread")}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {it.code} · {it.title}
                  {it.version ? ` · ${it.version}` : ""}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <Sheet open={!!openCode} onOpenChange={(o) => !o && setOpenCode(null)}>
        <SheetContent
          side="bottom"
          className="h-[92dvh] overflow-y-auto rounded-t-3xl bg-muted/30 px-3 pb-8"
        >
          <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-10 text-left">
            <div className="min-w-0">
              <SheetTitle>{t("appTitle")}</SheetTitle>
              <SheetDescription className="text-xs">{t("closeToScan")}</SheetDescription>
            </div>
            <WiLangSwitch />
          </SheetHeader>
          <div className="mt-3">
            {openCode && (
              <WiLiveManual
                code={openCode}
                employeeId={readerId}
                lang={lang}
                onNeedEmployee={() => setPickerOpen(true)}
                onReadChange={(state) =>
                  setItems((prev) =>
                    prev.map((it) =>
                      it.code === openCode ? { ...it, read_status: state.status } : it,
                    ),
                  )
                }
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <WiEmployeePicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={setReader} />
    </>
  );
}
