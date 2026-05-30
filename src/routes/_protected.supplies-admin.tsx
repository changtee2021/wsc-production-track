// Admin CRUD page — สต๊อกอุปกรณ์ออฟฟิศ (B1)
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Trash2, Upload, Loader2, Boxes, Tag, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  officeListAssets, adminUpsertOfficeAsset, adminDeleteOfficeAsset,
  adminListOfficeCategoriesAll, adminUpsertOfficeCategory, adminDeleteOfficeCategory,
  adminOfficeCreateUploadUrl,
} from "@/lib/office-assets.functions";
import { requireToken, showError } from "@/lib/admin-helpers";

export const Route = createFileRoute("/_protected/supplies-admin")({
  head: () => ({ meta: [{ title: "สต๊อกอุปกรณ์ออฟฟิศ — WSC ProductionTrack" }] }),
  component: SuppliesAdminPage,
});

type Category = {
  id: string; name: string;
  default_useful_life_months: number;
  sort_order: number; active: boolean;
};

type Asset = {
  id: string; code: string; name: string;
  category_id: string | null; category_name?: string | null;
  brand: string | null; model: string | null; serial_no: string | null;
  purchase_date: string | null; purchase_price: number | null;
  salvage_value: number | string | null; useful_life_months: number | null;
  warranty_until: string | null; location: string | null; assignee: string | null;
  image_url: string | null; note: string | null; vendor: string | null;
  status: string; active: boolean;
  stock_qty: number; min_qty: number; unit: string;
  depreciation?: {
    monthly_dep: number; accumulated_dep: number; book_value: number;
    months_in_use: number; useful_life_months: number | null;
    fully_depreciated: boolean;
  };
};

function SuppliesAdminPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">สต๊อกอุปกรณ์ออฟฟิศ</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        จัดการสินทรัพย์ออฟฟิศ/โรงงาน พร้อมราคา ค่าเสื่อม และหมวดหมู่
      </p>
      <Tabs defaultValue="assets">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assets"><Boxes className="mr-1 h-4 w-4" />สินทรัพย์</TabsTrigger>
          <TabsTrigger value="cats"><Tag className="mr-1 h-4 w-4" />หมวดหมู่</TabsTrigger>
        </TabsList>
        <TabsContent value="assets" className="mt-3"><AssetsPanel /></TabsContent>
        <TabsContent value="cats" className="mt-3"><CategoriesPanel /></TabsContent>
      </Tabs>
    </main>
  );
}

