// Work Instruction editor: basic info + sortable step outline (left),
// selected step editor (main). Saves the whole draft in one request.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  FileText,
  ImageOff,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  Save,
  Send,
  Trash2,
  ImageIcon,
  ClipboardCheck,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import {
  wiCreateUploadUrl,
  wiSaveDraft,
  wiSubmit,
  wiWithdraw,
  type wiGet,
} from "@/lib/features/wi.functions";
import {
  WI_LANGS,
  emptyStep,
  newId,
  translationProgress,
  wiDocInputSchema,
  type WiDocInput,
  type WiLang,
  type WiRelatedDoc,
  type WiStepContent,
  type WiSnapshot,
  type WiTranslations,
} from "@/lib/wi/wi-schema";
import { WI_LANG_LABEL } from "@/lib/wi/wi-i18n";
import { WiTranslateDialog } from "@/components/wi/WiTranslateDialog";
import { WI_ACCENT_BTN, requireWiActor, uploadWiFile, wiFileExt } from "@/lib/wi/wi-client";
import { WiStepEditor, type StepUpload } from "@/components/wi/WiStepEditor";
import { WiViewer } from "@/components/wi/WiViewer";
import { WiStatusBadge } from "@/components/wi/WiStatusBadge";

type Detail = Awaited<ReturnType<typeof wiGet>>;

type Meta = {
  title: string;
  description: string;
  category_id: string | null;
  owner_name: string;
  tags: string;
  est_minutes: string;
  equipment: string;
  safety_notes: string;
  related_docs: WiRelatedDoc[];
};

const NO_CATEGORY = "__none";
/** Outline key for the "basic info" panel (step ids are UUIDs, so this never collides). */
const INFO = "__info";

/** Drop translations of deleted steps/checkpoints so the saved draft stays tidy. */
function pruneTranslations(tr: WiTranslations, steps: WiStepContent[]): WiTranslations {
  const out: WiTranslations = {};
  for (const lang of ["en", "my"] as const) {
    const t = tr[lang];
    if (!t) continue;
    const kept: NonNullable<WiTranslations["en"]>["steps"] = {};
    for (const step of steps) {
      const st = t.steps[step.id];
      if (!st) continue;
      const ids = new Set(step.checkpoints.map((c) => c.id));
      kept[step.id] = {
        ...st,
        checkpoints: Object.fromEntries(
          Object.entries(st.checkpoints).filter(([id]) => ids.has(id)),
        ),
      };
    }
    out[lang] = { ...t, steps: kept };
  }
  return out;
}

function metaFromDoc(doc: Detail["doc"]): Meta {
  return {
    title: doc.title,
    description: doc.description ?? "",
    category_id: doc.category_id,
    owner_name: doc.owner_name ?? "",
    tags: (doc.tags ?? []).join(", "),
    est_minutes: doc.est_minutes != null ? String(doc.est_minutes) : "",
    equipment: doc.equipment ?? "",
    safety_notes: doc.safety_notes ?? "",
    related_docs: doc.related_docs ?? [],
  };
}

