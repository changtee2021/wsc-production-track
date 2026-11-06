import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Send, Wrench, X, XCircle } from "lucide-react";
import { MediaAttachButtons } from "@/components/MediaAttachButtons";
import { Button } from "@/components/ui/button";
import { listTrialChecklist } from "@/lib/scan-trial.functions";
import type { TrialFlowId } from "@/lib/scan-trial";
import { getReportSubmitBlockReason } from "@/lib/utils/report-media-validation";

type Kind = "qc" | "packing";
type Item = { id: string; item_text: string; item_order: number };
type ItemState = { is_passed: boolean | null; tag: "motor" | null; remark: string };
type LocalMedia = { url: string; type: "image" | "video" };

const EMPTY: ItemState = { is_passed: null, tag: null, remark: "" };

export function TrialEndPanel({
  flowId,
  kind,
  done,
  onDone,
  fixedItems,
}: {
  flowId: TrialFlowId;
  kind: Kind;
  done: boolean;
  onDone: (message: string) => void;
  /** A built-in list, such as the wood-issue QC. Skips the category checklist. */
  fixedItems?: readonly Item[];
}) {
  const listChecklist = useServerFn(listTrialChecklist);
  const [items, setItems] = useState<Item[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [note, setNote] = useState("");
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const mediaRef = useRef<LocalMedia[]>([]);
  mediaRef.current = media;

  useEffect(() => {
    return () => {
      for (const item of mediaRef.current) URL.revokeObjectURL(item.url);
    };
  }, []);

  useEffect(() => {
    if (fixedItems) {
      setItems(fixedItems.map((item) => ({ ...item })));
      setItemStates({});
      setLoadState("ready");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    listChecklist({ data: { flow: flowId, kind } })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setItemStates({});
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [flowId, kind, listChecklist, fixedItems]);

  const answered = items.filter((item) => itemStates[item.id]?.is_passed != null).length;
  const passCount = items.filter((item) => itemStates[item.id]?.is_passed === true).length;
  const motorCount = items.filter((item) => itemStates[item.id]?.tag === "motor").length;
  const failCount = items.filter((item) => itemStates[item.id]?.is_passed === false).length;
  const blockReason =
    items.length > 0 ? getReportSubmitBlockReason(items, itemStates, media.length) : null;

  function patch(id: string, next: ItemState) {
    setItemStates((current) => ({ ...current, [id]: next }));
  }

  function addFiles(files: FileList, type: "image" | "video") {
    const added = Array.from(files).map((file) => ({ url: URL.createObjectURL(file), type }));
    setMedia((current) => [...current, ...added]);
  }

  function submit() {
    if (blockReason || items.length === 0) return;
    const message =
      failCount > 0
        ? `ส่งรายงานสำเร็จ — ไม่ผ่าน ${failCount} ข้อ`
        : `ส่งรายงานสำเร็จ — ผ่าน ${passCount}/${items.length}`;
    onDone(message);
  }

  if (done) {
    return (
      <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-center text-sm font-semibold text-emerald-800">
        ส่งรายงานขั้นนี้แล้ว
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        รายการตรวจสอบ
        {items.length > 0 && (
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            ตรวจแล้ว {answered}/{items.length}
          </span>
        )}
      </h2>
      {loadState === "loading" && (
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด checklist...
        </div>
      )}
      {loadState === "error" && (
        <p className="text-center text-sm font-medium text-destructive">โหลดรายการตรวจไม่สำเร็จ</p>
      )}
      {loadState === "ready" && items.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
          {kind === "qc"
            ? 'ไม่มีรายการตรวจสอบสำหรับหมวดนี้ — แจ้งแอดมินเพิ่มใน "จัดการ → Checklist QC"'
            : 'ไม่มีรายการตรวจสอบสำหรับหมวดนี้ — แจ้งแอดมินเพิ่มใน "จัดการ → Checklist แพ็คของ"'}
        </div>
      )}
      <div className="space-y-3">
        {items.map((item, index) => {
          const state = itemStates[item.id] ?? EMPTY;
          const failed = state.is_passed === false;
          const isMotor = state.is_passed === true && state.tag === "motor";
          const passed = state.is_passed === true && !isMotor;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border-2 bg-card p-3 ${
                passed
                  ? "border-emerald-400 bg-emerald-50"
                  : isMotor
                    ? "border-amber-400 bg-amber-50"
                    : failed
                      ? "border-red-400 bg-red-50"
                      : "border-border"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {index + 1}
                </span>
                <p className="flex-1 text-sm font-medium leading-snug">{item.item_text}</p>
                {isMotor && (
                  <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    มอเตอร์
                  </span>
                )}
              </div>
              <div className={`mt-3 grid gap-2 ${kind === "qc" ? "grid-cols-3" : "grid-cols-2"}`}>
                <Button
                  type="button"
                  onClick={() => patch(item.id, { is_passed: true, tag: null, remark: "" })}
                  className={`h-11 gap-1 px-2 text-sm font-semibold ${
                    passed
                      ? "bg-emerald-600 text-white hover:bg-emerald-600"
                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" /> ผ่าน
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    patch(item.id, { is_passed: false, tag: null, remark: state.remark })
                  }
                  className={`h-11 gap-1 px-2 text-sm font-semibold ${
                    failed
                      ? "bg-red-600 text-white hover:bg-red-600"
                      : "bg-red-100 text-red-800 hover:bg-red-200"
                  }`}
                >
                  <XCircle className="h-4 w-4" /> ไม่ผ่าน
                </Button>
                {kind === "qc" && (
                  <Button
                    type="button"
                    onClick={() => patch(item.id, { is_passed: true, tag: "motor", remark: "" })}
                    className={`h-11 gap-1 px-2 text-sm font-semibold ${
                      isMotor
                        ? "bg-amber-500 text-white hover:bg-amber-500"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                    }`}
                  >
                    <Wrench className="h-4 w-4" /> มอเตอร์
                  </Button>
                )}
              </div>
              {failed && (
                <textarea
                  value={state.remark}
                  onChange={(event) => patch(item.id, { ...state, remark: event.target.value })}
                  placeholder="หมายเหตุ: ไม่ผ่านเพราะ... (จำเป็น)"
                  rows={2}
                  maxLength={2000}
                  className="mt-3 w-full rounded-lg border border-red-300 bg-background p-2 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>
      {items.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">หมายเหตุภาพรวม / หลักฐานรวม</h2>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="หมายเหตุภาพรวม (ถ้ามี)..."
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border bg-background p-2 text-sm"
          />
          <MediaAttachButtons onFiles={addFiles} />
          {media.length === 0 ? (
            <p className="text-xs font-medium text-destructive">
              * ต้องแนบรูปหรือวิดีโอในหลักฐานรวมอย่างน้อย 1 รายการ
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {media.map((item, index) => (
                <div
                  key={item.url}
                  className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  {item.type === "image" ? (
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  )}
                  <button
                    type="button"
                    aria-label="ลบไฟล์หลักฐาน"
                    onClick={() => {
                      URL.revokeObjectURL(item.url);
                      setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    }}
                    className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {items.length > 0 && (
        <section>
          <div className="mb-2 rounded-xl border bg-card px-3 py-2 text-sm">
            <span className="font-semibold">สรุป:</span>{" "}
            <span className="text-emerald-700">ผ่าน {passCount}</span>
            {kind === "qc" && motorCount > 0 && (
              <span className="text-amber-700"> (มอเตอร์ {motorCount})</span>
            )}{" "}
            / <span className="text-red-700">ไม่ผ่าน {failCount}</span> /{" "}
            <span className="text-muted-foreground">ทั้งหมด {items.length}</span>
          </div>
          <Button
            type="button"
            onClick={submit}
            disabled={!!blockReason}
            className="h-14 w-full gap-2 text-base font-semibold"
          >
            <Send className="h-5 w-5" />
            {kind === "qc" ? "ส่งรายงาน QC" : "ส่งรายงานแพ็คของ"}
          </Button>
          {blockReason && (
            <p className="mt-2 text-center text-sm font-medium text-destructive">{blockReason}</p>
          )}
        </section>
      )}
    </div>
  );
}
