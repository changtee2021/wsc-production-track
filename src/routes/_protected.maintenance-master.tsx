import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Boxes, Package2, Plus, Trash2, Upload, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  listAssets,
  upsertAsset,
  deleteAsset,
  listSpareParts,
  upsertSparePart,
  deleteSparePart,
  restockPart,
} from "@/lib/features/maintenance.functions";
import { adminCreateUploadUrl } from "@/lib/features/admin.functions";
import { adminUpload, requireToken, showError } from "@/lib/utils/admin-helpers";

export const Route = createFileRoute("/_protected/maintenance-master")({
  head: () => ({ meta: [{ title: "ทรัพย์สิน & อะไหล่ — WSC ProductionTrack" }] }),
  component: MasterPage,
});

type Asset = {
  id: string;
  code: string | null;
  name: string;
  category: string;
  location: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  vendor: string | null;
  warranty_until: string | null;
  note: string | null;
  image_url: string | null;
  active: boolean;
};

type Part = {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  stock_qty: number;
  min_qty: number;
  location_bin: string | null;
  unit_cost: number | null;
  image_url: string | null;
  note: string | null;
  active: boolean;
};

function MasterPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">ทรัพย์สิน &amp; อะไหล่</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        เพิ่ม/แก้ไขรายการทรัพย์สิน เครื่องจักร และสต๊อกอะไหล่ พร้อมแนบรูปประกอบ
      </p>
      <Tabs defaultValue="assets">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assets">
            <Boxes className="mr-1 h-4 w-4" />
            ทรัพย์สิน
          </TabsTrigger>
          <TabsTrigger value="parts">
            <Package2 className="mr-1 h-4 w-4" />
            อะไหล่
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assets" className="mt-3">
          <AssetsPanel />
        </TabsContent>
        <TabsContent value="parts" className="mt-3">
          <PartsPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function AssetsPanel() {
  const list = useServerFn(listAssets);
  const del = useServerFn(deleteAsset);
  const [rows, setRows] = useState<Asset[]>([]);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const r = await list({ data: { token: requireToken() } });
      setRows(r.rows as Asset[]);
    } catch (e) {
      showError(e);
    }
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          เพิ่มทรัพย์สิน
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">— ยังไม่มี —</p>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start gap-3 p-3">
                {a.image_url ? (
                  <img
                    src={a.image_url}
                    alt={a.name}
                    className="h-16 w-16 shrink-0 rounded border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
                    <Boxes className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {a.code && (
                      <span className="mr-1 font-mono text-xs text-muted-foreground">
                        [{a.code}]
                      </span>
                    )}
                    {a.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.category}
                    {a.location && ` · ${a.location}`}
                    {a.brand && ` · ${a.brand}`} {a.model}
                  </div>
                  {(a.purchase_date || a.warranty_until) && (
                    <div className="text-xs text-muted-foreground">
                      {a.purchase_date && `ซื้อ ${a.purchase_date}`}{" "}
                      {a.warranty_until && `· ประกัน ${a.warranty_until}`}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(a);
                      setOpen(true);
                    }}
                  >
                    แก้ไข
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`ลบ ${a.name}?`)) return;
                      try {
                        await del({ data: { token: requireToken(), id: a.id } });
                        toast.success("ลบแล้ว");
                        refresh();
                      } catch (e) {
                        showError(e);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && (
        <AssetDialog
          initial={editing}
          onClose={() => {
            setOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AssetDialog({ initial, onClose }: { initial: Asset | null; onClose: () => void }) {
  const save = useServerFn(upsertAsset);
  const createUrl = useServerFn(adminCreateUploadUrl);
  const [f, setF] = useState<Asset>(
    () =>
      initial ??
      ({
        id: "",
        code: null,
        name: "",
        category: "machine",
        location: null,
        brand: null,
        model: null,
        serial_no: null,
        purchase_date: null,
        purchase_price: null,
        vendor: null,
        warranty_until: null,
        note: null,
        image_url: null,
        active: true,
      } as Asset),
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const { publicUrl } = await adminUpload("step-images", file, createUrl);
      setF((x) => ({ ...x, image_url: publicUrl }));
    } catch (e) {
      showError(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "แก้ไขทรัพย์สิน" : "เพิ่มทรัพย์สิน"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <Label>รูปภาพ</Label>
            <div className="flex items-center gap-3">
              {f.image_url ? (
                <img src={f.image_url} alt="" className="h-20 w-20 rounded border object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded border bg-muted text-muted-foreground">
                  <Boxes className="h-7 w-7" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="mr-1 h-3 w-3" />
                  )}
                  อัปโหลด
                </Button>
                {f.image_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setF({ ...f, image_url: null })}
                  >
                    ลบรูป
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>รหัส</Label>
              <Input
                value={f.code ?? ""}
                onChange={(e) => setF({ ...f, code: e.target.value || null })}
              />
            </div>
            <div>
              <Label>หมวด</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="machine">เครื่องจักร</SelectItem>
                  <SelectItem value="equipment">อุปกรณ์</SelectItem>
                  <SelectItem value="tool">เครื่องมือ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>ชื่อ *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>ยี่ห้อ</Label>
              <Input
                value={f.brand ?? ""}
                onChange={(e) => setF({ ...f, brand: e.target.value || null })}
              />
            </div>
            <div>
              <Label>รุ่น</Label>
              <Input
                value={f.model ?? ""}
                onChange={(e) => setF({ ...f, model: e.target.value || null })}
              />
            </div>
          </div>
          <div>
            <Label>Serial No.</Label>
            <Input
              value={f.serial_no ?? ""}
              onChange={(e) => setF({ ...f, serial_no: e.target.value || null })}
            />
          </div>
          <div>
            <Label>สถานที่</Label>
            <Input
              value={f.location ?? ""}
              onChange={(e) => setF({ ...f, location: e.target.value || null })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>วันที่ซื้อ</Label>
              <Input
                type="date"
                value={f.purchase_date ?? ""}
                onChange={(e) => setF({ ...f, purchase_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label>ราคา</Label>
              <Input
                type="number"
                value={f.purchase_price ?? ""}
                onChange={(e) =>
                  setF({ ...f, purchase_price: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
          </div>
          <div>
            <Label>ผู้ขาย/ที่ซื้อ</Label>
            <Input
              value={f.vendor ?? ""}
              onChange={(e) => setF({ ...f, vendor: e.target.value || null })}
            />
          </div>
          <div>
            <Label>ประกันถึง</Label>
            <Input
              type="date"
              value={f.warranty_until ?? ""}
              onChange={(e) => setF({ ...f, warranty_until: e.target.value || null })}
            />
          </div>
          <div>
            <Label>หมายเหตุ</Label>
            <Textarea
              rows={2}
              value={f.note ?? ""}
              onChange={(e) => setF({ ...f, note: e.target.value || null })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={!f.name}
            onClick={async () => {
              try {
                await save({
                  data: {
                    token: requireToken(),
                    asset: { ...f, id: f.id || undefined } as Asset & { id?: string },
                  },
                });
                toast.success("บันทึกแล้ว");
                onClose();
              } catch (e) {
                showError(e);
              }
            }}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PartsPanel() {
  const list = useServerFn(listSpareParts);
  const del = useServerFn(deleteSparePart);
  const restock = useServerFn(restockPart);
  const [rows, setRows] = useState<Part[]>([]);
  const [editing, setEditing] = useState<Part | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const r = await list({ data: { token: requireToken() } });
      setRows(r.rows as Part[]);
    } catch (e) {
      showError(e);
    }
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          เพิ่มอะไหล่
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">— ยังไม่มี —</p>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const low = p.stock_qty <= p.min_qty;
            return (
              <Card key={p.id}>
                <CardContent className="flex items-start gap-3 p-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-16 w-16 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
                      <Package2 className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      {p.code && (
                        <span className="font-mono text-xs text-muted-foreground">[{p.code}]</span>
                      )}
                      {p.name}
                      {low && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          ใกล้หมด
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      คงเหลือ <b>{p.stock_qty}</b> {p.unit} (ขั้นต่ำ {p.min_qty}){" "}
                      {p.location_bin && `· ${p.location_bin}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const v = prompt(`เติมสต๊อก ${p.name} (จำนวน)`, "1");
                        if (!v) return;
                        const n = Number(v);
                        if (!Number.isFinite(n) || n <= 0) return;
                        try {
                          await restock({
                            data: {
                              token: requireToken(),
                              spare_part_id: p.id,
                              delta: n,
                              reason: "restock",
                            },
                          });
                          toast.success("เติมแล้ว");
                          refresh();
                        } catch (e) {
                          showError(e);
                        }
                      }}
                    >
                      +เติม
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`ลบ ${p.name}?`)) return;
                        try {
                          await del({ data: { token: requireToken(), id: p.id } });
                          toast.success("ลบแล้ว");
                          refresh();
                        } catch (e) {
                          showError(e);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {open && (
        <PartDialog
          initial={editing}
          onClose={() => {
            setOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function PartDialog({ initial, onClose }: { initial: Part | null; onClose: () => void }) {
  const save = useServerFn(upsertSparePart);
  const createUrl = useServerFn(adminCreateUploadUrl);
  const [f, setF] = useState<Part>(
    () =>
      initial ??
      ({
        id: "",
        code: null,
        name: "",
        unit: "ชิ้น",
        stock_qty: 0,
        min_qty: 0,
        location_bin: null,
        unit_cost: null,
        image_url: null,
        note: null,
        active: true,
      } as Part),
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const { publicUrl } = await adminUpload("step-images", file, createUrl);
      setF((x) => ({ ...x, image_url: publicUrl }));
    } catch (e) {
      showError(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "แก้ไขอะไหล่" : "เพิ่มอะไหล่"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <Label>รูปภาพ</Label>
            <div className="flex items-center gap-3">
              {f.image_url ? (
                <img src={f.image_url} alt="" className="h-20 w-20 rounded border object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded border bg-muted text-muted-foreground">
                  <Package2 className="h-7 w-7" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="mr-1 h-3 w-3" />
                  )}
                  อัปโหลด
                </Button>
                {f.image_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setF({ ...f, image_url: null })}
                  >
                    ลบรูป
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>รหัส</Label>
              <Input
                value={f.code ?? ""}
                onChange={(e) => setF({ ...f, code: e.target.value || null })}
              />
            </div>
            <div>
              <Label>หน่วย</Label>
              <Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>ชื่ออะไหล่ *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>สต๊อก</Label>
              <Input
                type="number"
                value={f.stock_qty}
                onChange={(e) => setF({ ...f, stock_qty: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>ขั้นต่ำ</Label>
              <Input
                type="number"
                value={f.min_qty}
                onChange={(e) => setF({ ...f, min_qty: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>ที่เก็บ</Label>
              <Input
                value={f.location_bin ?? ""}
                onChange={(e) => setF({ ...f, location_bin: e.target.value || null })}
              />
            </div>
            <div>
              <Label>ราคา/หน่วย</Label>
              <Input
                type="number"
                value={f.unit_cost ?? ""}
                onChange={(e) =>
                  setF({ ...f, unit_cost: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
          </div>
          <div>
            <Label>หมายเหตุ</Label>
            <Textarea
              rows={2}
              value={f.note ?? ""}
              onChange={(e) => setF({ ...f, note: e.target.value || null })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={!f.name}
            onClick={async () => {
              try {
                await save({
                  data: {
                    token: requireToken(),
                    part: { ...f, id: f.id || undefined } as Part & { id?: string },
                  },
                });
                toast.success("บันทึกแล้ว");
                onClose();
              } catch (e) {
                showError(e);
              }
            }}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
