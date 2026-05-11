import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAdminToken, clearAdminSession } from "@/lib/admin-session";
import {
  adminUpsertCategory,
  adminDeleteCategory,
  adminUpsertEmployee,
  adminDeleteEmployee,
  adminUpsertStep,
  adminDeleteStep,
  adminCreateUploadUrl,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Users,
  ListChecks,
  Upload,
  Loader2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { flagFor, initialsOf } from "@/lib/i18n";

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

export const Route = createFileRoute("/_protected/manage")({
  head: () => ({ meta: [{ title: "จัดการ — ProductionTrack" }] }),
  component: Manage,
});

interface Employee {
  id: string;
  name: string;
  emp_code: string | null;
  nationality: string | null;
  avatar_url: string | null;
  active: boolean;
}
interface Step {
  id: string;
  step_name: string;
  description: string | null;
  image_url: string | null;
  std_duration_minutes: number | null;
  active: boolean;
}

const NATIONALITIES = ["Thai", "Burmese", "Lao", "Khmer", "Other"];

function Manage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">จัดการข้อมูล</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        เพิ่ม แก้ไข ลบหมวดหมู่งานม่าน พนักงาน และขั้นตอนการผลิต พร้อมอัปโหลดรูปและตั้งเวลามาตรฐาน
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoriesPanel />
        <EmployeesPanel />
        <StepsPanel />
      </div>
    </main>
  );
}

interface Category {
  id: string;
  name: string;
  active: boolean;
}

