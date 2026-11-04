// Read-only Work Instruction view — the same component renders the admin
// preview (draft) and the employee view (published snapshot), so what the
// reviewer approves is exactly what the floor sees. No edit controls here.
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  Info,
  Languages,
  LayoutList,
  ListOrdered,
  Loader2,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  localizeSnapshot,
  type WiCheckpoint,
  type WiLang,
  type WiSnapshot,
  type WiStepContent,
} from "@/lib/wi/wi-schema";
import { WI_ACCENT_BTN, WI_ACCENT_TEXT } from "@/lib/wi/wi-client";
import { checkpointTypeLabel, formatWiDate, wiT, type WiT } from "@/lib/wi/wi-i18n";

export type WiViewerReadState = {
  status: "none" | "viewed" | "read" | "outdated";
  acknowledged_at: string | null;
};

type Props = {
  snapshot: WiSnapshot;
  mediaUrls: Record<string, string>;
  versionLabel?: string | null;
  publishedAt?: string | null;
  /** Shows a banner that this is not yet the live version. */
  isPreview?: boolean;
  lang?: WiLang;
  /** Employee view only: drives the "I have read it" button on the last step. */
  readState?: WiViewerReadState | null;
  onAcknowledge?: () => void;
  acknowledging?: boolean;
};

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return <p className={cn("whitespace-pre-wrap leading-relaxed", className)}>{text}</p>;
}

function CheckpointItem({ c, t }: { c: WiCheckpoint; t: WiT }) {
  const Icon = c.type === "photo" ? Camera : ClipboardCheck;
  const range =
    c.type === "numeric"
      ? [c.min != null ? `≥ ${c.min}` : null, c.max != null ? `≤ ${c.max}` : null]
          .filter(Boolean)
          .join("  ") + (c.unit ? ` ${c.unit}` : "")
      : null;
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-background p-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-0.5">
        <div className="text-base font-medium">
          {c.label}
          {c.required && <span className={cn("ml-1", WI_ACCENT_TEXT)}>*</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {checkpointTypeLabel(t, c.type)}
          {range ? ` · ${range}` : ""}
        </div>
        {c.criteria && <Paragraphs text={c.criteria} className="text-sm" />}
      </div>
    </li>
  );
}

