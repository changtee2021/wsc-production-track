import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAdminToken, clearAdminSession } from "@/lib/auth/admin-session";
import {
  adminFetchPackingChecklists,
  adminUpsertPackingChecklistItem,
  adminDeletePackingChecklistItem,
  adminReorderPackingChecklist,
} from "@/lib/features/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Loader2,
  Eye,
  EyeOff,
  GripVertical,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function requireToken(): string {
  const t = getAdminToken();
  if (!t) {
    clearAdminSession();
    if (typeof window !== "undefined") window.location.href = "/admin";
    throw new Error("Unauthorized");
  }
  return t;
}

function showError(err: unknown) {
  const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
  if (msg === "Unauthorized") {
    clearAdminSession();
    if (typeof window !== "undefined") window.location.href = "/admin";
    return;
  }
  toast.error(msg);
}

interface Category {
  id: string;
  name: string;
}

interface ChecklistItem {
  id: string;
  category_id: string;
  item_text: string;
  item_order: number;
  is_active: boolean;
}

export function PackingChecklistsPanel() {
  const fetchChecklists = useServerFn(adminFetchPackingChecklists);
  const upsert = useServerFn(adminUpsertPackingChecklistItem);
  const del = useServerFn(adminDeletePackingChecklistItem);
  const reorder = useServerFn(adminReorderPackingChecklist);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Load categories once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("active", true)
        .order("name");
      const rows = (data ?? []) as Category[];
      setCategories(rows);
      if (rows.length && !categoryId) setCategoryId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadItems = async () => {
    if (!categoryId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchChecklists({
        data: { token: requireToken(), category_id: categoryId },
      });
      setItems((res.rows ?? []) as ChecklistItem[]);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const addItem = async () => {
    const t = newText.trim();
    if (!t) return toast.error("กรุณากรอกข้อความ");
    if (!categoryId) return toast.error("เลือกหมวดสินค้าก่อน");
    try {
      await upsert({ data: { token: requireToken(), category_id: categoryId, item_text: t } });
      setNewText("");
      toast.success("เพิ่มแล้ว");
      loadItems();
    } catch (err) {
      showError(err);
    }
  };

  const saveEdit = async (id: string) => {
    const t = editingText.trim();
    if (!t) return toast.error("กรอกข้อความ");
    try {
      await upsert({
        data: { token: requireToken(), id, category_id: categoryId, item_text: t },
      });
      setEditingId(null);
      toast.success("บันทึกแล้ว");
      loadItems();
    } catch (err) {
      showError(err);
    }
  };

  const toggleActive = async (it: ChecklistItem) => {
    try {
      await upsert({
        data: {
          token: requireToken(),
          id: it.id,
          category_id: it.category_id,
          item_text: it.item_text,
          is_active: !it.is_active,
        },
      });
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, is_active: !x.is_active } : x)));
    } catch (err) {
      showError(err);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return;
    try {
      await del({ data: { token: requireToken(), id } });
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("ลบแล้ว");
    } catch (err) {
      showError(err);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    try {
      await reorder({
        data: {
          token: requireToken(),
          category_id: categoryId,
          ordered_ids: next.map((x) => x.id),
        },
      });
    } catch (err) {
      showError(err);
      loadItems();
    }
  };

  const sortedIds = useMemo(() => items.map((i) => i.id), [items]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Checklist แพ็คของ</h2>
          <p className="text-xs text-muted-foreground">
            รายการตรวจสอบสำหรับพนักงานแพ็คของ แยกตามหมวดสินค้า
          </p>
        </div>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <Label className="text-xs">หมวดสินค้า</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกหมวด" />
            </SelectTrigger>
            <SelectContent>
              {categories.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  ยังไม่มีหมวด — เพิ่มในแผง "หมวดหมู่"
                </div>
              )}
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {categoryId && (
        <>
          <div className="mb-3 flex gap-2">
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="เพิ่มข้อตรวจสอบใหม่ เช่น ความสะอาดของผิวไม้..."
              maxLength={500}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
            />
            <Button onClick={addItem} className="gap-1">
              <Plus className="h-4 w-4" /> เพิ่ม
            </Button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีข้อตรวจสอบในหมวดนี้
            </div>
          )}

          {!loading && items.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {items.map((it, idx) => (
                    <SortableChecklistRow
                      key={it.id}
                      item={it}
                      index={idx + 1}
                      isEditing={editingId === it.id}
                      editingText={editingText}
                      onStartEdit={() => {
                        setEditingId(it.id);
                        setEditingText(it.item_text);
                      }}
                      onCancelEdit={() => setEditingId(null)}
                      onChangeEditText={setEditingText}
                      onSaveEdit={() => saveEdit(it.id)}
                      onToggleActive={() => toggleActive(it)}
                      onRemove={() => remove(it.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {items.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              ลากที่ <GripVertical className="inline h-3 w-3" /> เพื่อจัดเรียงลำดับ —
              บันทึกอัตโนมัติ
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SortableChecklistRow({
  item,
  index,
  isEditing,
  editingText,
  onStartEdit,
  onCancelEdit,
  onChangeEditText,
  onSaveEdit,
  onToggleActive,
  onRemove,
}: {
  item: ChecklistItem;
  index: number;
  isEditing: boolean;
  editingText: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditText: (v: string) => void;
  onSaveEdit: () => void;
  onToggleActive: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-xl border bg-background p-2.5 ${
        item.is_active ? "border-border" : "border-dashed border-border opacity-60"
      }`}
    >
      <button
        type="button"
        className="mt-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted"
        {...attributes}
        {...listeners}
        aria-label="ลากเพื่อจัดเรียง"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
        {index}
      </span>
      <div className="flex-1">
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editingText}
              onChange={(e) => onChangeEditText(e.target.value)}
              maxLength={500}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
            />
          </div>
        ) : (
          <p className="text-sm leading-snug">{item.item_text}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {isEditing ? (
          <>
            <Button size="sm" variant="default" className="h-8 gap-1" onClick={onSaveEdit}>
              <Save className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              onClick={onToggleActive}
              title={item.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            >
              {item.is_active ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onStartEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
