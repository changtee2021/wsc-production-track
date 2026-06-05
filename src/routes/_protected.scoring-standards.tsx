import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { Plus, Trash2, Pencil, Loader2, Timer } from "lucide-react";
import { requireToken, showError } from "@/lib/admin-helpers";
import {
  adminListStandards, adminUpsertStandard, adminDeleteStandard,
} from "@/lib/scoring-admin.functions";
import { adminListCategories, adminListSteps } from "@/lib/admin.functions";

export const Route = createFileRoute("/_protected/scoring-standards")({
  head: () => ({ meta: [{ title: "มาตรฐานคะแนน — WSC ProductionTrack" }] }),
  component: Page,
});

type Std = {
  id: string;
  category_id: string | null;
  step_id: string;
  target_seconds: number;
  fast_seconds: number | null;
  on_time_points: number;
  late_points: number;
  bonus_points: number;
  active: boolean;
  steps?: { step_name: string } | null;
  categories?: { name: string } | null;
};

function secToMS(s: number) {
  const m = Math.floor(s / 60); const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function Page() {
  const list = useServerFn(adminListStandards);
  const upsert = useServerFn(adminUpsertStandard);
  const del = useServerFn(adminDeleteStandard);
  const listCats = useServerFn(adminListCategories);
  const listSteps = useServerFn(adminListSteps);

  const [rows, setRows] = useState<Std[]>([]);
  const [cats, setCats] = useState<Array<{ id: string; name: string }>>([]);
  const [steps, setSteps] = useState<Array<{ id: string; step_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Std | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const [r, c, s] = await Promise.all([
        list({ data: { token } }),
        listCats({ data: { token } }),
        listSteps({ data: { token } }),
      ]);
      setRows(r.rows as Std[]);
      setCats(c.rows);
      setSteps(s.rows);
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  }, [list, listCats, listSteps]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Toaster richColors />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Timer className="h-5 w-5" /> มาตรฐานเวลาและคะแนน</h2>
          <p className="text-sm text-muted-foreground">ตั้งเวลามาตรฐานแต่ละขั้นตอน + คะแนน ทันเวลา/เลท/โบนัส</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่มมาตรฐาน
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>รายการมาตรฐาน ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีมาตรฐาน — เพิ่มได้เลย</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>หมวด</TableHead>
                    <TableHead>ขั้นตอน</TableHead>
                    <TableHead>เวลามาตรฐาน</TableHead>
                    <TableHead>โคตรเร็ว</TableHead>
                    <TableHead>คะแนน (ทัน/เลท/โบนัส)</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.categories?.name ?? <span className="text-muted-foreground">ทุกหมวด</span>}</TableCell>
                      <TableCell className="font-medium">{r.steps?.step_name ?? "?"}</TableCell>
                      <TableCell>{secToMS(r.target_seconds)} น.</TableCell>
                      <TableCell>{r.fast_seconds ? `${secToMS(r.fast_seconds)} น.` : "-"}</TableCell>
                      <TableCell>{r.on_time_points} / {r.late_points} / +{r.bonus_points}</TableCell>
                      <TableCell>
                        {r.active ? <span className="text-emerald-600 text-xs">เปิดใช้</span> : <span className="text-muted-foreground text-xs">ปิด</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={async () => {
                            if (!confirm("ลบมาตรฐานนี้?")) return;
                            try { await del({ data: { token: requireToken(), id: r.id } }); toast.success("ลบแล้ว"); refresh(); }
                            catch (e) { showError(e); }
                          }}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <StandardDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        cats={cats}
        steps={steps}
        onSave={async (payload) => {
          try {
            await upsert({ data: { token: requireToken(), ...payload } });
            toast.success("บันทึกแล้ว");
            setOpen(false);
            refresh();
          } catch (e) { showError(e); }
        }}
      />
    </div>
  );
}

