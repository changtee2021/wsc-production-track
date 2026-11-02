// Shared (client + server) shapes for Work Instruction documents.
// The working draft and every published snapshot use the same step shape,
// so preview and the employee view render through one component.
import { z } from "zod";

export const WI_STATUSES = ["draft", "pending_review", "published", "archived"] as const;
export type WiStatus = (typeof WI_STATUSES)[number];

export const WI_STATUS_LABEL: Record<WiStatus, string> = {
  draft: "ร่าง",
  pending_review: "รอตรวจ",
  published: "เผยแพร่แล้ว",
  archived: "เก็บถาวร",
};

export const WI_CHECKPOINT_TYPES = ["pass_fail", "checkbox", "numeric", "text", "photo"] as const;
export type WiCheckpointType = (typeof WI_CHECKPOINT_TYPES)[number];

export const WI_CHECKPOINT_LABEL: Record<WiCheckpointType, string> = {
  pass_fail: "ผ่าน / ไม่ผ่าน",
  checkbox: "ติ๊กยืนยัน",
  numeric: "ค่าตัวเลข (min–max)",
  text: "ข้อความสั้น",
  photo: "ถ่ายรูปหลักฐาน",
};

export const WI_MEDIA_TYPES = ["image", "video", "link"] as const;

const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => /^https?:\/\//i.test(u), "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");

export const wiMediaSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(WI_MEDIA_TYPES),
    path: z.string().max(300).nullable(),
    url: z.string().max(1000).nullable(),
    caption: z.string().max(300),
  })
  .superRefine((m, ctx) => {
    if (m.type === "link") {
      if (!m.url || !/^https?:\/\//i.test(m.url)) {
        ctx.addIssue({ code: "custom", message: "ลิงก์สื่อต้องขึ้นต้นด้วย http(s)://" });
      }
    } else if (!m.path) {
      ctx.addIssue({ code: "custom", message: "ไฟล์สื่อไม่มี path" });
    }
  });

export const wiCheckpointSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(WI_CHECKPOINT_TYPES),
    label: z.string().trim().min(1, "กรอกชื่อจุดตรวจ").max(200),
    criteria: z.string().max(500),
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
    unit: z.string().max(20),
    required: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.type === "numeric") {
      if (c.min == null && c.max == null) {
        ctx.addIssue({ code: "custom", message: `จุดตรวจ "${c.label}" ต้องมีค่า min หรือ max` });
      }
      if (c.min != null && c.max != null && c.min > c.max) {
        ctx.addIssue({ code: "custom", message: `จุดตรวจ "${c.label}": min มากกว่า max` });
      }
    }
  });

export const wiStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200),
  instructions: z.string().max(10_000),
  note: z.string().max(2000),
  warning: z.string().max(2000),
  expected_result: z.string().max(2000),
  media: z.array(wiMediaSchema).max(12, "รูป/สื่อได้ไม่เกิน 12 ชิ้นต่อขั้นตอน"),
  checkpoints: z.array(wiCheckpointSchema).max(10, "จุดตรวจได้ไม่เกิน 10 จุดต่อขั้นตอน"),
});

export const wiRelatedDocSchema = z.object({
  label: z.string().trim().min(1).max(200),
  url: httpUrl,
});

export const WI_LANGS = ["th", "en", "my"] as const;
export type WiLang = (typeof WI_LANGS)[number];
export const WI_TRANSLATED_LANGS = ["en", "my"] as const;
export type WiTranslatedLang = (typeof WI_TRANSLATED_LANGS)[number];

const trText = (max: number) => z.string().max(max).default("");

export const wiStepTranslationSchema = z.object({
  title: trText(200),
  instructions: trText(10_000),
  note: trText(2000),
  warning: trText(2000),
  expected_result: trText(2000),
  checkpoints: z
    .record(z.string(), z.object({ label: trText(200), criteria: trText(500) }))
    .default({}),
});

export const wiTranslationSchema = z.object({
  title: trText(200),
  description: trText(2000),
  equipment: trText(2000),
  safety_notes: trText(4000),
  steps: z.record(z.string(), wiStepTranslationSchema).default({}),
});

export const wiTranslationsSchema = z
  .object({ en: wiTranslationSchema.optional(), my: wiTranslationSchema.optional() })
  .default({});

export type WiStepTranslation = z.infer<typeof wiStepTranslationSchema>;
export type WiTranslation = z.infer<typeof wiTranslationSchema>;
export type WiTranslations = z.infer<typeof wiTranslationsSchema>;

export const wiDocInputSchema = z.object({
  title: z.string().trim().min(1, "กรอกชื่อ WI").max(200),
  description: z.string().max(2000),
  category_id: z.string().uuid().nullable(),
  owner_name: z.string().trim().max(120),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  est_minutes: z.number().int().min(0).max(10_000).nullable(),
  equipment: z.string().max(2000),
  safety_notes: z.string().max(4000),
  related_docs: z.array(wiRelatedDocSchema).max(20),
  steps: z.array(wiStepSchema).max(100, "ขั้นตอนได้ไม่เกิน 100 ขั้น"),
  translations: wiTranslationsSchema,
});