function CategoriesPanel() {
  const upsert = useServerFn(adminUpsertCategory);
  const del = useServerFn(adminDeleteCategory);
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (error) toast.error(error.message);
    setItems((data as Category[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return toast.error("กรุณากรอกชื่อหมวดหมู่");
    try {
      await upsert({ data: { token: requireToken(), name: name.trim() } });
      setName("");
      toast.success("เพิ่มหมวดหมู่แล้ว");
      load();
    } catch (e) { showError(e); }
  };

  const save = async () => {
    if (!editing) return;
    try {
      await upsert({ data: { token: requireToken(), id: editing.id, name: editing.name } });
      setEditing(null);
      toast.success("บันทึกแล้ว");
      load();
    } catch (e) { showError(e); }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบหมวดหมู่นี้?")) return;
    try {
      await del({ data: { token: requireToken(), id } });
      toast.success("ลบแล้ว");
      load();
    } catch (e) { showError(e); }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Layers className="h-5 w-5 text-secondary" />
        หมวดหมู่งานม่าน
      </h2>
      <div className="mb-4 flex gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <Input
          placeholder="ชื่อหมวดหมู่ (เช่น ม่านม้วน)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} className="gap-1 bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4" /> เพิ่ม
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {items.map((c) => (
          <li key={c.id} className="py-3">
            {editing?.id === c.id ? (
              <div className="flex gap-2">
                <Input
                  value={editing.name}
                  onChange={(ev) => setEditing({ ...editing, name: ev.target.value })}
                />
                <Button onClick={save} size="sm" className="gap-1 bg-secondary hover:bg-secondary/90">
                  <Save className="h-4 w-4" /> บันทึก
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(c.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีหมวดหมู่</li>
        )}
      </ul>
    </section>
  );
}

async function adminUpload(
  bucket: "avatars" | "step-images",
  file: File,
  createUrl: (args: { data: { token: string; bucket: "avatars" | "step-images"; ext: string } }) => Promise<{ path: string; token: string; publicUrl: string }>,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const signed = await createUrl({ data: { token: requireToken(), bucket, ext } });
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw error;
  return signed.publicUrl;
}

function EmployeesPanel() {
  const upsert = useServerFn(adminUpsertEmployee);
  const del = useServerFn(adminDeleteEmployee);
  const createUrl = useServerFn(adminCreateUploadUrl);
  const [items, setItems] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [nat, setNat] = useState("Thai");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name");
    if (error) toast.error(error.message);
    setItems((data as Employee[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (file: File, target: "new" | "edit") => {
    setUploading(true);
    try {
      const url = await adminUpload("avatars", file, createUrl);
      if (target === "new") setAvatarUrl(url);
      else if (editing) setEditing({ ...editing, avatar_url: url });
      toast.success("อัปโหลดรูปสำเร็จ");
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  const add = async () => {
    if (!name.trim()) return toast.error("กรุณากรอกชื่อ");
    try {
      await upsert({ data: {
        token: requireToken(),
        name: name.trim(),
        emp_code: code.trim() || null,
        nationality: nat,
        avatar_url: avatarUrl,
      } });
      setName(""); setCode(""); setAvatarUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("เพิ่มพนักงานแล้ว");
      load();
    } catch (e) { showError(e); }
  };

  const save = async () => {
    if (!editing) return;
    try {
      await upsert({ data: {
        token: requireToken(),
        id: editing.id,
        name: editing.name,
        emp_code: editing.emp_code,
        nationality: editing.nationality,
        avatar_url: editing.avatar_url,
        active: editing.active,
      } });
      setEditing(null);
      toast.success("บันทึกแล้ว");
      load();
    } catch (e) { showError(e); }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบพนักงานคนนี้?")) return;
    try {
      await del({ data: { token: requireToken(), id } });
      toast.success("ลบแล้ว");
      load();
    } catch (e) { showError(e); }
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5 text-secondary" />
        พนักงาน
      </h2>

      <div className="mb-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border border-border">
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback className="bg-primary text-primary-foreground">
              {name ? initialsOf(name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f, "new");
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              อัปโหลดรูป
            </Button>
          </div>
        </div>
        <Input
          placeholder="ชื่อพนักงาน"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="รหัสพนักงาน (เช่น EMP001)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Select value={nat} onValueChange={setNat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NATIONALITIES.map((n) => (
                <SelectItem key={n} value={n}>
                  {flagFor(n)} {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} className="w-full gap-1 bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4" /> เพิ่มพนักงาน
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {items.map((e) => (
          <li key={e.id} className="py-3">
            {editing?.id === e.id ? (
              <EmployeeEditor
                editing={editing}
                setEditing={setEditing}
                onSave={save}
                onUpload={(f) => handleUpload(f, "edit")}
                uploading={uploading}
              />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    {e.avatar_url && <AvatarImage src={e.avatar_url} />}
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {initialsOf(e.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1 font-medium">
                      <span>{flagFor(e.nationality)}</span>
                      {e.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.emp_code ? <span className="font-mono">{e.emp_code} · </span> : null}
                      {e.nationality || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(e.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">
            ยังไม่มีพนักงาน
          </li>
        )}
      </ul>
    </section>
  );
}

function EmployeeEditor({
  editing,
  setEditing,
  onSave,
  onUpload,
  uploading,
}: {
  editing: Employee;
  setEditing: (e: Employee | null) => void;
  onSave: () => void;
  onUpload: (f: File) => void;
  uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-12 w-12 border border-border">
          {editing.avatar_url && <AvatarImage src={editing.avatar_url} />}
          <AvatarFallback>{initialsOf(editing.name)}</AvatarFallback>
        </Avatar>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="gap-1"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          เปลี่ยนรูป
        </Button>
      </div>
      <Input
        value={editing.name}
        onChange={(ev) => setEditing({ ...editing, name: ev.target.value })}
        placeholder="ชื่อ"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={editing.emp_code ?? ""}
          onChange={(ev) => setEditing({ ...editing, emp_code: ev.target.value })}
          placeholder="รหัสพนักงาน"
        />
        <Select
          value={editing.nationality ?? "Other"}
          onValueChange={(v) => setEditing({ ...editing, nationality: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NATIONALITIES.map((n) => (
              <SelectItem key={n} value={n}>
                {flagFor(n)} {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} className="flex-1 gap-1 bg-secondary hover:bg-secondary/90">
          <Save className="h-4 w-4" /> บันทึก
        </Button>
        <Button variant="outline" onClick={() => setEditing(null)} className="gap-1">
          <X className="h-4 w-4" /> ยกเลิก
        </Button>
      </div>
    </div>
  );
}

function StepsPanel() {
  const [items, setItems] = useState<Step[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Step | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("steps")
      .select("*")
      .order("step_name");
    if (error) toast.error(error.message);
    setItems((data as Step[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (file: File, target: "new" | "edit") => {
    setUploading(true);
    try {
      const url = await uploadFile("step-images", file);
      if (target === "new") setImageUrl(url);
      else if (editing) setEditing({ ...editing, image_url: url });
      toast.success("อัปโหลดรูปสำเร็จ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const add = async () => {
    if (!name.trim()) return toast.error("กรุณากรอกชื่อขั้นตอน");
    const { error } = await supabase.from("steps").insert({
      step_name: name.trim(),
      description: desc.trim() || null,
      image_url: imageUrl,
      std_duration_minutes: duration ? Number(duration) : null,
    });
    if (error) return toast.error(error.message);
    setName("");
    setDesc("");
    setDuration("");
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("เพิ่มขั้นตอนแล้ว");
    load();
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("steps")
      .update({
        step_name: editing.step_name,
        description: editing.description,
        image_url: editing.image_url,
        std_duration_minutes: editing.std_duration_minutes,
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    toast.success("บันทึกแล้ว");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("ลบขั้นตอนนี้?")) return;
    const { error } = await supabase.from("steps").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    load();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <ListChecks className="h-5 w-5 text-secondary" />
        ขั้นตอนการผลิต
      </h2>

      <div className="mb-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ListChecks className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f, "new");
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            อัปโหลดรูปขั้นตอน
          </Button>
        </div>
        <Input
          placeholder="ชื่อขั้นตอน (เช่น สอดใบมู่ลี่)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="คำอธิบาย (ไม่บังคับ)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className="space-y-1">
          <Label className="text-xs">เวลามาตรฐาน (นาที)</Label>
          <Input
            type="number"
            min="0"
            placeholder="เช่น 15"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <Button onClick={add} className="w-full gap-1 bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4" /> เพิ่มขั้นตอน
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {items.map((s) => (
          <li key={s.id} className="py-3">
            {editing?.id === s.id ? (
              <StepEditor
                editing={editing}
                setEditing={setEditing}
                onSave={save}
                onUpload={(f) => handleUpload(f, "edit")}
                uploading={uploading}
              />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {s.image_url ? (
                      <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ListChecks className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{s.step_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.std_duration_minutes != null ? (
                        <span className="font-medium text-destructive">
                          ≤ {s.std_duration_minutes} นาที
                        </span>
                      ) : (
                        "ไม่ตั้งเวลามาตรฐาน"
                      )}
                      {s.description ? ` · ${s.description}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(s.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">
            ยังไม่มีขั้นตอน
          </li>
        )}
      </ul>
    </section>
  );
}

function StepEditor({
  editing,
  setEditing,
  onSave,
  onUpload,
  uploading,
}: {
  editing: Step;
  setEditing: (s: Step | null) => void;
  onSave: () => void;
  onUpload: (f: File) => void;
  uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-2">
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {editing.image_url ? (
            <img src={editing.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ListChecks className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="gap-1"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          เปลี่ยนรูป
        </Button>
      </div>
      <Input
        value={editing.step_name}
        onChange={(ev) => setEditing({ ...editing, step_name: ev.target.value })}
        placeholder="ชื่อขั้นตอน"
      />
      <Input
        value={editing.description ?? ""}
        onChange={(ev) => setEditing({ ...editing, description: ev.target.value })}
        placeholder="คำอธิบาย"
      />
      <Input
        type="number"
        min="0"
        value={editing.std_duration_minutes ?? ""}
        onChange={(ev) =>
          setEditing({
            ...editing,
            std_duration_minutes: ev.target.value ? Number(ev.target.value) : null,
          })
        }
        placeholder="เวลามาตรฐาน (นาที)"
      />
      <div className="flex gap-2">
        <Button onClick={onSave} className="flex-1 gap-1 bg-secondary hover:bg-secondary/90">
          <Save className="h-4 w-4" /> บันทึก
        </Button>
        <Button variant="outline" onClick={() => setEditing(null)} className="gap-1">
          <X className="h-4 w-4" /> ยกเลิก
        </Button>
      </div>
    </div>
  );
}
