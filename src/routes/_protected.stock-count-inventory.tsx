// Admin: จัดการคลังสินค้า (inventory_items) สำหรับระบบนับสต๊อก
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListInventory, adminUpsertInventory, adminDeleteInventory,
} from "@/lib/features/stock-count.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Search, Boxes } from "lucide-react";

export const Route = createFileRoute("/_protected/stock-count-inventory")({
  head: () => ({ meta: [{ title: "คลังสินค้า (นับสต๊อก) — Admin" }] }),
  component: StockInventoryAdminPage,
});

type Item = {
  id: string;
  item_code: string;
  item_name: string;
  unit: string;
  total_qty: number;
  min_safety_stock: number;
  max_stock_level: number;
  category: string | null;
  location: string | null;
  note: string | null;
  active: boolean;
};

type FormState = {
  id?: string;
  item_code: string; item_name: string; unit: string;
  total_qty: string; min_safety_stock: string; max_stock_level: string;
  category: string; location: string; note: string; active: boolean;
};

const emptyForm = (): FormState => ({
  item_code: "", item_name: "", unit: "ชิ้น",
  total_qty: "0", min_safety_stock: "0", max_stock_level: "0",
  category: "", location: "", note: "", active: true,
});

function StockInventoryAdminPage() {
  const listFn = useServerFn(adminListInventory);
  const upsertFn = useServerFn(adminUpsertInventory);
  const delFn = useServerFn(adminDeleteInventory);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const rows = await listFn({ data: { adminToken: token, search: search.trim() || undefined } });
      setItems(rows as Item[]);
    } catch (e) { showError(e, "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [listFn, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm()); setOpen(true); };
  const openEdit = (it: Item) => {
    setForm({
      id: it.id, item_code: it.item_code, item_name: it.item_name, unit: it.unit,
      total_qty: String(it.total_qty), min_safety_stock: String(it.min_safety_stock),
      max_stock_level: String(it.max_stock_level), category: it.category ?? "",
      location: it.location ?? "", note: it.note ?? "", active: it.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.item_code.trim() || !form.item_name.trim()) { toast.error("กรอกรหัสและชื่อสินค้า"); return; }
    setSaving(true);
    try {
      const token = requireToken();
      await upsertFn({ data: {
        adminToken: token, id: form.id,
        item_code: form.item_code.trim(), item_name: form.item_name.trim(),
        unit: form.unit.trim() || "ชิ้น",
        total_qty: Number(form.total_qty) || 0,
        min_safety_stock: Number(form.min_safety_stock) || 0,
        max_stock_level: Number(form.max_stock_level) || 0,
        category: form.category.trim() || null,
        location: form.location.trim() || null,
        note: form.note.trim() || null,
        active: form.active,
      }});
      toast.success("บันทึกแล้ว"); setOpen(false); await load();
    } catch (e) { showError(e, "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  };

  const remove = async (it: Item) => {
    if (!confirm(`ลบรายการ ${it.item_code}?`)) return;
    try {
      const token = requireToken();
      await delFn({ data: { adminToken: token, id: it.id } });
      toast.success("ลบแล้ว"); await load();
    } catch (e) { showError(e, "ลบไม่สำเร็จ"); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <Toaster richColors position="top-center" />
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">คลังสินค้า (นับสต๊อก)</h1>
        </div>
        <Button onClick={openCreate}><Plus className="size-4 mr-1" /> เพิ่มสินค้า</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="ค้นหารหัส/ชื่อ" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()} className="pl-8" />
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "ค้นหา"}
        </Button>
      </div>

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>
              <th className="text-left p-2">รหัส</th>
              <th className="text-left p-2">ชื่อ</th>
              <th className="text-left p-2">หน่วย</th>
              <th className="text-right p-2">คงเหลือ</th>
              <th className="text-right p-2">Min</th>
              <th className="text-left p-2">ที่เก็บ</th>
              <th className="text-left p-2">สถานะ</th>
              <th className="text-right p-2">จัดการ</th>
            </tr></thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center p-6 text-muted-foreground">ยังไม่มีสินค้า</td></tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono">{it.item_code}</td>
                  <td className="p-2">{it.item_name}</td>
                  <td className="p-2">{it.unit}</td>
                  <td className="p-2 text-right">{it.total_qty}</td>
                  <td className="p-2 text-right">{it.min_safety_stock}</td>
                  <td className="p-2">{it.location ?? "-"}</td>
                  <td className="p-2">{it.active ? <Badge variant="secondary">ใช้งาน</Badge> : <Badge variant="outline">ปิด</Badge>}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(it)}><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(it)}><Trash2 className="size-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>รหัส / Barcode *</Label><Input value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} /></div>
            <div><Label>หน่วย</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="col-span-2"><Label>ชื่อสินค้า *</Label><Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} /></div>
            <div><Label>คงเหลือในระบบ</Label><Input type="number" value={form.total_qty} onChange={(e) => setForm({ ...form, total_qty: e.target.value })} /></div>
            <div><Label>Min</Label><Input type="number" value={form.min_safety_stock} onChange={(e) => setForm({ ...form, min_safety_stock: e.target.value })} /></div>
            <div><Label>Max</Label><Input type="number" value={form.max_stock_level} onChange={(e) => setForm({ ...form, max_stock_level: e.target.value })} /></div>
            <div><Label>หมวด</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="col-span-2"><Label>ที่เก็บ</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="col-span-2"><Label>หมายเหตุ</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              เปิดใช้งาน
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
