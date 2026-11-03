// Employee catalog: pick a product category, then open the published WI for each step.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  wiPublicCatalog,
  type WiCatalogFlow,
  type WiCatalogStep,
  type WiReadStatus,
} from "@/lib/features/wi.functions";
import { WiManualHeader, WiReaderGate } from "@/components/wi/WiReaderControls";
import { stepLabel } from "@/lib/scan-trial";
import { bilingualName, useWiLang, useWiReader, type WiT } from "@/lib/wi/wi-i18n";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/manual/")({
  validateSearch: zodValidator(z.object({ category: fallback(z.string(), "").default("") })),
  head: () => ({
    meta: [
      { title: "คู่มือปฏิบัติงาน — WSC ProductionTrack" },
      { name: "description", content: "เลือกหมวดสินค้า แล้วเปิดคู่มือตามขั้นตอนการผลิต" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManualCatalogPage,
});

type Catalog = Awaited<ReturnType<typeof wiPublicCatalog>>;

function ReadBadge({ status, t }: { status: WiReadStatus; t: WiT }) {
  if (status === "read") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        <BadgeCheck className="h-3.5 w-3.5" /> {t("readDone")}
      </span>
    );
  }
  if (status === "outdated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
        <Sparkles className="h-3.5 w-3.5" /> {t("newVersion")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#E32D24]/10 px-2 py-0.5 text-xs font-semibold text-[#b3221b] dark:text-[#ff8a84]">
      <Circle className="h-2.5 w-2.5 fill-current" /> {t("unread")}
    </span>
  );
}

function FlowChip({
  step,
  lang,
  empty,
}: {
  step: WiCatalogStep;
  lang: ReturnType<typeof useWiLang>[0];
  empty: string;
}) {
  const label = lang === "my" ? stepLabel(step.step_name) : bilingualName(step.step_name, lang);
  if (step.items.length === 0) {
    return (
      <span className="inline-flex min-h-11 items-center rounded-full border border-dashed border-border px-3 text-sm font-semibold text-muted-foreground">
        {label}
        <span className="ml-1 text-[10px] font-normal">{empty}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {step.items.map((item) => (
        <Link
          key={item.code}
          to="/manual/$code"
          params={{ code: item.code }}
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-3 text-sm font-semibold"
        >
          {step.items.length > 1 ? item.title : label}
        </Link>
      ))}
    </span>
  );
}

function FlowBoard({
  flow,
  lang,
  t,
}: {
  flow: WiCatalogFlow;
  lang: ReturnType<typeof useWiLang>[0];
  t: WiT;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("flowParallelHint")}</p>
      <div className="rounded-3xl border border-dashed border-sky-300 bg-sky-50/70 p-3 dark:border-sky-800 dark:bg-sky-950/30">
        <p className="mb-2 text-xs font-semibold text-sky-800 dark:text-sky-200">
          1 · {t("flowParallel")}
        </p>
        <div className="space-y-2">
          {flow.lanes.map((lane, index) => (
            <div key={index} className="flex flex-wrap items-center gap-1.5">
              {lane.map((step, stepIndex) => (
                <span key={step.step_id} className="inline-flex items-center gap-1.5">
                  {stepIndex > 0 && <span className="text-muted-foreground">→</span>}
                  <FlowChip step={step} lang={lang} empty={t("noStepManual")} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {flow.after.map((step, index) => (
          <span key={step.step_id} className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">{index === 0 ? "→" : "→"}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {index + 2}
            </span>
            <FlowChip step={step} lang={lang} empty={t("noStepManual")} />
          </span>
        ))}
      </div>
      {flow.extra.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("extraManuals")}</p>
          <div className="flex flex-wrap gap-2">
            {flow.extra.flatMap((step) =>
              step.items.map((item) => (
                <Link
                  key={item.code}
                  to="/manual/$code"
                  params={{ code: item.code }}
                  className="inline-flex min-h-11 items-center rounded-full border bg-card px-3 text-sm font-semibold"
                >
                  {item.title}
                </Link>
              )),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualCatalogPage() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/manual/" });
  const catalogFn = useServerFn(wiPublicCatalog);
  const categoryId = UUID_RE.test(category) ? category : null;
  const [lang, , t] = useWiLang();
  const [reader] = useWiReader();
  const readerId = reader?.id ?? null;

  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!readerId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    catalogFn({ data: { category_id: categoryId, employee_id: readerId, lang } })
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "error");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [catalogFn, categoryId, readerId, lang, reload]);

  const selected = data?.categories.find((cat) => cat.id === categoryId) ?? null;

  return (
    <main className="min-h-[100dvh] bg-muted/30">
      <WiManualHeader
        back={
          categoryId ? (
            <Button
              variant="ghost"
              className="h-11 gap-1 px-2"
              onClick={() => navigate({ search: { category: "" } })}
            >
              <ArrowLeft className="h-5 w-5" /> {t("products")}
            </Button>
          ) : (
            <Button asChild variant="ghost" className="h-11 gap-1 px-2">
              <Link to="/">
                <ArrowLeft className="h-5 w-5" /> {t("home")}
              </Link>
            </Button>
          )
        }
      />

      <section className="mx-auto max-w-5xl px-3 py-4 pb-16 sm:px-4 sm:py-5">
        <WiReaderGate>
          <div className="space-y-4">
            <div className="px-1">
              <p className="text-xs font-semibold tracking-wide text-[#E32D24]">{t("kicker")}</p>
              <h1 className="text-2xl font-bold">
                {selected ? bilingualName(selected.name, lang) : t("pickProduct")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected ? t("stepsHint") : t("pickProductHint")}
              </p>
            </div>

            {error ? (
              <div className="space-y-3 rounded-3xl border border-destructive/40 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button className="h-11" variant="outline" onClick={() => setReload((n) => n + 1)}>
                  {t("retry")}
                </Button>
              </div>
            ) : !data ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
              </div>
            ) : categoryId && !selected ? (
              <div className="space-y-3 rounded-3xl border border-dashed p-8 text-center">
                <p className="font-medium">{t("noProduct")}</p>
                <Button className="h-11" onClick={() => navigate({ search: { category: "" } })}>
                  {t("backToProducts")}
                </Button>
              </div>
            ) : !categoryId ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {data.categories.map((cat) => (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ search: { category: cat.id } })}
                      className={cn(
                        "flex min-h-28 w-full flex-col rounded-3xl border bg-card p-4 text-left shadow-sm active:scale-[0.99] active:bg-muted",
                        cat.wi_count === 0 ? "border-border opacity-70" : "border-border",
                      )}
                    >
                      <span className="text-lg font-bold leading-snug" title={cat.name}>
                        {bilingualName(cat.name, lang)}
                      </span>
                      {bilingualName(cat.name, lang) !== bilingualName(cat.name, "th") && (
                        <span className="text-xs text-muted-foreground">
                          {bilingualName(cat.name, "th")}
                        </span>
                      )}
                      <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-sm text-muted-foreground">
                        <span>{t("manualsCount", { n: cat.wi_count })}</span>
                        {readerId && cat.wi_count > 0 && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              cat.unread_count > 0
                                ? "bg-[#E32D24] text-white"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
                            )}
                          >
                            {cat.unread_count > 0
                              ? t("unreadCount", { n: cat.unread_count })
                              : t("allRead")}
                          </span>
                        )}
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : data.flow ? (
              <FlowBoard flow={data.flow} lang={lang} t={t} />
            ) : loading && data.steps.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
              </div>
            ) : data.steps.length === 0 ? (
              <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
                <p className="font-medium">{t("noManuals")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("noManualsHint")}</p>
              </div>
            ) : (
              <ol className="relative space-y-5">
                {data.steps.map((step, index) => (
                  <li key={step.step_id} className="space-y-2">
                    <div className="flex items-center gap-3 px-1">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E32D24] text-lg font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t("step")}</p>
                        <h2
                          className="truncate text-lg font-bold leading-tight"
                          title={step.step_name}
                        >
                          {bilingualName(step.step_name, lang)}
                        </h2>
                      </div>
                    </div>
                    <ul className="grid gap-2 lg:grid-cols-2">
                      {step.items.map((item) => (
                        <li key={item.code}>
                          <Link
                            to="/manual/$code"
                            params={{ code: item.code }}
                            className="flex items-stretch gap-3 overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-sm active:scale-[0.99] active:bg-muted"
                          >
                            {item.cover_url ? (
                              <img
                                src={item.cover_url}
                                alt=""
                                className="h-24 w-28 shrink-0 rounded-2xl object-cover sm:h-28 sm:w-36"
                              />
                            ) : (
                              <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground sm:h-28 sm:w-36">
                                <BookOpenCheck className="h-8 w-8" />
                              </div>
                            )}
                            <div className="flex min-w-0 flex-1 flex-col gap-1 py-1 pr-1">
                              <p className="line-clamp-2 text-base font-bold leading-snug">
                                {item.title}
                              </p>
                              {item.description && (
                                <p className="line-clamp-1 text-sm text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                              <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                {readerId && <ReadBadge status={item.read_status} t={t} />}
                                {item.est_minutes != null && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {t("minutes", { n: item.est_minutes })}
                                  </span>
                                )}
                                <span className="font-mono">
                                  {item.code}
                                  {item.version ? ` · ${item.version}` : ""}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 self-center text-muted-foreground" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </WiReaderGate>
      </section>
    </main>
  );
}
