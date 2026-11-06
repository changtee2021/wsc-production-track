// Production standards — per-(step × category) target seconds + red-alert threshold.
// Tabs by category for focused editing; matrix-by-step inside each tab.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListProductionStandards,
  adminUpsertProductionStandard,
  adminDeleteProductionStandard,
} from "@/lib/features/production-monitor.functions";
import { stepsForCategory } from "@/lib/production-flow-steps";
import { flowForProductName, TRIAL_FLOWS } from "@/lib/scan-trial";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Flame, Trash2, Clock, Search } from "lucide-react";
import { toast } from "sonner";

type Std = {
  id: string;
  step_id: string;
  category_id: string | null;
  target_seconds: number;
  fast_seconds: number | null;
  red_threshold: number | null;
  active: boolean;
};
type Cat = { id: string; name: string };
type Step = { id: string; step_name: string };

export function ProductionStandardsPanel() {
  const listFn = useServerFn(adminListProductionStandards);
  const upsertFn = useServerFn(adminUpsertProductionStandard);
  const delFn = useServerFn(adminDeleteProductionStandard);

  const [stds, setStds] = useState<Std[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [defaultRed, setDefaultRed] = useState(3);
  const [edits, setEdits] = useState<Record<string, { over?: string; red?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("");
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

  const tabsList = useMemo(() => {
    const rank = (name: string) => {
      const flow = flowForProductName(name);
      const index = TRIAL_FLOWS.findIndex((row) => row.id === flow?.id);
      return index < 0 ? TRIAL_FLOWS.length : index;
    };
    return [...cats].sort((a, b) => rank(a.name) - rank(b.name));
  }, [cats]);
  const categoryHeading = (name: string, index: number) => {
    const flow = flowForProductName(name);
    const thai =
      flow?.label ??
      name
        .replace(/^\d+\.\s*/, "")
        .replace(/[^\u0E00-\u0E7F0-9.\s/()-]/g, "")
        .trim();
    return `${index + 1}. ${thai}`;
  };
  useEffect(() => {
    if (tabsList.length === 0) return;
    if (!tabsList.some((c) => c.id === tab)) setTab(tabsList[0].id);
  }, [tabsList, tab]);

  const minutesOf = (seconds: number | null | undefined) =>
    seconds != null ? String(Math.round((seconds / 60) * 100) / 100) : "";
  const cellOver = (step_id: string, category_id: string | null) => {
    const k = keyOf(step_id, category_id);
    const e = edits[k]?.over;
    if (e != null) return e;
    return minutesOf(stdMap.get(k)?.target_seconds);
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
    field: "over" | "red",
    val: string,
  ) => {
    const k = keyOf(step_id, category_id);
    setEdits((p) => ({ ...p, [k]: { ...(p[k] ?? {}), [field]: val } }));
  };

  const saveCell = async (step_id: string, category_id: string | null) => {
    const over = Number(cellOver(step_id, category_id));
    const red = parseInt(cellRed(step_id, category_id), 10);
    if (!Number.isFinite(over) || over <= 0) return toast.error("กรอกเกินเวลาเป็นนาที (>0)");
    if (!Number.isFinite(red) || red < 1 || red > 50)
      return toast.error("กรอกจำนวนครั้งไฟแดง 1-50");
    const overSeconds = Math.round(over * 60);
    const storedNormal = stdMap.get(keyOf(step_id, category_id))?.fast_seconds ?? null;
    try {
      await upsertFn({
        data: {
          token: requireToken(),
          step_id,
          category_id,
          normal_seconds: storedNormal != null ? Math.min(storedNormal, overSeconds) : null,
          target_seconds: overSeconds,
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

  const q = query.trim().toLowerCase();
  const stepsForTab = (categoryName: string) => {
    const scoped = stepsForCategory(categoryName, steps);
    return {
      total: scoped.length,
      rows: scoped.filter((s) => !q || s.step_name.toLowerCase().includes(q)),
    };
  };

  return (
    <div className="p-4">
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาชื่อขั้นตอน"
                className="h-9 pl-8"
              />
            </div>
            <TabsList className="h-auto flex-1 justify-start">
              {tabsList.map((c, index) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {categoryHeading(c.name, index)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabsList.map((c, index) => {
            const tabSteps = stepsForTab(c.name);
            const filteredSteps = tabSteps.rows;
            return (
              <TabsContent key={c.id} value={c.id} className="mt-3">
                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{categoryHeading(c.name, index)}</h2>
                      <p className="text-xs text-muted-foreground">
                        {tabSteps.total} ขั้นตอนในโฟลว์หมวดนี้
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => saveDirty(c.id)}
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
                            <th className="py-2 pr-3">เกินเวลา (นาที)</th>
                            <th className="py-2 pr-3">ไฟแดง (ครั้ง/วัน)</th>
                            <th className="py-2 pr-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSteps.map((s) => {
                            const existing = stdMap.get(keyOf(s.id, c.id));
                            return (
                              <tr key={s.id} className="border-b border-border/60 align-middle">
                                <td className="py-2 pr-3 font-semibold">{s.step_name}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-rose-600" />
                                    <Input
                                      type="number"
                                      step="1"
                                      min={1}
                                      placeholder="นาที"
                                      value={cellOver(s.id, c.id)}
                                      onChange={(e) => setField(s.id, c.id, "over", e.target.value)}
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
                                      value={cellRed(s.id, c.id)}
                                      onChange={(e) => setField(s.id, c.id, "red", e.target.value)}
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
                                      onClick={() => saveCell(s.id, c.id)}
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
    </div>
  );
}