export type WiMedia = z.infer<typeof wiMediaSchema>;
export type WiCheckpoint = z.infer<typeof wiCheckpointSchema>;
export type WiStepContent = z.infer<typeof wiStepSchema>;
export type WiRelatedDoc = z.infer<typeof wiRelatedDocSchema>;
export type WiDocInput = z.infer<typeof wiDocInputSchema>;

/** What employees see: the published snapshot (also used for draft preview). */
export type WiSnapshot = {
  wi_code: string;
  title: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  owner_name: string | null;
  tags: string[];
  est_minutes: number | null;
  equipment: string | null;
  safety_notes: string | null;
  related_docs: WiRelatedDoc[];
  steps: WiStepContent[];
  translations: WiTranslations;
};

/** Tolerant read of stored translations (older rows have none). */
export function normalizeTranslations(raw: unknown): WiTranslations {
  const parsed = wiTranslationsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

const pick = (translated: string | undefined, thai: string) =>
  translated && translated.trim() ? translated : thai;

/**
 * Overlay one language on the Thai master. Empty translated fields fall back
 * to Thai, and `missing` tells the viewer to say so instead of hiding it.
 */
export function localizeSnapshot(
  snapshot: WiSnapshot,
  lang: WiLang,
): { snapshot: WiSnapshot; missing: boolean } {
  if (lang === "th") return { snapshot, missing: false };
  const tr = snapshot.translations?.[lang];
  if (!tr) return { snapshot, missing: true };
  let missing = !tr.title.trim();
  const steps = snapshot.steps.map((step) => {
    const st = tr.steps[step.id];
    if (!st || (step.instructions.trim() && !st.instructions.trim())) missing = true;
    if (!st) return step;
    return {
      ...step,
      title: pick(st.title, step.title),
      instructions: pick(st.instructions, step.instructions),
      note: pick(st.note, step.note),
      warning: pick(st.warning, step.warning),
      expected_result: pick(st.expected_result, step.expected_result),
      checkpoints: step.checkpoints.map((c) => {
        const ct = st.checkpoints[c.id];
        return ct
          ? { ...c, label: pick(ct.label, c.label), criteria: pick(ct.criteria, c.criteria) }
          : c;
      }),
    };
  });
  return {
    missing,
    snapshot: {
      ...snapshot,
      title: pick(tr.title, snapshot.title),
      description: snapshot.description ? pick(tr.description, snapshot.description) : null,
      equipment: snapshot.equipment ? pick(tr.equipment, snapshot.equipment) : null,
      safety_notes: snapshot.safety_notes ? pick(tr.safety_notes, snapshot.safety_notes) : null,
      steps,
    },
  };
}

/** Share of Thai fields that have a translation (for the editor badge). */
export function translationProgress(
  doc: Pick<WiSnapshot, "title" | "description" | "equipment" | "safety_notes" | "steps">,
  tr: WiTranslation | undefined,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const count = (thai: string | null | undefined, translated: string | undefined) => {
    if (!thai?.trim()) return;
    total += 1;
    if (translated?.trim()) done += 1;
  };
  count(doc.title, tr?.title);
  count(doc.description, tr?.description);
  count(doc.equipment, tr?.equipment);
  count(doc.safety_notes, tr?.safety_notes);
  for (const step of doc.steps) {
    const st = tr?.steps[step.id];
    count(step.title, st?.title);
    count(step.instructions, st?.instructions);
    count(step.note, st?.note);
    count(step.warning, st?.warning);
    count(step.expected_result, st?.expected_result);
    for (const c of step.checkpoints) {
      count(c.label, st?.checkpoints[c.id]?.label);
      count(c.criteria, st?.checkpoints[c.id]?.criteria);
    }
  }
  return { done, total };
}

export function versionLabel(major: number | null | undefined, minor: number | null | undefined) {
  if (major == null) return null;
  return `v${major}.${minor ?? 0}`;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyStep(): WiStepContent {
  return {
    id: newId(),
    title: "",
    instructions: "",
    note: "",
    warning: "",
    expected_result: "",
    media: [],
    checkpoints: [],
  };
}

export function emptyCheckpoint(type: WiCheckpointType = "pass_fail"): WiCheckpoint {
  return {
    id: newId(),
    type,
    label: "",
    criteria: "",
    min: null,
    max: null,
    unit: "",
    required: true,
  };
}

/** All storage paths referenced by a snapshot/draft (for signing). */
export function collectMediaPaths(steps: WiStepContent[]): string[] {
  const out: string[] = [];
  for (const s of steps) for (const m of s.media) if (m.type !== "link" && m.path) out.push(m.path);
  return out;
}
