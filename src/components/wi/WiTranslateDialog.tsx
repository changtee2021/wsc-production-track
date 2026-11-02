// English / Myanmar copies of the draft. Thai stays the master: every field
// shows its Thai source, and empty translations fall back to Thai on the floor.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Languages, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { wiAiTranslate } from "@/lib/features/wi.functions";
import {
  translationProgress,
  type WiStepContent,
  type WiStepTranslation,
  type WiTranslatedLang,
  type WiTranslation,
  type WiTranslations,
} from "@/lib/wi/wi-schema";

export type WiTranslateSource = {
  title: string;
  description: string;
  equipment: string;
  safety_notes: string;
  steps: WiStepContent[];
};

const LANG_TAB: Record<WiTranslatedLang, string> = { en: "English", my: "မြန်မာ (พม่า)" };

const emptyTranslation = (): WiTranslation => ({
  title: "",
  description: "",
  equipment: "",
  safety_notes: "",
  steps: {},
});

const emptyStepTr = (): WiStepTranslation => ({
  title: "",
  instructions: "",
  note: "",
  warning: "",
  expected_result: "",
  checkpoints: {},
});

const keep = (current: string | undefined, next: string | undefined) =>
  current?.trim() ? current : (next ?? "");

/** Fill only empty fields so manual edits are never overwritten by AI. */
function mergeEmpty(current: WiTranslation, ai: WiTranslation): WiTranslation {
  const steps: Record<string, WiStepTranslation> = { ...current.steps };
  for (const [id, aiStep] of Object.entries(ai.steps)) {
    const cur = steps[id] ?? emptyStepTr();
    const checkpoints = { ...cur.checkpoints };
    for (const [cid, c] of Object.entries(aiStep.checkpoints)) {
      const cc = checkpoints[cid] ?? { label: "", criteria: "" };
      checkpoints[cid] = {
        label: keep(cc.label, c.label),
        criteria: keep(cc.criteria, c.criteria),
      };
    }
    steps[id] = {
      title: keep(cur.title, aiStep.title),
      instructions: keep(cur.instructions, aiStep.instructions),
      note: keep(cur.note, aiStep.note),
      warning: keep(cur.warning, aiStep.warning),
      expected_result: keep(cur.expected_result, aiStep.expected_result),
      checkpoints,
    };
  }
  return {
    title: keep(current.title, ai.title),
    description: keep(current.description, ai.description),
    equipment: keep(current.equipment, ai.equipment),
    safety_notes: keep(current.safety_notes, ai.safety_notes),
    steps,
  };
}

function Field({
  thai,
  value,
  onChange,
  multiline,
  disabled,
  label,
}: {
  thai: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  label: string;
}) {
  if (!thai.trim()) return null;
  return (
    <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
      <div className="rounded-lg bg-muted/60 p-2 text-sm">
        <div className="text-[11px] font-semibold text-muted-foreground">{label} · ไทย</div>
        <p className="whitespace-pre-wrap">{thai}</p>
      </div>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={Math.min(8, Math.max(2, thai.split("\n").length + 1))}
          className={cn(!value.trim() && "border-dashed border-amber-400")}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn("h-10", !value.trim() && "border-dashed border-amber-400")}
        />
      )}
    </div>
  );
}

