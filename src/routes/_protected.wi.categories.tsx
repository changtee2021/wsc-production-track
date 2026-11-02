import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import {
  wiCategoriesList,
  wiCategoryDelete,
  wiCategorySetActive,
  wiCategoryUpsert,
} from "@/lib/features/wi.functions";
import { WI_ACCENT_BTN, requireWiActor } from "@/lib/wi/wi-client";

export const Route = createFileRoute("/_protected/wi/categories")({
  component: WiCategoriesPage,
});

type Row = Awaited<ReturnType<typeof wiCategoriesList>>["rows"][number];
type Form = { id?: string; name: string; description: string; sort_order: string };

function WiCategoriesPage() {
  const listFn = useServerFn(wiCategoriesList);
  const upsertFn = useServerFn(wiCategoryUpsert);
  const activeFn = useServerFn(wiCategorySetActive);
  const deleteFn = useServerFn(wiCategoryDelete);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"order" | "name" | "count">("order");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listFn({ data: { token: requireToken() } });
      setRows(res.rows);
    } catch (err) {
      showError(err);
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    }
  }, [listFn]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (rows ?? []).filter(
      (r) =>
        (showArchived || r.is_active) &&
        (!needle ||
          r.name.toLowerCase().includes(needle) ||
          (r.description ?? "").toLowerCase().includes(needle)),
    );
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "th")
        : sort === "count"
          ? b.wi_count - a.wi_count
          : a.sort_order - b.sort_order || a.name.localeCompare(b.name, "th"),
    );
  }, [rows, q, sort, showArchived]);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      setFormError("กรอกชื่อหมวด");
      return;
    }
    const order = form.sort_order.trim() === "" ? 0 : Number(form.sort_order);
    if (!Number.isInteger(order) || order < 0) {
      setFormError("ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 0");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          token: requireToken(),
          actor: requireWiActor(),
          id: form.id,
          name: form.name,
          description: form.description,
          sort_order: order,
        },
      });
      toast.success("บันทึกหมวดแล้ว");
      setForm(null);
      load();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setFormError(err.message);
      else showError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: Row) => {
    try {
      await activeFn({
        data: { token: requireToken(), actor: requireWiActor(), id: r.id, is_active: !r.is_active },
      });
      toast.success(r.is_active ? "เก็บถาวรหมวดแล้ว" : "เปิดใช้หมวดแล้ว");
      load();
    } catch (err) {
      showError(err);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteFn({ data: { token: requireToken(), id: toDelete.id } });
      toast.success("ลบหมวดแล้ว");
      setToDelete(null);
      load();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 pb-12 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">หมวดหมู่ WI</h1>
          <p className="text-sm text-muted-foreground">
            จัดกลุ่มคู่มือตามแผนกหรือประเภทงาน (แยกจากหมวดสินค้าของการผลิต)
          </p>
        </div>
        <Button
          className={cn("h-11 gap-1", WI_ACCENT_BTN)}
          onClick={() => {
            setFormError("");
            setForm({ name: "", description: "", sort_order: "" });
          }}
        >
          <Plus className="h-4 w-4" /> เพิ่มหมวด
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาหมวด"
            className="h-10 pl-9"
            aria-label="ค้นหาหมวด"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {(
            [
              ["order", "ลำดับ"],
              ["name", "ชื่อ"],
              ["count", "จำนวน WI"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              className={cn(
                "min-h-9 rounded-md px-3",
                sort === k ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          แสดงที่เก็บถาวร
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error && !rows ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" className="h-10 gap-1" onClick={load}>
              <RefreshCw className="h-4 w-4" /> ลองใหม่
            </Button>
          </div>
        ) : !rows ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "ยังไม่มีหมวด" : "ไม่พบหมวดที่ตรงกับคำค้น"}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px]">ลำดับ</TableHead>
                <TableHead>ชื่อหมวด</TableHead>
                <TableHead className="w-[100px] text-right">จำนวน WI</TableHead>
                <TableHead className="w-[160px] text-right">
                  <span className="sr-only">จัดการ</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} className={cn(!r.is_active && "opacity-60")}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.sort_order}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {r.name}
                      {!r.is_active && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                          เก็บถาวร
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.wi_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        aria-label={`แก้ไข ${r.name}`}
                        onClick={() => {
                          setFormError("");
                          setForm({
                            id: r.id,
                            name: r.name,
                            description: r.description ?? "",
                            sort_order: String(r.sort_order),
                          });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        aria-label={r.is_active ? `เก็บถาวร ${r.name}` : `เปิดใช้ ${r.name}`}
                        title={r.is_active ? "เก็บถาวร" : "เปิดใช้"}
                        onClick={() => toggleActive(r)}
                      >
                        {r.is_active ? (
                          <Archive className="h-4 w-4" />
                        ) : (
                          <ArchiveRestore className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-muted-foreground hover:text-destructive"
                        aria-label={`ลบ ${r.name}`}
                        title={r.wi_count > 0 ? "ยังมี WI ใช้หมวดนี้ — เก็บถาวรแทน" : "ลบ"}
                        disabled={r.wi_count > 0}
                        onClick={() => setToDelete(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "แก้ไขหมวด" : "เพิ่มหมวด"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">
                  ชื่อหมวด <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setFormError("");
                  }}
                  maxLength={120}
                  aria-invalid={!!formError}
                  className="h-11"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-desc">คำอธิบาย</Label>
                <Textarea
                  id="cat-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-order">ลำดับการแสดง</Label>
                <Input
                  id="cat-order"
                  inputMode="numeric"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  placeholder="0"
                  className="h-11 w-32"
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setForm(null)}>
              ยกเลิก
            </Button>
            <Button className={cn("h-10 gap-1", WI_ACCENT_BTN)} onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบหมวด “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              ลบได้เฉพาะหมวดที่ไม่มี WI ใช้งาน ลบแล้วกู้คืนไม่ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={remove}
            >
              ลบหมวด
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
