// Production standards matrix — per-(step × category) target seconds + red-alert threshold.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListProductionStandards,
  adminUpsertProductionStandard,
  adminDeleteProductionStandard,
} from "@/lib/features/production-monitor.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, Save, Flame, Trash2, Clock } from "lucide-react";
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
  const [edits, setEdits] = useState<
    Record<string, { mins?: string; red?: string }>
  >({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const r = await listFn({ data: { token } });
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

  const keyOf = (step_id: string, category_id: string | null) =>
    `${step_id}|${category_id ?? ""}`;
  const stdMap = new Map<string, Std>(
    stds.map((s) => [keyOf(s.step_id, s.category_id), s]),
  );

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
    return s
      ? String(s.red_threshold ?? defaultRed)
      : String(defaultRed); // prefill with global default
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
    if (!Number.isFinite(mins) || mins <= 0)
      return toast.error("กรอกเวลาเป็นนาที (มากกว่า 0)");
    if (!Number.isFinite(red) || red < 1 || red > 50)
      return toast.error("กรอกจำนวนครั้งไฟแดง 1-50");
    const secs = Math.round(mins * 60);
    try {
      await upsertFn({
        data: {
          token: requireToken(),
          step_id,
          category_id,
          target_seconds: secs,
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <SlidersHorizontal className="h-6 w-6 text-primary" />
        เวลามาตรฐาน &amp; จำนวนครั้งไฟแดง
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ตั้งเวลามาตรฐาน (นาที) และจำนวนครั้งต่อวันที่ถือว่า "ไฟแดง" — แยกตามขั้นตอน × หมวดสินค้า •
        คอลัมน์ "ทุกหมวด" ใช้เป็นค่ากลาง
      </p>

      <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">เวลามาตรฐาน + ไฟแดง</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            กำลังโหลด...
          </div>
        ) : steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีขั้นตอนการผลิต
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">ขั้นตอน</th>
                  <th className="py-2 pr-3">ทุกหมวด (default)</th>
                  {cats.map((c) => (
                    <th key={c.id} className="py-2 pr-3">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/60 align-middle"
                  >
                    <td className="py-2 pr-3 font-semibold">{s.step_name}</td>
                    {[null, ...cats.map((c) => c.id)].map((catId) => {
                      const existing = stdMap.get(keyOf(s.id, catId));
                      return (
                        <td key={catId ?? "null"} className="py-2 pr-3">
                          <div className="space-y-1">
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
                                className="h-8 w-20"
                                title="เวลามาตรฐาน (นาที)"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Flame className="h-3.5 w-3.5 text-rose-600" />
                              <Input
                                type="number"
                                min={1}
                                max={50}
                                placeholder={String(defaultRed)}
                                value={cellRed(s.id, catId)}
                                onChange={(e) =>
                                  setField(s.id, catId, "red", e.target.value)
                                }
                                className="h-8 w-20"
                                title="ไฟแดงเมื่อเกินมาตรฐาน ≥ N ครั้ง/วัน"
                              />
                              <span className="text-[10px] text-muted-foreground">
                                ครั้ง/วัน
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
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
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-8 flex justify-center">
        <AppVersion />
      </div>
    </main>
  );
}
