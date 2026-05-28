// Announcements manager — moved out of /manage into /control.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  adminInsertAnnouncement,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
} from "@/lib/admin.functions";
import { requireToken, showError } from "@/lib/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Pencil, Save, X, Loader2,
  ArrowUp, ArrowDown, Eye, EyeOff, Megaphone,
} from "lucide-react";
import { toast } from "sonner";

interface Announcement {
  id: string;
  message: string;
  active: boolean;
  sort_order: number;
}

export function AnnouncementsPanel() {
  const insertFn = useServerFn(adminInsertAnnouncement);
  const updateFn = useServerFn(adminUpdateAnnouncement);
  const deleteFn = useServerFn(adminDeleteAnnouncement);
  const [items, setItems] = useState<Announcement[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as Announcement[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const m = newMsg.trim();
    if (!m) return;
    setBusy(true);
    try {
      const nextOrder = items.length > 0 ? Math.max(...items.map((b) => b.sort_order)) + 1 : 0;
      await insertFn({ data: { token: requireToken(), message: m, sort_order: nextOrder } });
      toast.success("เพิ่มประกาศสำเร็จ");
      setNewMsg("");
      await load();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const startEdit = (a: Announcement) => { setEditingId(a.id); setEditMsg(a.message); };

  const saveEdit = async () => {
    if (!editingId) return;
    const m = editMsg.trim();
    if (!m) return;
    try {
      await updateFn({ data: { token: requireToken(), id: editingId, message: m } });
      toast.success("บันทึกแล้ว");
      setEditingId(null);
      await load();
    } catch (err) { showError(err); }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await updateFn({ data: { token: requireToken(), id: a.id, active: !a.active } });
      await load();
    } catch (err) { showError(err); }
  };

  const move = async (a: Announcement, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === a.id);
    const swap = items[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        updateFn({ data: { token: requireToken(), id: a.id, sort_order: swap.sort_order } }),
        updateFn({ data: { token: requireToken(), id: swap.id, sort_order: a.sort_order } }),
      ]);
      await load();
    } catch (err) { showError(err); }
  };

  const remove = async (a: Announcement) => {
    if (!confirm("ลบประกาศนี้?")) return;
    try {
      await deleteFn({ data: { token: requireToken(), id: a.id } });
      toast.success("ลบสำเร็จ");
      await load();
    } catch (err) { showError(err); }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">ประกาศ</h2>
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="ข้อความประกาศใหม่..."
          maxLength={500}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <Button onClick={add} disabled={busy || !newMsg.trim()} className="shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          เพิ่ม
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          ยังไม่มีประกาศ
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((a, i) => (
            <li key={a.id} className={`rounded-xl border p-3 ${a.active ? "bg-background" : "bg-muted/40 opacity-70"}`}>
              {editingId === a.id ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={editMsg}
                    onChange={(e) => setEditMsg(e.target.value)}
                    maxLength={500}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={saveEdit} className="gap-1"><Save className="h-4 w-4" /> บันทึก</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1"><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="flex-1 break-words text-sm">{a.message}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(a, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === items.length - 1} onClick={() => move(a, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(a)} title={a.active ? "ซ่อน" : "แสดง"}>
                      {a.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(a)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default AnnouncementsPanel;