function SortableStepItem({
  step,
  index,
  active,
  disabled,
  hasError,
  onSelect,
}: {
  step: WiStepContent;
  index: number;
  active: boolean;
  disabled: boolean;
  hasError: boolean;
  onSelect: () => void;
}) {
  const missing = [
    !step.instructions.trim() && "ยังไม่มีวิธีทำ",
    step.media.length === 0 && "ยังไม่มีรูป",
  ].filter(Boolean) as string[];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-stretch rounded-lg border bg-background",
        active ? "border-[#E32D24] ring-1 ring-[#E32D24]/30" : "border-border",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="flex w-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-40"
        aria-label={`ลากเพื่อเรียงขั้นตอนที่ ${index + 1}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left"
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            active ? "bg-[#E32D24] text-white" : "bg-muted text-foreground",
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", !step.title && "text-muted-foreground")}>
            {step.title || "(ยังไม่มีชื่อ)"}
          </span>
          {missing.length > 0 && (
            <span className="block truncate text-[11px] text-amber-700 dark:text-amber-400">
              {missing.join(" · ")}
            </span>
          )}
        </span>
        {hasError && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
        {step.media.length > 0 ? (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <ImageIcon className="h-3 w-3" />
            {step.media.length}
          </span>
        ) : (
          <ImageOff className="h-3.5 w-3.5 text-amber-600" aria-hidden />
        )}
        {step.checkpoints.length > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <ClipboardCheck className="h-3 w-3" />
            {step.checkpoints.length}
          </span>
        )}
      </button>
    </li>
  );
}

export function WiEditor({ detail, onReload }: { detail: Detail; onReload: () => Promise<void> }) {
  const navigate = useNavigate();
  const doc = detail.doc;
  const readOnly = doc.status === "pending_review" || doc.status === "archived";
  const [hasSavedChanges, setHasSavedChanges] = useState(doc.has_unpublished_changes);

  const [meta, setMeta] = useState<Meta>(() => metaFromDoc(doc));
  const [steps, setSteps] = useState<WiStepContent[]>(() => doc.steps);
  const [translations, setTranslations] = useState<WiTranslations>(() => doc.translations);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<WiLang>("th");
  const [selectedId, setSelectedId] = useState<string>(() => doc.steps[0]?.id ?? INFO);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(doc.updated_at);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>(detail.mediaUrls);
  const [uploads, setUploads] = useState<Record<string, StepUpload[]>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const saveFn = useServerFn(wiSaveDraft);
  const submitFn = useServerFn(wiSubmit);
  const withdrawFn = useServerFn(wiWithdraw);
  const uploadUrlFn = useServerFn(wiCreateUploadUrl);

  // Re-sync when the server copy changes (after save/submit/reload).
  useEffect(() => {
    setMeta(metaFromDoc(doc));
    setSteps(doc.steps);
    setTranslations(doc.translations);
    setBaseUpdatedAt(doc.updated_at);
    setHasSavedChanges(doc.has_unpublished_changes);
    setMediaUrls((prev) => ({ ...prev, ...detail.mediaUrls }));
    setDirty(false);
    setSelectedId((cur) =>
      cur === INFO || doc.steps.some((s) => s.id === cur) ? cur : (doc.steps[0]?.id ?? INFO),
    );
  }, [doc, detail.mediaUrls]);

  const uploading = Object.values(uploads).some((list) => list.some((u) => !u.error));
  // Ref so a navigate() right after a successful save isn't blocked by a stale render.
  const unsavedRef = useRef(false);
  unsavedRef.current = dirty || uploading;

  useBlocker({
    shouldBlockFn: () => {
      if (!unsavedRef.current) return false;
      return !window.confirm("มีการแก้ไขที่ยังไม่ได้บันทึก — ออกจากหน้านี้หรือไม่?");
    },
    enableBeforeUnload: () => unsavedRef.current,
  });

  const patchMeta = (patch: Partial<Meta>) => {
    setMeta((m) => ({ ...m, ...patch }));
    setDirty(true);
  };
  const patchStep = useCallback((id: string, patch: Partial<WiStepContent>) => {
    setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
  }, []);

  const selectedIndex = steps.findIndex((s) => s.id === selectedId);
  const selected = selectedIndex >= 0 ? steps[selectedIndex] : null;

  const addStep = () => {
    const s = emptyStep();
    setSteps((list) => {
      const at = selectedIndex >= 0 ? selectedIndex + 1 : list.length;
      return [...list.slice(0, at), s, ...list.slice(at)];
    });
    setSelectedId(s.id);
    setDirty(true);
  };

  const duplicateStep = (s: WiStepContent) => {
    const copy: WiStepContent = {
      ...s,
      id: newId(),
      title: s.title ? `${s.title} (สำเนา)`.slice(0, 200) : "",
      media: s.media.map((m) => ({ ...m, id: newId() })),
      checkpoints: s.checkpoints.map((c) => ({ ...c, id: newId() })),
    };
    setSteps((list) => {
      const at = list.findIndex((x) => x.id === s.id) + 1;
      return [...list.slice(0, at), copy, ...list.slice(at)];
    });
    setSelectedId(copy.id);
    setDirty(true);
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps((list) => {
      const i = list.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      return arrayMove(list, i, j);
    });
    setDirty(true);
  };

  const deleteStep = (id: string) => {
    setSteps((list) => {
      const i = list.findIndex((s) => s.id === id);
      const next = list.filter((s) => s.id !== id);
      setSelectedId(next[Math.min(i, next.length - 1)]?.id ?? INFO);
      return next;
    });
    setDirty(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSteps((list) => {
      const from = list.findIndex((s) => s.id === active.id);
      const to = list.findIndex((s) => s.id === over.id);
      return from < 0 || to < 0 ? list : arrayMove(list, from, to);
    });
    setDirty(true);
  };

  const uploadFiles = async (stepId: string, files: File[]) => {
    let token: string;
    try {
      token = requireToken();
    } catch {
      return;
    }
    const step = steps.find((s) => s.id === stepId);
    const room = 12 - (step?.media.length ?? 0) - (uploads[stepId]?.length ?? 0);
    if (files.length > room) toast.warning(`เพิ่มได้อีก ${Math.max(0, room)} ไฟล์ในขั้นตอนนี้`);
    for (const file of files.slice(0, Math.max(0, room))) {
      const uid = newId();
      const setU = (patch: Partial<StepUpload> | null) =>
        setUploads((all) => {
          const list = all[stepId] ?? [];
          return {
            ...all,
            [stepId]:
              patch === null
                ? list.filter((u) => u.id !== uid)
                : list.map((u) => (u.id === uid ? { ...u, ...patch } : u)),
          };
        });
      setUploads((all) => ({
        ...all,
        [stepId]: [...(all[stepId] ?? []), { id: uid, name: file.name, pct: 0 }],
      }));
      const ext = wiFileExt(file);
      const isImage = ext ? ["jpg", "jpeg", "png", "webp"].includes(ext) : false;
      if (!ext) {
        setU({ error: "ชนิดไฟล์ไม่รองรับ" });
        continue;
      }
      if (isImage && file.size > 10 * 1024 * 1024) {
        setU({ error: "รูปใหญ่เกิน 10MB" });
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        setU({ error: "วิดีโอใหญ่เกิน 100MB" });
        continue;
      }
      try {
        const res = await uploadWiFile({
          file,
          wiId: doc.id,
          token,
          createUrl: uploadUrlFn,
          onProgress: (pct) => setU({ pct }),
        });
        setMediaUrls((m) => ({ ...m, [res.path]: URL.createObjectURL(file) }));
        setSteps((list) =>
          list.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  media: [
                    ...s.media,
                    { id: newId(), type: res.kind, path: res.path, url: null, caption: "" },
                  ],
                }
              : s,
          ),
        );
        setDirty(true);
        setU(null);
      } catch (err) {
        setU({ error: err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ" });
      }
    }
  };

  const buildInput = (): WiDocInput | null => {
    const est = meta.est_minutes.trim();
    const estNum = est === "" ? null : Number(est);
    const input = {
      title: meta.title,
      description: meta.description,
      category_id: meta.category_id,
      owner_name: meta.owner_name,
      tags: meta.tags
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean),
      est_minutes: estNum,
      equipment: meta.equipment,
      safety_notes: meta.safety_notes,
      related_docs: meta.related_docs,
      steps,
      translations: pruneTranslations(translations, steps),
    };
    const next: Record<string, string> = {};
    if (estNum != null && (!Number.isInteger(estNum) || estNum < 0)) {
      next.est_minutes = "ใส่เป็นจำนวนนาทีเต็ม";
    }
    const parsed = wiDocInputSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [head, i] = issue.path;
        if (head === "steps" && typeof i === "number") {
          next[`step:${steps[i]?.id}`] ??= `ขั้นตอนที่ ${i + 1}: ${issue.message}`;
        } else if (head === "related_docs" && typeof i === "number") {
          next[`doc:${i}`] ??= issue.message;
        } else {
          next[String(head)] ??= issue.message;
        }
      }
    }
    setErrors(next);
    const keys = Object.keys(next);
    if (keys.length) {
      const stepKey = keys.find((k) => k.startsWith("step:"));
      setSelectedId(stepKey ? stepKey.slice(5) : INFO);
      toast.error(next[keys[0]]);
      return null;
    }
    return parsed.success ? parsed.data : null;
  };

  const save = async (): Promise<boolean> => {
    if (uploading) {
      toast.error("รออัปโหลดไฟล์ให้เสร็จก่อนบันทึก");
      return false;
    }
    const input = buildInput();
    if (!input) return false;
    setSaving(true);
    try {
      const actor = requireWiActor();
      const res = await saveFn({
        data: {
          token: requireToken(),
          actor,
          id: doc.id,
          base_updated_at: baseUpdatedAt,
          doc: input,
        },
      });
      setBaseUpdatedAt(res.updated_at);
      setDirty(false);
      setHasSavedChanges(true);
      toast.success("บันทึกร่างแล้ว");
      return true;
    } catch (err) {
      showError(err, "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (dirty && !(await save())) return;
      const actor = requireWiActor();
      await submitFn({
        data: { token: requireToken(), actor, id: doc.id, change_summary: changeSummary },
      });
      toast.success("ส่งตรวจแล้ว — รอผู้อนุมัติ");
      setSubmitOpen(false);
      setDirty(false);
      unsavedRef.current = false;
      navigate({ to: "/wi/$wiId", params: { wiId: doc.id } });
    } catch (err) {
      showError(err, "ส่งตรวจไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async () => {
    try {
      await withdrawFn({ data: { token: requireToken(), actor: requireWiActor(), id: doc.id } });
      toast.success("ถอนคำขอแล้ว — แก้ไขต่อได้");
      await onReload();
    } catch (err) {
      showError(err, "ถอนคำขอไม่สำเร็จ");
    }
  };

  const previewSnapshot = useMemo<WiSnapshot>(
    () => ({
      wi_code: doc.wi_code,
      title: meta.title || "(ยังไม่มีชื่อ)",
      description: meta.description || null,
      category_id: meta.category_id,
      category_name: detail.categories.find((c) => c.id === meta.category_id)?.name ?? null,
      owner_name: meta.owner_name || null,
      tags: [],
      est_minutes: meta.est_minutes.trim() ? Number(meta.est_minutes) || null : null,
      equipment: meta.equipment || null,
      safety_notes: meta.safety_notes || null,
      related_docs: meta.related_docs.filter((d) => d.label.trim() && d.url.trim()),
      steps,
      translations,
    }),
    [doc.wi_code, meta, steps, translations, detail.categories],
  );
  const enProgress = translationProgress(previewSnapshot, translations.en);
  const myProgress = translationProgress(previewSnapshot, translations.my);
  const translateTotal = enProgress.total + myProgress.total;
  const translatePct = translateTotal
    ? Math.round(((enProgress.done + myProgress.done) / translateTotal) * 100)
    : 0;
  const infoHasError = Object.keys(errors).some((k) => !k.startsWith("step:"));

  const canSubmit =
    doc.status === "draft" || (doc.status === "published" && (dirty || hasSavedChanges));
  const categories = detail.categories.filter((c) => c.is_active || c.id === meta.category_id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 pb-16">
      {/* Sticky action bar */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-10 gap-1 px-2">
            <Link to="/wi/$wiId" params={{ wiId: doc.id }}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">กลับ</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{doc.wi_code}</span>
              <WiStatusBadge status={doc.status} />
              {dirty && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> ยังไม่ได้บันทึก
                </span>
              )}
              {!dirty && doc.current_version_id && doc.has_unpublished_changes && (
                <span className="text-xs text-muted-foreground">ร่างนี้ต่างจากฉบับที่เผยแพร่</span>
              )}
            </div>
            <div className="truncate text-sm font-semibold">{meta.title || "(ยังไม่มีชื่อ)"}</div>
          </div>
          <Button variant="outline" className="h-10 gap-1" onClick={() => setTranslateOpen(true)}>
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">แปลภาษา</span>
            <span
              title={`EN ${enProgress.done}/${enProgress.total} · MY ${myProgress.done}/${myProgress.total}`}
              className={cn(
                "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                translatePct === 100
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
              )}
            >
              {translatePct}%
            </span>
          </Button>
          <Button variant="outline" className="h-10 gap-1" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> <span className="hidden sm:inline">ดูตัวอย่าง</span>
          </Button>
          {!readOnly && (
            <Button
              variant="outline"
              className="h-10 gap-1"
              onClick={save}
              disabled={saving || (!dirty && !uploading)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึกร่าง
            </Button>
          )}
          {!readOnly && canSubmit && (
            <Button className={cn("h-10 gap-1", WI_ACCENT_BTN)} onClick={() => setSubmitOpen(true)}>
              <Send className="h-4 w-4" /> ส่งตรวจ
            </Button>
          )}
          {doc.status === "pending_review" && (
            <Button variant="outline" className="h-10" onClick={withdraw}>
              ถอนคำขอเพื่อแก้ไข
            </Button>
          )}
        </div>
        {readOnly && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            {doc.status === "pending_review"
              ? "อยู่ระหว่างรอตรวจ — แก้ไขไม่ได้จนกว่าจะถอนคำขอหรือผู้ตรวจส่งกลับ"
              : "WI ถูกเก็บถาวร — กู้คืนจากหน้ารายละเอียดก่อนแก้ไข"}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Left: basic info + outline */}
        <aside className="space-y-4 lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-1">
          <button
            type="button"
            onClick={() => setSelectedId(INFO)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left",
              selectedId === INFO
                ? "border-[#E32D24] ring-1 ring-[#E32D24]/30"
                : "border-border hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                selectedId === INFO ? "bg-[#E32D24] text-white" : "bg-muted text-muted-foreground",
              )}
            >
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">ข้อมูลทั่วไป</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[
                  detail.categories.find((c) => c.id === meta.category_id)?.name ??
                    "ยังไม่เลือกหมวด",
                  meta.est_minutes.trim() && `${meta.est_minutes.trim()} นาที`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {infoHasError && (
              <AlertCircle
                className="h-4 w-4 shrink-0 text-destructive"
                aria-label="มีช่องที่ต้องแก้"
              />
            )}
          </button>

          <div className="space-y-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">ขั้นตอน ({steps.length})</h2>
              <span className="text-xs text-muted-foreground">ลาก ⋮⋮ เพื่อเรียง</span>
            </div>
            {steps.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                ยังไม่มีขั้นตอน — กด “เพิ่มขั้นตอน” เพื่อเริ่ม
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={steps.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol className="space-y-1.5">
                    {steps.map((s, i) => (
                      <SortableStepItem
                        key={s.id}
                        step={s}
                        index={i}
                        active={s.id === selectedId}
                        disabled={readOnly}
                        hasError={!!errors[`step:${s.id}`]}
                        onSelect={() => setSelectedId(s.id)}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
            {!readOnly && (
              <Button
                type="button"
                className={cn("h-11 w-full gap-1", WI_ACCENT_BTN)}
                onClick={addStep}
                disabled={steps.length >= 100}
              >
                <Plus className="h-4 w-4" /> เพิ่มขั้นตอน
              </Button>
            )}
          </div>
        </aside>

        {/* Main: basic info or the selected step */}
        <section className="min-w-0">
          {selectedId === INFO ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-semibold">ข้อมูลทั่วไป</h2>
                <p className="text-sm text-muted-foreground">
                  ชื่อ หมวด เวลา อุปกรณ์ และข้อควรระวังที่ใช้กับทั้ง WI
                </p>
              </div>
              <fieldset disabled={readOnly} className="max-w-2xl space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wi-title">
                    ชื่อ WI <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="wi-title"
                    value={meta.title}
                    onChange={(e) => patchMeta({ title: e.target.value })}
                    maxLength={200}
                    aria-invalid={!!errors.title}
                    className="h-10"
                  />
                  {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-desc">คำอธิบายสั้น</Label>
                  <Textarea
                    id="wi-desc"
                    value={meta.description}
                    onChange={(e) => patchMeta({ description: e.target.value })}
                    rows={2}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>หมวดหมู่</Label>
                  <Select
                    value={meta.category_id ?? NO_CATEGORY}
                    onValueChange={(v) => patchMeta({ category_id: v === NO_CATEGORY ? null : v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>— ไม่ระบุ —</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {!c.is_active ? " (เก็บถาวร)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="wi-owner">ผู้รับผิดชอบ</Label>
                    <Input
                      id="wi-owner"
                      value={meta.owner_name}
                      onChange={(e) => patchMeta({ owner_name: e.target.value })}
                      maxLength={120}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wi-est">เวลาโดยประมาณ (นาที)</Label>
                    <Input
                      id="wi-est"
                      inputMode="numeric"
                      value={meta.est_minutes}
                      onChange={(e) => patchMeta({ est_minutes: e.target.value })}
                      aria-invalid={!!errors.est_minutes}
                      className="h-10"
                    />
                    {errors.est_minutes && (
                      <p className="text-xs text-destructive">{errors.est_minutes}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-tags">แท็ก / คำค้น (คั่นด้วย ,)</Label>
                  <Input
                    id="wi-tags"
                    value={meta.tags}
                    onChange={(e) => patchMeta({ tags: e.target.value })}
                    placeholder="ม่านม้วน, ตัดราง"
                    className="h-10"
                  />
                  {errors.tags && <p className="text-xs text-destructive">{errors.tags}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-equip">อุปกรณ์ / วัสดุที่ต้องใช้</Label>
                  <Textarea
                    id="wi-equip"
                    value={meta.equipment}
                    onChange={(e) => patchMeta({ equipment: e.target.value })}
                    rows={2}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-safety">ข้อควรระวังด้านความปลอดภัย</Label>
                  <Textarea
                    id="wi-safety"
                    value={meta.safety_notes}
                    onChange={(e) => patchMeta({ safety_notes: e.target.value })}
                    rows={2}
                    maxLength={4000}
                  />
                </div>
                <div className="space-y-2">
                  <Label>เอกสารที่เกี่ยวข้อง</Label>
                  {meta.related_docs.map((d, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex gap-1">
                        <Input
                          value={d.label}
                          onChange={(e) =>
                            patchMeta({
                              related_docs: meta.related_docs.map((x, j) =>
                                j === i ? { ...x, label: e.target.value } : x,
                              ),
                            })
                          }
                          placeholder="ชื่อเอกสาร"
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() =>
                            patchMeta({
                              related_docs: meta.related_docs.filter((_, j) => j !== i),
                            })
                          }
                          aria-label="ลบเอกสาร"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        value={d.url}
                        onChange={(e) =>
                          patchMeta({
                            related_docs: meta.related_docs.map((x, j) =>
                              j === i ? { ...x, url: e.target.value } : x,
                            ),
                          })
                        }
                        placeholder="https://…"
                        aria-invalid={!!errors[`doc:${i}`]}
                        className="h-10"
                      />
                      {errors[`doc:${i}`] && (
                        <p className="text-xs text-destructive">{errors[`doc:${i}`]}</p>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 gap-1"
                    onClick={() =>
                      patchMeta({ related_docs: [...meta.related_docs, { label: "", url: "" }] })
                    }
                    disabled={meta.related_docs.length >= 20}
                  >
                    <Plus className="h-4 w-4" /> เพิ่มเอกสาร
                  </Button>
                </div>
              </fieldset>
              {!readOnly && steps.length === 0 && (
                <Button className={cn("h-11 gap-1", WI_ACCENT_BTN)} onClick={addStep}>
                  <Plus className="h-4 w-4" /> ต่อไป: เพิ่มขั้นตอนแรก
                </Button>
              )}
            </div>
          ) : selected ? (
            <>
              {errors[`step:${selected.id}`] && (
                <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {errors[`step:${selected.id}`]}
                </div>
              )}
              <WiStepEditor
                key={selected.id}
                step={selected}
                index={selectedIndex}
                total={steps.length}
                readOnly={readOnly}
                mediaUrls={mediaUrls}
                uploads={uploads[selected.id] ?? []}
                onChange={(patch) => patchStep(selected.id, patch)}
                onUploadFiles={(files) => uploadFiles(selected.id, files)}
                onDismissUpload={(uid) =>
                  setUploads((all) => ({
                    ...all,
                    [selected.id]: (all[selected.id] ?? []).filter((u) => u.id !== uid),
                  }))
                }
                onDuplicate={() => duplicateStep(selected)}
                onMove={(dir) => moveStep(selected.id, dir)}
                onDelete={() => deleteStep(selected.id)}
              />
            </>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {readOnly ? "WI นี้ยังไม่มีขั้นตอน" : "เริ่มจากเพิ่มขั้นตอนแรกของงานนี้"}
              </p>
              {!readOnly && (
                <Button className={cn("h-11 gap-1", WI_ACCENT_BTN)} onClick={addStep}>
                  <Plus className="h-4 w-4" /> เพิ่มขั้นตอน
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ตัวอย่างมุมมองพนักงาน</DialogTitle>
            <DialogDescription>แสดงตามร่างปัจจุบัน (รวมส่วนที่ยังไม่ได้บันทึก)</DialogDescription>
          </DialogHeader>
          <div className="inline-flex self-start rounded-xl bg-muted p-1">
            {WI_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setPreviewLang(l)}
                className={cn(
                  "min-h-9 min-w-12 rounded-lg px-2.5 text-sm font-semibold",
                  previewLang === l ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                {WI_LANG_LABEL[l]}
              </button>
            ))}
          </div>
          <WiViewer snapshot={previewSnapshot} mediaUrls={mediaUrls} isPreview lang={previewLang} />
        </DialogContent>
      </Dialog>

      <WiTranslateDialog
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        source={{
          title: meta.title,
          description: meta.description,
          equipment: meta.equipment,
          safety_notes: meta.safety_notes,
          steps,
        }}
        translations={translations}
        onChange={(next) => {
          setTranslations(next);
          setDirty(true);
        }}
        readOnly={readOnly}
      />

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ส่ง {doc.wi_code} ให้ผู้อนุมัติตรวจ</DialogTitle>
            <DialogDescription>
              {dirty ? "ระบบจะบันทึกร่างก่อนส่ง · " : ""}
              ระหว่างรอตรวจจะแก้ไขไม่ได้ ฉบับที่เผยแพร่อยู่ (ถ้ามี) ยังใช้งานได้ตามปกติ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wi-change">สรุปการเปลี่ยนแปลง</Label>
            <Textarea
              id="wi-change"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder={doc.current_version_id ? "เช่น เพิ่มจุดตรวจความยาวราง" : "ฉบับแรก"}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setSubmitOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              className={cn("h-10 gap-1", WI_ACCENT_BTN)}
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              ส่งตรวจ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