export function WiTranslateDialog({
  open,
  onOpenChange,
  source,
  translations,
  onChange,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: WiTranslateSource;
  translations: WiTranslations;
  onChange: (next: WiTranslations) => void;
  readOnly?: boolean;
}) {
  const translateFn = useServerFn(wiAiTranslate);
  const [lang, setLang] = useState<WiTranslatedLang>("en");
  const [busy, setBusy] = useState(false);
  const tr = translations[lang] ?? emptyTranslation();
  const progress = (l: WiTranslatedLang) => translationProgress(source, translations[l]);

  const setTr = (next: WiTranslation) => onChange({ ...translations, [lang]: next });
  const patchStep = (id: string, patch: Partial<WiStepTranslation>) => {
    const cur = tr.steps[id] ?? emptyStepTr();
    setTr({ ...tr, steps: { ...tr.steps, [id]: { ...cur, ...patch } } });
  };

  const runAi = async () => {
    setBusy(true);
    try {
      const res = await translateFn({
        data: {
          token: requireToken(),
          lang,
          source: {
            title: source.title,
            description: source.description,
            equipment: source.equipment,
            safety_notes: source.safety_notes,
            steps: source.steps.map((s) => ({
              id: s.id,
              title: s.title,
              instructions: s.instructions,
              note: s.note,
              warning: s.warning,
              expected_result: s.expected_result,
              checkpoints: s.checkpoints.map((c) => ({
                id: c.id,
                label: c.label,
                criteria: c.criteria,
              })),
            })),
          },
        },
      });
      setTr(mergeEmpty(tr, res.translation));
      toast.success("AI แปลช่องที่ว่างแล้ว — ตรวจคำแปลก่อนบันทึก");
    } catch (err) {
      showError(err, "AI แปลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const p = progress(lang);
  const locked = readOnly || busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" /> แปลภาษา
          </DialogTitle>
          <DialogDescription>
            ภาษาไทยเป็นต้นฉบับ ช่องที่ยังไม่แปล (ขอบประสีเหลือง) พนักงานจะเห็นเป็นภาษาไทย ·
            คำแปลจะไปถึงหน้างานเมื่อบันทึกร่าง ส่งตรวจ และอนุมัติแล้ว
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-muted p-1">
            {(["en", "my"] as const).map((l) => {
              const pr = progress(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium",
                    lang === l ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {LANG_TAB[l]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px]",
                      pr.total > 0 && pr.done === pr.total
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900",
                    )}
                  >
                    {pr.done}/{pr.total}
                  </span>
                </button>
              );
            })}
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              className="ml-auto h-10 gap-1"
              onClick={runAi}
              disabled={busy || p.done === p.total}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI แปลช่องที่ว่าง
            </Button>
          )}
        </div>

        <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-2">
          <section className="space-y-2">
            <h3 className="text-sm font-bold">ข้อมูลหลัก</h3>
            <Field
              label="ชื่อ WI"
              thai={source.title}
              value={tr.title}
              onChange={(v) => setTr({ ...tr, title: v })}
              disabled={locked}
            />
            <Field
              label="คำอธิบาย"
              thai={source.description}
              value={tr.description}
              onChange={(v) => setTr({ ...tr, description: v })}
              multiline
              disabled={locked}
            />
            <Field
              label="อุปกรณ์"
              thai={source.equipment}
              value={tr.equipment}
              onChange={(v) => setTr({ ...tr, equipment: v })}
              multiline
              disabled={locked}
            />
            <Field
              label="ความปลอดภัย"
              thai={source.safety_notes}
              value={tr.safety_notes}
              onChange={(v) => setTr({ ...tr, safety_notes: v })}
              multiline
              disabled={locked}
            />
          </section>

          {source.steps.map((step, i) => {
            const st = tr.steps[step.id] ?? emptyStepTr();
            return (
              <section key={step.id} className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-bold">
                  ขั้นที่ {i + 1}
                  {step.title ? ` · ${step.title}` : ""}
                </h3>
                <Field
                  label="ชื่อขั้นตอน"
                  thai={step.title}
                  value={st.title}
                  onChange={(v) => patchStep(step.id, { title: v })}
                  disabled={locked}
                />
                <Field
                  label="วิธีทำ"
                  thai={step.instructions}
                  value={st.instructions}
                  onChange={(v) => patchStep(step.id, { instructions: v })}
                  multiline
                  disabled={locked}
                />
                <Field
                  label="ข้อควรระวัง"
                  thai={step.warning}
                  value={st.warning}
                  onChange={(v) => patchStep(step.id, { warning: v })}
                  multiline
                  disabled={locked}
                />
                <Field
                  label="หมายเหตุ"
                  thai={step.note}
                  value={st.note}
                  onChange={(v) => patchStep(step.id, { note: v })}
                  multiline
                  disabled={locked}
                />
                <Field
                  label="ผลที่ต้องได้"
                  thai={step.expected_result}
                  value={st.expected_result}
                  onChange={(v) => patchStep(step.id, { expected_result: v })}
                  multiline
                  disabled={locked}
                />
                {step.checkpoints.map((c, ci) => {
                  const ct = st.checkpoints[c.id] ?? { label: "", criteria: "" };
                  const setCp = (patch: Partial<typeof ct>) =>
                    patchStep(step.id, {
                      checkpoints: { ...st.checkpoints, [c.id]: { ...ct, ...patch } },
                    });
                  return (
                    <div key={c.id} className="space-y-2">
                      <Field
                        label={`จุดตรวจ ${ci + 1}`}
                        thai={c.label}
                        value={ct.label}
                        onChange={(v) => setCp({ label: v })}
                        disabled={locked}
                      />
                      <Field
                        label={`เกณฑ์ ${ci + 1}`}
                        thai={c.criteria}
                        value={ct.criteria}
                        onChange={(v) => setCp({ criteria: v })}
                        multiline
                        disabled={locked}
                      />
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