function AssetsPanel() {
  const list = useServerFn(officeListAssets);
  const listCats = useServerFn(adminListOfficeCategoriesAll);
  const del = useServerFn(adminDeleteOfficeAsset);
  const [rows, setRows] = useState<Asset[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const t = requireToken();
      const [a, c] = await Promise.all([
        list({ data: { token: t, includeInactive: true } }),
        listCats({ data: { token: t } }),
      ]);
      setRows(a.rows as unknown as Asset[]);
      setCats(c.rows as Category[]);
    } catch (e) { showError(e); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />เพิ่มสินทรัพย์
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">— ยังไม่มี —</p>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <Card key={a.id} className={!a.active ? "opacity-60" : ""}>
              <CardContent className="flex items-start gap-3 p-3">
                {a.image_url ? (
                  <img src={a.image_url} alt={a.name} className="h-16 w-16 shrink-0 rounded border object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
                    <Package className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground">{a.code}</span>
                    <span className="font-semibold">{a.name}</span>
                    {!a.active && <Badge variant="outline">ปิดใช้งาน</Badge>}
                    {a.depreciation?.fully_depreciated && (
                      <Badge variant="secondary">หมดอายุค่าเสื่อม</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.category_name ?? "— ไม่ระบุหมวด —"}
                    {a.brand && ` · ${a.brand}`}{a.model && ` ${a.model}`}
                    {a.location && ` · ${a.location}`}
                  </div>
                  {a.purchase_price != null && (
                    <div className="text-xs">
                      ราคา ฿{Number(a.purchase_price).toLocaleString()}
                      {a.depreciation && a.purchase_price ? (
                        <> · มูลค่าคงเหลือ <b>฿{a.depreciation.book_value.toLocaleString()}</b></>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(a); setOpen(true); }}>แก้ไข</Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(`ลบ ${a.name}?`)) return;
                    try { await del({ data: { token: requireToken(), id: a.id } }); toast.success("ลบแล้ว"); refresh(); }
                    catch (e) { showError(e); }
                  }}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && (
        <AssetDialog
          initial={editing}
          categories={cats}
          onClose={() => { setOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}

function AssetDialog({
  initial, categories, onClose,
}: { initial: Asset | null; categories: Category[]; onClose: () => void }) {
  const save = useServerFn(adminUpsertOfficeAsset);
  const createUrl = useServerFn(adminOfficeCreateUploadUrl);
  const [f, setF] = useState<Asset>(() => initial ?? ({
    id: "", code: "", name: "", category_id: categories[0]?.id ?? null,
    brand: null, model: null, serial_no: null,
    purchase_date: null, purchase_price: null,
    salvage_value: 0, useful_life_months: null,
    warranty_until: null, location: null, assignee: null,
    image_url: null, note: null, vendor: null,
    status: "in_use", active: true,
  } as Asset));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const signed = await createUrl({ data: { token: requireToken(), ext } });
      const { error } = await supabase.storage.from("office-assets")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setF((x) => ({ ...x, image_url: signed.publicUrl }));
    } catch (e) { showError(e); } finally { setUploading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "แก้ไขสินทรัพย์" : "เพิ่มสินทรัพย์"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <Label>รูปภาพ</Label>
            <div className="flex items-center gap-3">
              {f.image_url ? (
                <img src={f.image_url} alt="" className="h-20 w-20 rounded border object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded border bg-muted text-muted-foreground">
                  <Package className="h-7 w-7" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); }} />
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                  อัปโหลด
                </Button>
                {f.image_url && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, image_url: null })}>ลบรูป</Button>
                )}
              </div>
            </div>
          </div>
          <div><Label>ชื่อ *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>หมวด</Label>
              <Select
                value={f.category_id ?? "__none__"}
                onValueChange={(v) => setF({ ...f, category_id: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {categories.filter((c) => c.active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_use">ใช้งานอยู่</SelectItem>
                  <SelectItem value="repair">ซ่อม</SelectItem>
                  <SelectItem value="retired">ปลดระวาง</SelectItem>
                  <SelectItem value="lost">สูญหาย</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>ยี่ห้อ</Label>
              <Input value={f.brand ?? ""} onChange={(e) => setF({ ...f, brand: e.target.value || null })} />
            </div>
            <div><Label>รุ่น</Label>
              <Input value={f.model ?? ""} onChange={(e) => setF({ ...f, model: e.target.value || null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Serial No.</Label>
              <Input value={f.serial_no ?? ""} onChange={(e) => setF({ ...f, serial_no: e.target.value || null })} />
            </div>
            <div><Label>สถานที่/ผู้ครอบครอง</Label>
              <Input value={f.location ?? ""} onChange={(e) => setF({ ...f, location: e.target.value || null })} />
            </div>
          </div>
          <div><Label>ผู้รับผิดชอบ</Label>
            <Input value={f.assignee ?? ""} onChange={(e) => setF({ ...f, assignee: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>วันที่ซื้อ</Label>
              <Input type="date" value={f.purchase_date ?? ""} onChange={(e) => setF({ ...f, purchase_date: e.target.value || null })} />
            </div>
            <div><Label>ราคา (฿)</Label>
              <Input type="number" min="0" step="0.01" value={f.purchase_price ?? ""} onChange={(e) => setF({ ...f, purchase_price: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>มูลค่าซาก (฿)</Label>
              <Input type="number" min="0" step="0.01" value={String(f.salvage_value ?? 0)} onChange={(e) => setF({ ...f, salvage_value: Number(e.target.value) || 0 })} />
            </div>
            <div><Label>อายุการใช้งาน (เดือน)</Label>
              <Input type="number" min="1" placeholder="ตามหมวด" value={f.useful_life_months ?? ""} onChange={(e) => setF({ ...f, useful_life_months: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>ผู้ขาย</Label>
              <Input value={f.vendor ?? ""} onChange={(e) => setF({ ...f, vendor: e.target.value || null })} />
            </div>
            <div><Label>ประกันถึง</Label>
              <Input type="date" value={f.warranty_until ?? ""} onChange={(e) => setF({ ...f, warranty_until: e.target.value || null })} />
            </div>
          </div>
          <div><Label>หมายเหตุ</Label>
            <Textarea rows={2} value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value || null })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            เปิดใช้งาน
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!f.name} onClick={async () => {
            try {
              await save({
                data: {
                  token: requireToken(),
                  asset: {
                    id: f.id || undefined,
                    name: f.name,
                    category_id: f.category_id,
                    brand: f.brand,
                    model: f.model,
                    serial_no: f.serial_no,
                    purchase_date: f.purchase_date,
                    purchase_price: f.purchase_price,
                    salvage_value: Number(f.salvage_value ?? 0),
                    useful_life_months: f.useful_life_months,
                    warranty_until: f.warranty_until,
                    location: f.location,
                    assignee: f.assignee,
                    image_url: f.image_url,
                    note: f.note,
                    vendor: f.vendor,
                    status: f.status as "in_use" | "repair" | "retired" | "lost",
                    active: f.active,
                  },
                },
              });
              toast.success("บันทึกแล้ว");
              onClose();
            } catch (e) { showError(e); }
          }}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesPanel() {
  const list = useServerFn(adminListOfficeCategoriesAll);
  const save = useServerFn(adminUpsertOfficeCategory);
  const del = useServerFn(adminDeleteOfficeCategory);
  const [rows, setRows] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const r = await list({ data: { token: requireToken() } });
      setRows(r.rows as Category[]);
    } catch (e) { showError(e); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />เพิ่มหมวด</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">— ยังไม่มี —</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Card key={c.id} className={!c.active ? "opacity-60" : ""}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    อายุใช้งานเริ่มต้น: {c.default_useful_life_months} เดือน · ลำดับ {c.sort_order}
                    {!c.active && " · ปิด"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}>แก้ไข</Button>
                <Button size="icon" variant="ghost" onClick={async () => {
                  if (!confirm(`ลบหมวด ${c.name}? (สินทรัพย์ในหมวดนี้จะกลายเป็น 'ไม่ระบุหมวด')`)) return;
                  try { await del({ data: { token: requireToken(), id: c.id } }); toast.success("ลบแล้ว"); refresh(); }
                  catch (e) { showError(e); }
                }}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && (
        <CategoryDialog initial={editing} onClose={() => { setOpen(false); refresh(); }} onSave={save} />
      )}
    </div>
  );
}

function CategoryDialog({
  initial, onClose, onSave,
}: {
  initial: Category | null;
  onClose: () => void;
  onSave: ReturnType<typeof useServerFn<typeof adminUpsertOfficeCategory>>;
}) {
  const [f, setF] = useState<Category>(() => initial ?? ({
    id: "", name: "", default_useful_life_months: 36, sort_order: 0, active: true,
  } as Category));
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{initial ? "แก้ไขหมวด" : "เพิ่มหมวด"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div><Label>ชื่อหมวด *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>อายุใช้งาน (เดือน)</Label>
              <Input type="number" min="1" value={f.default_useful_life_months} onChange={(e) => setF({ ...f, default_useful_life_months: Number(e.target.value) || 36 })} />
            </div>
            <div><Label>ลำดับ</Label>
              <Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            เปิดใช้งาน
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!f.name} onClick={async () => {
            try {
              await onSave({ data: { token: requireToken(), category: {
                id: f.id || undefined,
                name: f.name,
                default_useful_life_months: f.default_useful_life_months,
                sort_order: f.sort_order,
                active: f.active,
              } } });
              toast.success("บันทึกแล้ว");
              onClose();
            } catch (e) { showError(e); }
          }}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