function StepMedia({
  step,
  mediaUrls,
  t,
  onOpenImage,
}: {
  step: WiStepContent;
  mediaUrls: Record<string, string>;
  t: WiT;
  onOpenImage: (src: string, caption: string) => void;
}) {
  if (step.media.length === 0) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted text-muted-foreground">
        <Camera className="h-10 w-10 opacity-40" />
        <span className="text-sm font-medium">{t("photoWaiting")}</span>
      </div>
    );
  }
  const single = step.media.length === 1;
  return (
    <div className={cn("grid gap-2", !single && "grid-cols-2")}>
      {step.media.map((m, i) => {
        const src = m.path ? mediaUrls[m.path] : undefined;
        const wide = single || (i === 0 && step.media.length % 2 === 1);
        return (
          <figure key={m.id} className={cn("space-y-1", wide && "col-span-2")}>
            {m.type === "image" &&
              (src ? (
                <button
                  type="button"
                  onClick={() => onOpenImage(src, m.caption || step.title)}
                  className="flex w-full justify-center overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src={src}
                    alt={m.caption || step.title}
                    loading="lazy"
                    className={cn(
                      "bg-muted object-contain",
                      single ? "h-auto max-h-[46vh] w-auto max-w-full" : "aspect-[4/3] w-full",
                    )}
                  />
                </button>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed text-xs text-muted-foreground">
                  <Camera className="h-6 w-6 opacity-40" />
                </div>
              ))}
            {m.type === "video" &&
              (src ? (
                <video
                  src={src}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={t("video")}
                  className="aspect-video w-full rounded-2xl bg-black"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed text-xs text-muted-foreground">
                  {t("video")}
                </div>
              ))}
            {m.type === "link" && m.url && (
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border p-3 text-sm font-medium underline-offset-2 hover:underline"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">{m.caption || t("openLink")}</span>
              </a>
            )}
            {m.caption && m.type !== "link" && (
              <figcaption className="px-1 text-sm text-muted-foreground">{m.caption}</figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}

function stepIsCaptionOnly(step: WiStepContent) {
  return (
    step.media.length > 0 &&
    !step.instructions &&
    !step.warning &&
    !step.note &&
    !step.expected_result &&
    step.checkpoints.length === 0
  );
}

function StepBlock({
  step,
  index,
  total,
  mediaUrls,
  t,
  onOpenImage,
}: {
  step: WiStepContent;
  index: number;
  total: number;
  mediaUrls: Record<string, string>;
  t: WiT;
  onOpenImage: (src: string, caption: string) => void;
}) {
  const heading = (
    <header className="flex items-start gap-3 px-1">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E32D24] text-lg font-bold text-white">
        {index + 1}
      </span>
      <div className="min-w-0 pt-0.5">
        <div className="text-xs font-medium text-muted-foreground">
          {t("stepOf", { i: index + 1, n: total })}
        </div>
        <h3 className="text-xl font-bold leading-snug">{step.title || "—"}</h3>
      </div>
    </header>
  );

  if (stepIsCaptionOnly(step)) {
    return (
      <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="px-3 pt-3 sm:px-4">{heading}</div>
        <div className="p-3 sm:p-4">
          <StepMedia step={step} mediaUrls={mediaUrls} t={t} onOpenImage={onOpenImage} />
        </div>
      </article>
    );
  }

  return (
    <article className="@container rounded-3xl border border-border bg-card p-3 shadow-sm sm:p-5">
      <div className="space-y-4 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-6 @2xl:space-y-0">
        <div className="@2xl:sticky @2xl:top-20">
          <StepMedia step={step} mediaUrls={mediaUrls} t={t} onOpenImage={onOpenImage} />
        </div>
        <div className="min-w-0 space-y-4">
          {heading}

          {step.warning && (
            <div className="flex gap-2 rounded-2xl bg-[#E32D24]/10 p-3 text-[#b3221b] dark:text-[#ff8a84]">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="text-xs font-bold">{t("caution")}</div>
                <Paragraphs text={step.warning} className="text-base font-medium" />
              </div>
            </div>
          )}

          {step.instructions && (
            <Paragraphs text={step.instructions} className="px-1 text-lg leading-8" />
          )}

          {step.note && (
            <div className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <Info className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="text-xs font-bold">{t("note")}</div>
                <Paragraphs text={step.note} className="text-base" />
              </div>
            </div>
          )}

          {step.expected_result && (
            <div className="flex gap-2 rounded-2xl bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="text-xs font-bold">{t("expected")}</div>
                <Paragraphs text={step.expected_result} className="text-base" />
              </div>
            </div>
          )}

          {step.checkpoints.length > 0 && (
            <div className="space-y-2">
              <div className="px-1 text-sm font-bold">{t("checks")}</div>
              <ul className="space-y-2">
                {step.checkpoints.map((c) => (
                  <CheckpointItem key={c.id} c={c} t={t} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ReadChip({ state, t, lang }: { state: WiViewerReadState; t: WiT; lang: WiLang }) {
  if (state.status === "read" && state.acknowledged_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        <BadgeCheck className="h-3.5 w-3.5" />
        {t("readAt", { t: formatWiDate(state.acknowledged_at, lang) })}
      </span>
    );
  }
  if (state.status === "outdated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
        <Sparkles className="h-3.5 w-3.5" />
        {t("pleaseRead")}
      </span>
    );
  }
  return null;
}

export function WiViewer({
  snapshot: master,
  mediaUrls,
  versionLabel,
  publishedAt,
  isPreview,
  lang = "th",
  readState,
  onAcknowledge,
  acknowledging,
}: Props) {
  const t = useMemo(() => wiT(lang), [lang]);
  const { snapshot, missing } = useMemo(() => localizeSnapshot(master, lang), [master, lang]);
  const steps = snapshot.steps;
  const [mode, setMode] = useState<"step" | "all">("step");
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const idx = Math.min(current, Math.max(0, steps.length - 1));
  const isLast = idx >= steps.length - 1;
  const isRead = readState?.status === "read";

  const goTo = (i: number) => {
    setCurrent(i);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openImage = (src: string, caption: string) => setLightbox({ src, caption });

  const ackButton = onAcknowledge ? (
    <Button
      className={cn(
        "h-14 w-full rounded-2xl text-base font-semibold",
        isRead
          ? "bg-emerald-600 text-white hover:bg-emerald-600 disabled:opacity-100"
          : WI_ACCENT_BTN,
      )}
      disabled={isRead || acknowledging}
      onClick={onAcknowledge}
    >
      {acknowledging ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <BadgeCheck className="h-5 w-5" />
      )}
      {isRead ? t("readDone") : t("confirmRead")}
    </Button>
  ) : null;

  return (
    <div className="space-y-4">
      {isPreview && (
        <div className="rounded-xl border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {t("previewBanner")}
        </div>
      )}
      {missing && (
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          <Languages className="h-4 w-4 shrink-0" />
          {t("notTranslated")}
        </div>
      )}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-foreground px-2.5 py-1 font-mono font-semibold text-background">
            {snapshot.wi_code}
          </span>
          {versionLabel && (
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-muted-foreground">
              {versionLabel}
              {publishedAt ? ` · ${formatWiDate(publishedAt, lang)}` : ""}
            </span>
          )}
          {snapshot.est_minutes != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {t("minutes", { n: snapshot.est_minutes })}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
            <ListOrdered className="h-3.5 w-3.5" /> {t("stepsCount", { n: steps.length })}
          </span>
          {readState && <ReadChip state={readState} t={t} lang={lang} />}
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {snapshot.title}
        </h1>
        {snapshot.description && (
          <Paragraphs text={snapshot.description} className="text-base text-muted-foreground" />
        )}
      </header>

      {(snapshot.safety_notes || snapshot.equipment) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {snapshot.safety_notes && (
            <section className="flex gap-2.5 rounded-2xl bg-[#E32D24]/10 p-3">
              <ShieldAlert className={cn("mt-0.5 h-5 w-5 shrink-0", WI_ACCENT_TEXT)} />
              <div className="min-w-0">
                <h2 className={cn("text-sm font-bold", WI_ACCENT_TEXT)}>{t("safety")}</h2>
                <Paragraphs text={snapshot.safety_notes} className="text-sm" />
              </div>
            </section>
          )}
          {snapshot.equipment && (
            <section className="flex gap-2.5 rounded-2xl bg-muted p-3">
              <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold">{t("equipment")}</h2>
                <Paragraphs text={snapshot.equipment} className="text-sm" />
              </div>
            </section>
          )}
        </div>
      )}

      {steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("noSteps")}
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              {mode === "step" ? t("stepOf", { i: idx + 1, n: steps.length }) : t("showAll")}
            </div>
            {steps.length > 1 && (
              <div className="inline-flex rounded-xl bg-muted p-1">
                {(
                  [
                    ["step", ListOrdered, t("oneByOne")],
                    ["all", LayoutList, t("showAll")],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium",
                      mode === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mode === "step" ? (
            <>
              {steps.length > 1 && (
                <div
                  className="flex gap-1.5 overflow-x-auto pb-1"
                  role="tablist"
                  aria-label={t("step")}
                >
                  {steps.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={i === idx}
                      onClick={() => goTo(i)}
                      title={s.title}
                      className={cn(
                        "h-11 min-w-11 shrink-0 rounded-xl text-sm font-bold transition-colors",
                        i === idx
                          ? "bg-[#E32D24] text-white"
                          : i < idx
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i < idx ? <CheckCircle2 className="mx-auto h-4 w-4" /> : i + 1}
                    </button>
                  ))}
                </div>
              )}
              <StepBlock
                step={steps[idx]}
                index={idx}
                total={steps.length}
                mediaUrls={mediaUrls}
                t={t}
                onOpenImage={openImage}
              />
              <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 mx-auto grid w-full max-w-2xl grid-cols-[auto_1fr] gap-2 rounded-2xl bg-background/80 p-1 backdrop-blur">
                <Button
                  variant="outline"
                  className="h-14 rounded-2xl px-4 text-base"
                  disabled={idx === 0}
                  onClick={() => goTo(idx - 1)}
                  aria-label={t("prev")}
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span className="hidden sm:inline">{t("prev")}</span>
                </Button>
                {isLast && ackButton ? (
                  ackButton
                ) : (
                  <Button
                    className={cn("h-14 rounded-2xl text-base font-semibold", WI_ACCENT_BTN)}
                    disabled={isLast}
                    onClick={() => goTo(idx + 1)}
                  >
                    {t("next")} <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {steps.map((s, i) => (
                <StepBlock
                  key={s.id}
                  step={s}
                  index={i}
                  total={steps.length}
                  mediaUrls={mediaUrls}
                  t={t}
                  onOpenImage={openImage}
                />
              ))}
              {ackButton && (
                <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 mx-auto w-full max-w-2xl">
                  {ackButton}
                </div>
              )}
            </div>
          )}
          {ackButton && !isRead && (
            <p className="text-center text-xs text-muted-foreground">{t("confirmReadHint")}</p>
          )}
        </section>
      )}

      {snapshot.related_docs.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t("related")}</h2>
          <ul className="space-y-1">
            {snapshot.related_docs.map((d, i) => (
              <li key={`${d.url}-${i}`}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm underline-offset-2 hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  {d.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-5xl border-0 bg-black/95 p-2 sm:p-4">
          <DialogTitle className="sr-only">{lightbox?.caption || snapshot.title}</DialogTitle>
          {lightbox && (
            <figure className="space-y-2">
              <img
                src={lightbox.src}
                alt={lightbox.caption}
                className="max-h-[80vh] w-full object-contain"
              />
              {lightbox.caption && (
                <figcaption className="text-center text-sm text-white/80">
                  {lightbox.caption}
                </figcaption>
              )}
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
