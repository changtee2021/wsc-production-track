// Production standards matrix + red-alert threshold setting.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListProductionStandards,
  adminUpsertProductionStandard,
  adminDeleteProductionStandard,
  adminGetRedThreshold,
  adminSetRedThreshold,
} from "@/lib/features/production-monitor.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, Save, Flame, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AppVersion } from "@/components/AppVersion";

export const Route = createFileRoute("/_protected/production-standards")({
  head: () => ({ meta: [{ title: "เวลามาตรฐาน — WSC ProductionTrack" }] }),
  component: StandardsPage,
});

type Std = { id: string; step_id: string; category_id: string | null; target_seconds: number; active: boolean };
type Cat = { id: string; name: string };
type Step = { id: string; step_name: string };

function StandardsPage() {
  const listFn = useServerFn(adminListProductionStandards);
  const upsertFn = useServerFn(adminUpsertProductionStandard);
  const delFn = useServerFn(adminDeleteProductionStandard);
  const getThr = useServerFn(adminGetRedThreshold);
  const setThr = useServerFn(adminSetRedThreshold);

  const [stds, setStds] = useState<Std[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [thrInput, setThrInput] = useState("3");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const [r, t] = await Promise.all([listFn({ data: { token } }), getThr({ data: { token } })]);
      setStds(r.standards as Std[]); setCats(r.categories as Cat[]); setSteps(r.steps as Step[]);
      setThreshold(t.count); setThrInput(String(t.count));
    } catch (err) { showError(err); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const keyOf = (step_id: string, category_id: string | null) => `${step_id}|${category_id ?? ""}`;
  const stdMap = new Map<string, Std>(stds.map((s) => [keyOf(s.step_id, s.category_id), s]));

  const saveCell = async (step_id: string, category_id: string | null) => {
    const k = keyOf(step_id, category_id);
    const raw = edits[k];
    if (raw == null) return;
    const secs = Math.round(Number(raw) * 60);
    if (!Number.isFinite(secs) || secs <= 0) return toast.error("กรุณากรอกเวลาเป็นนาที");
    try {
      await upsertFn({ data: { token: requireToken(), step_id, category_id, target_seconds: secs } });
      toast.success("บันทึกแล้ว");
      setEdits((e) => { const c = { ...e }; delete c[k]; return c; });
      await load();
    } catch (err) { showError(err); }
  };

  const deleteCell = async (id: string) => {
    if (!confirm("ลบมาตรฐานนี้?")) return;
    try {
      await delFn({ data: { token: requireToken(), id } });
      toast.success("ลบแล้ว"); await load();
    } catch (err) { showError(err); }
  };

  const saveThreshold = async () => {
    const n = parseInt(thrInput, 10);
    if (!Number.isFinite(n) || n < 1 || n > 50) return toast.error("จำนวนต้องอยู่ระหว่าง 1-50");
    try {
      await setThr({ data: { token: requireToken(), count: n } });
      toast.success("บันทึกค่าตั้งต้นแล้ว"); setThreshold(n);
    } catch (err) { showError(err); }
  };

  const cellMinutes = (step_id: string, category_id: string | null) => {
    const k = keyOf(step_id, category_id);
    if (edits[k] != null) return edits[k];
    const s = stdMap.get(k);
    return s ? String(Math.round((s.target_seconds / 60) * 100) / 100) : "";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <SlidersHorizontal className="h-6 w-6 text-primary" /> เวลามาตรฐาน & ตั้งค่าไฟแดง
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ตั้งเวลามาตรฐาน (นาที) ของแต่ละขั้นตอนตามหมวดหมู่สินค้า — ใช้คอลัมน์ "ทุกหมวด" เป็นค่ากลาง
      </p>

      <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-rose-600"><Flame className="h-5 w-5" /><span className="font-semibold">ไฟแดงเมื่อเกินมาตรฐานวันละ</span></div>
          <Input type="number" min={1} max={50} value={thrInput} onChange={(e) => setThrInput(e.target.value)} className="h-9 w-24" />
          <span className="text-sm text-muted-foreground">ครั้งขึ้นไป</span>
          <Button size="sm" onClick={saveThreshold} className="gap-1"><Save className="h-4 w-4" /> บันทึก</Button>
          <span className="ml-auto text-xs text-muted-foreground">ปัจจุบัน: <b>{threshold}</b> ครั้ง</span>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">เวลามาตรฐาน (นาที)</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">ยังไม่มีขั้นตอนการผลิต</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">ขั้นตอน</th>
                  <th className="py-2 pr-3">ทุกหมวด (default)</th>
                  {cats.map((c) => (<th key={c.id} className="py-2 pr-3">{c.name}</th>))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 align-middle">
                    <td className="py-2 pr-3 font-semibold">{s.step_name}</td>
                    {[null, ...cats.map((c) => c.id)].map((catId) => {
                      const existing = stdMap.get(keyOf(s.id, catId));
                      return (
                        <td key={catId ?? "null"} className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              placeholder="—"
                              value={cellMinutes(s.id, catId)}
                              onChange={(e) => setEdits((p) => ({ ...p, [keyOf(s.id, catId)]: e.target.value }))}
                              className="h-8 w-20"
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="บันทึก" onClick={() => saveCell(s.id, catId)}>
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                            {existing && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="ลบ" onClick={() => deleteCell(existing.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
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

      <div className="mt-8 flex justify-center"><AppVersion /></div>
    </main>
  );
}
