// Editor panel for one WI step: instructions, media (upload/link), warnings,
// expected result and quality checkpoints.
import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Copy,
  ImagePlus,
  Info,
  Link2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  WI_CHECKPOINT_LABEL,
  WI_CHECKPOINT_TYPES,
  emptyCheckpoint,
  newId,
  type WiCheckpoint,
  type WiCheckpointType,
  type WiMedia,
  type WiStepContent,
} from "@/lib/wi/wi-schema";

export type StepUpload = { id: string; name: string; pct: number; error?: string };

type Props = {
  step: WiStepContent;
  index: number;
  total: number;
  readOnly: boolean;
  mediaUrls: Record<string, string>;
  uploads: StepUpload[];
  onChange: (patch: Partial<WiStepContent>) => void;
  onUploadFiles: (files: File[]) => void;
  onDismissUpload: (uploadId: string) => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
};

function Section({
  title,
  children,
  collapsible,
  defaultOpen = true,
  hint,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) {
    return (
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {children}
      </section>
    );
  }
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-m-1 flex min-h-10 w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg p-1 text-left hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {!open && hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && children}
    </section>
  );
}

function CheckpointRow({
  c,
  readOnly,
  onChange,
  onRemove,
}: {
  c: WiCheckpoint;
  readOnly: boolean;
  onChange: (patch: Partial<WiCheckpoint>) => void;
  onRemove: () => void;
}) {
  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
        <Select
          value={c.type}
          onValueChange={(v) => onChange({ type: v as WiCheckpointType })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-10" aria-label="ประเภทจุดตรวจ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WI_CHECKPOINT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {WI_CHECKPOINT_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={c.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="ชื่อจุดตรวจ เช่น ความยาวราง"
          aria-label="ชื่อจุดตรวจ"
          aria-invalid={!c.label.trim()}
          maxLength={200}
          disabled={readOnly}
          className="h-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={readOnly}
          aria-label="ลบจุดตรวจ"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {c.type === "numeric" && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">ค่าต่ำสุด</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={c.min ?? ""}
              onChange={(e) => onChange({ min: num(e.target.value) })}
              disabled={readOnly}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ค่าสูงสุด</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={c.max ?? ""}
              onChange={(e) => onChange({ max: num(e.target.value) })}
              disabled={readOnly}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">หน่วย</Label>
            <Input
              value={c.unit}
              onChange={(e) => onChange({ unit: e.target.value })}
              placeholder="ซม."
              maxLength={20}
              disabled={readOnly}
              className="h-10"
            />
          </div>
          {c.min != null && c.max != null && c.min > c.max && (
            <p className="col-span-3 text-xs text-destructive">ค่าต่ำสุดต้องไม่มากกว่าค่าสูงสุด</p>
          )}
        </div>
      )}
      <Textarea
        value={c.criteria}
        onChange={(e) => onChange({ criteria: e.target.value })}
        placeholder="เกณฑ์การยอมรับ (ไม่บังคับ) เช่น ไม่มีรอยขีดข่วน มุมตรง 90°"
        rows={2}
        maxLength={500}
        disabled={readOnly}
      />
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <Switch
          checked={c.required}
          onCheckedChange={(v) => onChange({ required: v })}
          disabled={readOnly}
        />
        จำเป็นต้องตรวจ
      </label>
    </div>
  );
}

export function WiStepEditor({
  step,
  index,
  total,
  readOnly,
  mediaUrls,
  uploads,
  onChange,
  onUploadFiles,
  onDismissUpload,
  onDuplicate,
  onMove,
  onDelete,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCaption, setLinkCaption] = useState("");
  const [linkError, setLinkError] = useState("");

  const updateMedia = (id: string, patch: Partial<WiMedia>) =>
    onChange({ media: step.media.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const moveMedia = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= step.media.length) return;
    const next = [...step.media];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ media: next });
  };
  const updateCheckpoint = (id: string, patch: Partial<WiCheckpoint>) =>
    onChange({
      checkpoints: step.checkpoints.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setLinkError("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");
      return;
    }
    onChange({
      media: [
        ...step.media,
        { id: newId(), type: "link", path: null, url, caption: linkCaption.trim() },
      ],
    });
    setLinkUrl("");
    setLinkCaption("");
    setLinkError("");
  };

  const mediaFull = step.media.length >= 12;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
            {index + 1}
          </span>
          <span className="text-sm text-muted-foreground">
            ขั้นตอนที่ {index + 1} จาก {total}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1"
            onClick={() => onMove(-1)}
            disabled={readOnly || index === 0}
          >
            <ArrowUp className="h-4 w-4" /> ขึ้น
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1"
            onClick={() => onMove(1)}
            disabled={readOnly || index >= total - 1}
          >
            <ArrowDown className="h-4 w-4" /> ลง
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1"
            onClick={onDuplicate}
            disabled={readOnly}
          >
            <Copy className="h-4 w-4" /> คัดลอก
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1 text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={readOnly}
          >
            <Trash2 className="h-4 w-4" /> ลบ
          </Button>
        </div>
      </div>

      <Section title="รายละเอียดขั้นตอน">
        <div className="space-y-1.5">
          <Label htmlFor={`step-title-${step.id}`}>
            ชื่อขั้นตอน <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`step-title-${step.id}`}
            value={step.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="เช่น ตัดรางตามขนาดในใบสั่งผลิต"
            maxLength={200}
            disabled={readOnly}
            aria-invalid={!step.title.trim()}
            className="h-11"
          />
          {!step.title.trim() && (
            <p className="text-xs text-muted-foreground">ต้องมีชื่อขั้นตอนก่อนส่งตรวจ</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`step-ins-${step.id}`}>วิธีทำ</Label>
          <Textarea
            id={`step-ins-${step.id}`}
            value={step.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            placeholder={"อธิบายทีละข้อ เช่น\n1. วัดความยาวจากใบสั่งผลิต\n2. ตั้งเครื่องตัด…"}
            rows={7}
            maxLength={10_000}
            disabled={readOnly}
          />
        </div>
      </Section>

      <Section title={`รูปภาพ / วิดีโอ (${step.media.length}/12)`}>
        {step.media.length === 0 && uploads.length === 0 && (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีสื่อ — เพิ่มรูปถ่ายหน้างานช่วยให้พนักงานทำตามได้ง่ายขึ้น
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {step.media.map((m, i) => {
            const src = m.path ? mediaUrls[m.path] : undefined;
            return (
              <div key={m.id} className="space-y-2 rounded-lg border border-border p-2">
                <div className="relative overflow-hidden rounded-md bg-muted">
                  {m.type === "image" && src && (
                    <img src={src} alt={m.caption} className="aspect-[4/3] w-full object-cover" />
                  )}
                  {m.type === "video" && src && (
                    <video
                      src={src}
                      controls
                      preload="metadata"
                      className="aspect-[4/3] w-full bg-black"
                    />
                  )}
                  {m.type === "link" && (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground">
                      <Link2 className="h-6 w-6" />
                      <span className="line-clamp-3 break-all">{m.url}</span>
                    </div>
                  )}
                  {m.type !== "link" && !src && (
                    <div className="flex aspect-[4/3] items-center justify-center text-xs text-muted-foreground">
                      กำลังโหลดตัวอย่าง…
                    </div>
                  )}
                </div>
                <Input
                  value={m.caption}
                  onChange={(e) => updateMedia(m.id, { caption: e.target.value })}
                  placeholder={m.type === "link" ? "ชื่อลิงก์" : "คำอธิบายรูป"}
                  maxLength={300}
                  disabled={readOnly}
                  className="h-10"
                  aria-label="คำอธิบายสื่อ"
                />
                <div className="flex justify-between">
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => moveMedia(i, -1)}
                      disabled={readOnly || i === 0}
                      aria-label="เลื่อนสื่อไปก่อนหน้า"
                    >
                      <ArrowUp className="h-4 w-4 -rotate-90" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => moveMedia(i, 1)}
                      disabled={readOnly || i === step.media.length - 1}
                      aria-label="เลื่อนสื่อไปถัดไป"
                    >
                      <ArrowDown className="h-4 w-4 -rotate-90" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ media: step.media.filter((x) => x.id !== m.id) })}
                    disabled={readOnly}
                  >
                    <Trash2 className="h-4 w-4" /> เอาออก
                  </Button>
                </div>
              </div>
            );
          })}
          {uploads.map((u) => (
            <div
              key={u.id}
              className={cn(
                "flex flex-col justify-center gap-2 rounded-lg border border-dashed p-3 text-sm",
                u.error && "border-destructive/60 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-2">
                {u.error ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                )}
                <span className="truncate">{u.name}</span>
                {u.error && (
                  <button
                    type="button"
                    onClick={() => onDismissUpload(u.id)}
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
                    aria-label="ปิดข้อความ"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {u.error ? (
                <p className="text-xs text-destructive">{u.error}</p>
              ) : (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[#E32D24] transition-all"
                    style={{ width: `${u.pct}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) onUploadFiles(files);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => fileRef.current?.click()}
              disabled={mediaFull}
            >
              <ImagePlus className="h-4 w-4" /> อัปโหลดรูป / วิดีโอ
            </Button>
            <p className="text-xs text-muted-foreground">
              รูป JPG/PNG/WEBP ไม่เกิน 10MB · วิดีโอ MP4/WEBM/MOV ไม่เกิน 100MB
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkError("");
                }}
                placeholder="ลิงก์วิดีโอ/สื่อภายนอก https://…"
                aria-invalid={!!linkError}
                className="h-10"
                disabled={mediaFull}
              />
              <Input
                value={linkCaption}
                onChange={(e) => setLinkCaption(e.target.value)}
                placeholder="ชื่อลิงก์ (ไม่บังคับ)"
                maxLength={300}
                className="h-10"
                disabled={mediaFull}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-1"
                onClick={addLink}
                disabled={mediaFull || !linkUrl.trim()}
              >
                <Link2 className="h-4 w-4" /> เพิ่มลิงก์
              </Button>
            </div>
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
          </div>
        )}
      </Section>

      <Section
        title="ข้อควรระวัง / หมายเหตุ / ผลลัพธ์"
        collapsible
        defaultOpen={!!(step.warning.trim() || step.note.trim() || step.expected_result.trim())}
        hint="ไม่บังคับ — กดเพื่อเพิ่มคำเตือน หมายเหตุ หรือผลลัพธ์ที่ต้องได้"
      >
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1 text-[#b3221b] dark:text-[#ff8a84]">
            <AlertTriangle className="h-4 w-4" /> คำเตือน / ความปลอดภัย
          </Label>
          <Textarea
            value={step.warning}
            onChange={(e) => onChange({ warning: e.target.value })}
            placeholder="เช่น สวมถุงมือกันบาดทุกครั้ง"
            rows={2}
            maxLength={2000}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">
            <Info className="h-4 w-4 text-amber-600" /> หมายเหตุสำคัญ
          </Label>
          <Textarea
            value={step.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={2}
            maxLength={2000}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> ผลลัพธ์ที่ต้องได้
          </Label>
          <Textarea
            value={step.expected_result}
            onChange={(e) => onChange({ expected_result: e.target.value })}
            placeholder="เช่น รางตรง ไม่มีครีบคม ความยาวตรงตามใบสั่ง ±1 มม."
            rows={2}
            maxLength={2000}
            disabled={readOnly}
          />
        </div>
      </Section>

      <Section
        title={`จุดตรวจคุณภาพ (${step.checkpoints.length}/10)`}
        collapsible
        defaultOpen={step.checkpoints.length > 0}
        hint="ไม่บังคับ — กดเพื่อเพิ่มจุดตรวจ"
      >
        {step.checkpoints.length === 0 && (
          <p className="text-sm text-muted-foreground">
            ไม่บังคับ — เพิ่มเมื่อขั้นตอนนี้ต้องมีการตรวจสอบ
          </p>
        )}
        <div className="space-y-2">
          {step.checkpoints.map((c) => (
            <CheckpointRow
              key={c.id}
              c={c}
              readOnly={readOnly}
              onChange={(patch) => updateCheckpoint(c.id, patch)}
              onRemove={() =>
                onChange({ checkpoints: step.checkpoints.filter((x) => x.id !== c.id) })
              }
            />
          ))}
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2"
            onClick={() => onChange({ checkpoints: [...step.checkpoints, emptyCheckpoint()] })}
            disabled={step.checkpoints.length >= 10}
          >
            <Plus className="h-4 w-4" /> เพิ่มจุดตรวจ
          </Button>
        )}
      </Section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบขั้นตอนที่ {index + 1}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{step.title || "ไม่มีชื่อ"}” จะถูกลบออกจากร่าง (ฉบับที่เผยแพร่แล้วไม่เปลี่ยน
              จนกว่าจะอนุมัติฉบับใหม่)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              ลบขั้นตอน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
