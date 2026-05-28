// Office department employees — admin CRUD (mirrors MaintenanceEmployeesPanel).
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListOfficeEmployees,
  adminUpsertOfficeEmployee,
  adminDeleteOfficeEmployee,
  adminCreateUploadUrl,
} from "@/lib/admin.functions";
import { adminUpload, requireToken, showError } from "@/lib/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Trash2, Pencil, Save, X, Upload, Eye, EyeOff, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { initialsOf } from "@/lib/i18n";

interface OfficeEmp {
  id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  active: boolean;
}

export function OfficeEmployeesPanel() {
  const upsert = useServerFn(adminUpsertOfficeEmployee);
  const del = useServerFn(adminDeleteOfficeEmployee);
  const list = useServerFn(adminListOfficeEmployees);
  const createUrl = useServerFn(adminCreateUploadUrl);
  const [items, setItems] = useState<OfficeEmp[]>([]);
  const [name, setName] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<OfficeEmp | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await list({ data: { token: requireToken() } });
      setItems((res.rows ?? []) as OfficeEmp[]);
    } catch (err) { showError(err); }
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (file: File, target: "new" | "edit") => {
    setUploading(true);
    try {
      const { publicUrl: url } = await adminUpload("avatars", file, createUrl);
      if (target === "new") setAvatarUrl(url);
      else if (editing) setEditing({ ...editing, avatar_url: url });
      toast.success("อัปโหลดรูปสำเร็จ");
    } catch (err) { showError(err); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!name.trim()) return;
    try {
      const token = requireToken();
      if (editing) {
        await upsert({ data: { token, id: editing.id, name: name.trim(), emp_code: empCode.trim() || null, avatar_url: editing.avatar_url, active: editing.active } });
        toast.success("บันทึกแล้ว");
      } else {
        await upsert({ data: { token, name: name.trim(), emp_code: empCode.trim() || null, avatar_url: avatarUrl } });
        toast.success("เพิ่มพนักงานออฟฟิศแล้ว");
      }
      setName(""); setEmpCode(""); setAvatarUrl(null); setEditing(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) { showError(err); }
  };

  const toggleActive = async (e: OfficeEmp) => {
    try {
      await upsert({ data: { token: requireToken(), id: e.id, name: e.name, emp_code: e.emp_code, avatar_url: e.avatar_url, active: !e.active } });
      await load();
    } catch (err) { showError(err); }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบพนักงานออฟฟิศคนนี้?")) return;
    try {
      await del({ data: { token: requireToken(), id } });
      toast.success("ลบแล้ว"); await load();
    } catch (err) { showError(err); }
  };

  const startEdit = (e: OfficeEmp) => { setEditing(e); setName(e.name); setEmpCode(e.emp_code ?? ""); setAvatarUrl(e.avatar_url); };
  const cancelEdit = () => { setEditing(null); setName(""); setEmpCode(""); setAvatarUrl(null); if (fileRef.current) fileRef.current.value = ""; };
  const previewUrl = editing ? editing.avatar_url : avatarUrl;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Building2 className="h-5 w-5 text-secondary" /> พนักงานออฟฟิศ
      </h2>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border border-border">
            {previewUrl && <AvatarImage src={previewUrl} />}
            <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
              {name ? initialsOf(name) : "?"}
            </AvatarFallback>
          </Avatar>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, editing ? "edit" : "new"); }} />
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1">
            <Upload className="h-4 w-4" />{uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
          </Button>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อพนักงานออฟฟิศ" />
        <Input value={empCode} onChange={(e) => setEmpCode(e.target.value)} placeholder="รหัสพนักงาน (ถ้ามี)" />
        <div className="flex gap-2">
          <Button onClick={submit} className="flex-1 gap-1">
            {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? "บันทึก" : "เพิ่ม"}
          </Button>
          {editing && (<Button variant="outline" onClick={cancelEdit} className="gap-1"><X className="h-4 w-4" /> ยกเลิก</Button>)}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          ยังไม่มีพนักงานออฟฟิศ
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((e) => (
            <li key={e.id} className={`flex items-center justify-between rounded-lg border p-3 ${e.active ? "border-border bg-background" : "border-dashed border-muted bg-muted/30"}`}>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-border">
                  {e.avatar_url && <AvatarImage src={e.avatar_url} />}
                  <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">{initialsOf(e.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{e.name}</div>
                  {e.emp_code && (<div className="font-mono text-xs text-muted-foreground">{e.emp_code}</div>)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => toggleActive(e)} title={e.active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}>
                  {e.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default OfficeEmployeesPanel;