function StandardDialog({
  open, onOpenChange, editing, cats, steps, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Std | null;
  cats: Array<{ id: string; name: string }>;
  steps: Array<{ id: string; step_name: string }>;
  onSave: (p: {
    id?: string; category_id: string | null; step_id: string;
    target_seconds: number; fast_seconds: number | null;
    on_time_points: number; late_points: number; bonus_points: number; active: boolean;
  }) => Promise<void>;
}) {
  const [stepId, setStepId] = useState("");
  const [catId, setCatId] = useState<string>("__all__");
  const [tMin, setTMin] = useState(0); const [tSec, setTSec] = useState(0);
  const [fMin, setFMin] = useState<number | "">(""); const [fSec, setFSec] = useState<number | "">("");
  const [onP, setOnP] = useState(10); const [lateP, setLateP] = useState(2); const [bonusP, setBonusP] = useState(5);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setStepId(editing.step_id);
      setCatId(editing.category_id ?? "__all__");
      setTMin(Math.floor(editing.target_seconds / 60));
      setTSec(editing.target_seconds % 60);
      if (editing.fast_seconds) { setFMin(Math.floor(editing.fast_seconds / 60)); setFSec(editing.fast_seconds % 60); }
      else { setFMin(""); setFSec(""); }
      setOnP(editing.on_time_points); setLateP(editing.late_points); setBonusP(editing.bonus_points);
      setActive(editing.active);
    } else {
      setStepId(""); setCatId("__all__"); setTMin(2); setTSec(0); setFMin(""); setFSec("");
      setOnP(10); setLateP(2); setBonusP(5); setActive(true);
    }
  }, [open, editing]);

  const submit = async () => {
    if (!stepId) { toast.error("เลือกขั้นตอน"); return; }
    const target = tMin * 60 + tSec;
    if (target <= 0) { toast.error("เวลามาตรฐานต้องมากกว่า 0"); return; }
    let fast: number | null = null;
    if (fMin !== "" || fSec !== "") {
      fast = (Number(fMin) || 0) * 60 + (Number(fSec) || 0);
      if (fast <= 0 || fast >= target) { toast.error("เวลาโคตรเร็วต้องน้อยกว่ามาตรฐาน"); return; }
    }
    setSaving(true);
    await onSave({
      id: editing?.id, category_id: catId === "__all__" ? null : catId, step_id: stepId,
      target_seconds: target, fast_seconds: fast,
      on_time_points: onP, late_points: lateP, bonus_points: bonusP, active,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "แก้ไขมาตรฐาน" : "เพิ่มมาตรฐาน"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>ขั้นตอน *</Label>
            <Select value={stepId} onValueChange={setStepId}>
              <SelectTrigger><SelectValue placeholder="เลือกขั้นตอน" /></SelectTrigger>
              <SelectContent>
                {steps.map((s) => <SelectItem key={s.id} value={s.id}>{s.step_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>หมวดสินค้า</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">ทุกหมวด (default)</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>เวลามาตรฐาน *</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} value={tMin} onChange={(e) => setTMin(Number(e.target.value) || 0)} className="w-20" />
              <span>นาที</span>
              <Input type="number" min={0} max={59} value={tSec} onChange={(e) => setTSec(Number(e.target.value) || 0)} className="w-20" />
              <span>วินาที</span>
            </div>
          </div>
          <div>
            <Label>เวลาโคตรเร็ว (Bonus, optional)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} value={fMin} onChange={(e) => setFMin(e.target.value === "" ? "" : Number(e.target.value))} className="w-20" placeholder="-" />
              <span>นาที</span>
              <Input type="number" min={0} max={59} value={fSec} onChange={(e) => setFSec(e.target.value === "" ? "" : Number(e.target.value))} className="w-20" placeholder="-" />
              <span>วินาที</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>ทันเวลา</Label><Input type="number" value={onP} onChange={(e) => setOnP(Number(e.target.value) || 0)} /></div>
            <div><Label>เลท</Label><Input type="number" value={lateP} onChange={(e) => setLateP(Number(e.target.value) || 0)} /></div>
            <div><Label>โบนัส</Label><Input type="number" value={bonusP} onChange={(e) => setBonusP(Number(e.target.value) || 0)} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="active" />
            <Label htmlFor="active">เปิดใช้งาน</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
