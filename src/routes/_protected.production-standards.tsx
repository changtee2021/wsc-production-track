// Production standards — per-(step × category) target seconds + red-alert threshold.
// Tabs by category for focused editing; matrix-by-step inside each tab.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListProductionStandards,
  adminUpsertProductionStandard,
  adminDeleteProductionStandard,
} from "@/lib/features/production-monitor.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SlidersHorizontal, Save, Flame, Trash2, Clock, Search } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AppVersion } from "@/components/AppVersion";

export const Route = createFileRoute("/_protected/production-standards")({
  head: () => ({ meta: [{ title: "เวลามาตรฐาน — WSC ProductionTrack" }] }),
  component: StandardsPage,
});

type Std = {
  id: string;
  step_id: string;
  category_id: string | null;
  target_seconds: number;
  red_threshold: number | null;
  active: boolean;
};
type Cat = { id: string; name: string };
type Step = { id: string; step_name: string };

function StandardsPage() {
  const listFn = useServerFn(adminListProductionStandards);
  const upsertFn = useServerFn(adminUpsertProductionStandard);
  const delFn = useServerFn(adminDeleteProductionStandard);

  const [stds, setStds] = useState<Std[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [defaultRed, setDefaultRed] = useState(3);
  const [edits, setEdits] = useState<Record<string, { mins?: string; red?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("__default");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await listFn({ data: { token: requireToken() } });
      setStds(r.standards as Std[]);
      setCats(r.categories as Cat[]);
      setSteps(r.steps as Step[]);
      setDefaultRed(r.default_red_threshold ?? 3);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const keyOf = (step_id: string, category_id: string | null) => `${step_id}|${category_id ?? ""}`;
  const stdMap = useMemo(
    () => new Map<string, Std>(stds.map((s) => [keyOf(s.step_id, s.category_id), s])),
    [stds],
  );

  const tabCatId = (tabId: string): string | null => (tabId === "__default" ? null : tabId);

  const cellMinutes = (step_id: string, category_id: string | null) => {
    const k = keyOf(step_id, category_id);
    const e = edits[k]?.mins;
    if (e != null) return e;
    const s = stdMap.get(k);
    return s ? String(Math.round((s.target_seconds / 60) * 100) / 100) : "";
  };
  const cellRed = (step_id: string, category_id: string | null) => {
    const k = keyOf(step_id, category_id);
    const e = edits[k]?.red;
    if (e != null) return e;
    const s = stdMap.get(k);
    return s ? String(s.red_threshold ?? defaultRed) : String(defaultRed);
  };

  const setField = (
    step_id: string,
    category_id: string | null,
    field: "mins" | "red",
    val: string,
  ) => {
    const k = keyOf(step_id, category_id);
    setEdits((p) => ({ ...p, [k]: { ...(p[k] ?? {}), [field]: val } }));
  };

  const saveCell = async (step_id: string, category_id: string | null) => {
    const mins = Number(cellMinutes(step_id, category_id));
    const red = parseInt(cellRed(step_id, category_id), 10);
    if (!Number.isFinite(mins) || mins <= 0) return toast.error("กรอกเวลาเป็นนาที (>0)");
    if (!Number.isFinite(red) || red < 1 || red > 50)
      return toast.error("กรอกจำนวนครั้งไฟแดง 1-50");
    try {
      await upsertFn({
        data: {
          token: requireToken(),
          step_id,
          category_id,
          target_seconds: Math.round(mins * 60),
          red_threshold: red,
        },
      });
      toast.success("บันทึกแล้ว");
      const k = keyOf(step_id, category_id);
      setEdits((e) => {
        const c = { ...e };
        delete c[k];
        return c;
      });
      await load();
    } catch (err) {
      showError(err);
    }
  };

  const deleteCell = async (id: string) => {
    if (!confirm("ลบมาตรฐานนี้?")) return;
    try {
      await delFn({ data: { token: requireToken(), id } });
      toast.success("ลบแล้ว");
      await load();
    } catch (err) {
      showError(err);
    }
  };

  const saveDirty = async (catId: string | null) => {
    const dirty = Object.entries(edits).filter(([k]) => k.endsWith(`|${catId ?? ""}`));
    if (dirty.length === 0) return toast.info("ไม่มีการเปลี่ยนแปลง");
    for (const [k] of dirty) {
      const [stepId] = k.split("|");

      await saveCell(stepId, catId);
    }
  };

  const tabsList = [{ id: "__default", name: "ทุกหมวด (default)" }, ...cats];
  const filteredSteps = steps.filter(
    (s) => !query.trim() || s.step_name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <SlidersHorizontal className="h-6 w-6 text-primary" />
        เวลามาตรฐาน &amp; จำนวนครั้งไฟแดง
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        เลือกหมวดสินค้า แล้วตั้งเวลามาตรฐาน (นาที) + จำนวนครั้งต่อวันที่ถือว่า "ไฟแดง"
        สำหรับแต่ละขั้นตอน
      </p>

      <div className="mt-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อขั้นตอน"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="flex-wrap">
            {tabsList.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabsList.map((c) => {
            const catId = tabCatId(c.id);
            return (
              <TabsContent key={c.id} value={c.id} className="mt-3">
                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold">{c.name}</h2>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => saveDirty(catId)}
                    >
                      <Save className="h-3.5 w-3.5" /> บันทึกทั้งหมวด
                    </Button>
                  </div>

                  {filteredSteps.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      ไม่พบขั้นตอน
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                            <th className="py-2 pr-3">ขั้นตอน</th>
                            <th className="py-2 pr-3">เวลามาตรฐาน (นาที)</th>
                            <th className="py-2 pr-3">ไฟแดง (ครั้ง/วัน)</th>
                            <th className="py-2 pr-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSteps.map((s) => {
                            const existing = stdMap.get(keyOf(s.id, catId));
                            return (
                              <tr key={s.id} className="border-b border-border/60 align-middle">
                                <td className="py-2 pr-3 font-semibold">{s.step_name}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min={0}
                                      placeholder="นาที"
                                      value={cellMinutes(s.id, catId)}
                                      onChange={(e) =>
                                        setField(s.id, catId, "mins", e.target.value)
                                      }
                                      className="h-8 w-24"
                                    />
                                  </div>
                                </td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-1">
                                    <Flame className="h-3.5 w-3.5 text-rose-600" />
                                    <Input
                                      type="number"
                                      min={1}
                                      max={50}
                                      placeholder={String(defaultRed)}
                                      value={cellRed(s.id, catId)}
                                      onChange={(e) => setField(s.id, catId, "red", e.target.value)}
                                      className="h-8 w-20"
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                      ครั้ง/วัน
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 pr-1 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      title="บันทึก"
                                      onClick={() => saveCell(s.id, catId)}
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                    </Button>
                                    {existing && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive"
                                        title="ลบ"
                                        onClick={() => deleteCell(existing.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <div className="mt-8 flex justify-center">
        <AppVersion />
      </div>
    </main>
  );
}
