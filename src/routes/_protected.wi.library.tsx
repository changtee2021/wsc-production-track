import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { wiShelf, type WiShelfCategory } from "@/lib/features/wi.functions";
import { WI_STATUS_LABEL } from "@/lib/wi/wi-schema";
import { WI_ACCENT_BTN } from "@/lib/wi/wi-client";

export const Route = createFileRoute("/_protected/wi/library")({
  component: WiLibraryPage,
});

type Data = Awaited<ReturnType<typeof wiShelf>>;

function WiLibraryPage() {
  const load = useServerFn(wiShelf);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setData(await load({ data: { token: requireToken() } }));
    } catch (err) {
      showError(err);
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    }
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const categories = useMemo(() => filterShelf(data?.categories ?? [], query), [data, query]);
  const loose = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.loose ?? []).filter(
      (manual) =>
        !q || manual.title.toLowerCase().includes(q) || manual.wi_code.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 pb-12 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คลัง WI</h1>
          <p className="text-sm text-muted-foreground">ขั้นตอนในแต่ละหมวด กดแก้ไขได้เลย</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 gap-1" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> รีเฟรช
          </Button>
          <Button asChild className={cn("h-11 gap-1", WI_ACCENT_BTN)}>
            <Link to="/wi/new">
              <Plus className="h-4 w-4" /> สร้าง WI
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหมวด ขั้นตอน หรือชื่อคู่มือ"
          className="h-11 pl-9"
        />
      </div>

      {error && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm">โหลดไม่สำเร็จ: {error}</p>
          <Button variant="outline" onClick={refresh}>
            ลองใหม่
          </Button>
        </div>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <section key={category.id} className="rounded-2xl border border-border bg-card">
              <header className="border-b border-border px-4 py-3">
                <h2 className="font-semibold">{category.name}</h2>
                <p className="text-xs text-muted-foreground">{category.steps.length} ขั้นตอน</p>
              </header>
              {category.steps.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  หมวดนี้ยังไม่มีคู่มือผูกขั้นตอน
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {category.steps.map((step) => (
                    <li key={step.step_id} className="px-4 py-3">
                      <p className="text-sm font-semibold">{step.step_name}</p>
                      {step.manuals.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">ยังไม่มีคู่มือ</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {step.manuals.map((manual) => (
                            <li key={manual.id} className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {manual.wi_code}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {manual.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {WI_STATUS_LABEL[manual.status]}
                              </span>
                              <Button asChild variant="outline" className="h-10 gap-1 px-3">
                                <Link to="/wi/$wiId/edit" params={{ wiId: manual.id }}>
                                  <Pencil className="h-4 w-4" /> แก้ไข
                                </Link>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {loose.length > 0 && (
            <section className="rounded-2xl border border-dashed border-border bg-card">
              <header className="border-b border-border px-4 py-3">
                <h2 className="font-semibold">ยังไม่ผูกหมวด</h2>
                <p className="text-xs text-muted-foreground">
                  แก้แล้วผูกกับขั้นตอนของหมวดสินค้าได้ในหน้าแก้ไข
                </p>
              </header>
              <ul className="divide-y divide-border">
                {loose.map((manual) => (
                  <li key={manual.id} className="flex items-center gap-2 px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {manual.wi_code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{manual.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {WI_STATUS_LABEL[manual.status]}
                    </span>
                    <Button asChild variant="outline" className="h-10 gap-1 px-3">
                      <Link to="/wi/$wiId/edit" params={{ wiId: manual.id }}>
                        <Pencil className="h-4 w-4" /> แก้ไข
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {categories.length === 0 && loose.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">ไม่พบรายการที่ค้น</p>
          )}
        </div>
      )}
    </main>
  );
}

function filterShelf(categories: WiShelfCategory[], query: string): WiShelfCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories.filter((category) => category.steps.length > 0);
  return categories
    .map((category) => {
      if (category.name.toLowerCase().includes(q)) return category;
      const steps = category.steps.filter(
        (step) =>
          step.step_name.toLowerCase().includes(q) ||
          step.manuals.some(
            (manual) =>
              manual.title.toLowerCase().includes(q) || manual.wi_code.toLowerCase().includes(q),
          ),
      );
      return { ...category, steps };
    })
    .filter((category) => category.steps.length > 0);
}
