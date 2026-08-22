// Aggregated staff directory across all departments.
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListAllStaff,
  adminToggleStaffDepartment,
  adminUpdateStaffMeta,
  DEPARTMENTS,
  type Department,
} from "@/lib/features/staff-directory.functions";
import { adminCreateUploadUrl } from "@/lib/features/admin.functions";
import { adminUpload, requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Pencil, Save, X, Upload, Loader2, Eye, Plus } from "lucide-react";
import { useOpenEmployeeProfile } from "@/components/EmployeeProfileProvider";
import { toast } from "sonner";
import { initialsOf } from "@/lib/utils/i18n";

type StaffEntry = {
  key: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  nationality: string | null;
  departments: Department[];
  ids: Partial<Record<Department, string>>;
  active: Partial<Record<Department, boolean>>;
};

const DEPT_LABEL: Record<Department, string> = {
  production: "ผลิต",
  qc: "QC",
  packing: "แพ็ค",
  maintenance: "ซ่อม",
  office: "ออฟฟิศ",
  stock: "สต๊อก",
  warehouse: "คลัง",
  transport: "ขนส่ง",
};

const DEPT_COLOR: Record<Department, string> = {
  production: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  qc: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  packing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  maintenance: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  office: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  stock: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  warehouse: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  transport: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

const NATIONALITIES = ["Thai", "Burmese", "Lao", "Khmer", "Other"] as const;

/** Map legacy / garbled nationality values to clean English labels. */
function normalizeNationality(raw: string | null | undefined): string {
  if (!raw) return "-";
  const v = raw.trim();
  const lower = v.toLowerCase();
  if (lower === "thai" || v === "ไทย" || lower === "thailand") return "Thai";
  if (["burmese", "myanmar", "mm", "พม่า"].includes(lower) || v === "พม่า") return "Burmese";
  if (["lao", "laos"].includes(lower) || v === "ลาว") return "Lao";
  if (["khmer", "cambodian", "cambodia"].includes(lower) || v === "เขมร") return "Khmer";
  if ((NATIONALITIES as readonly string[]).includes(v)) return v;
  // Garbled bytes that are not valid Thai script → treat as Other
  const hasNonAscii = Array.from(v).some((ch) => ch.charCodeAt(0) > 127);
  if (hasNonAscii && !/[\u0E00-\u0E7F]/.test(v)) return "Other";
  return v;
}

export function AllStaffPanel() {
  const openProfile = useOpenEmployeeProfile();
  const listFn = useServerFn(adminListAllStaff);
  const toggleFn = useServerFn(adminToggleStaffDepartment);
  const updateFn = useServerFn(adminUpdateStaffMeta);
  const createUrl = useServerFn(adminCreateUploadUrl);

  const [rows, setRows] = useState<StaffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    emp_code: "",
    avatar_url: null as string | null,
    nationality: "Thai",
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newNat, setNewNat] = useState("Thai");
  const [newDept, setNewDept] = useState<Department>("production");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFn({ data: { token: requireToken() } });
      setRows((res.rows ?? []) as StaffEntry[]);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (r: StaffEntry) => {
    const nat = normalizeNationality(r.nationality);
    setEditKey(r.key);
    setEditForm({
      name: r.name,
      emp_code: r.emp_code ?? "",
      avatar_url: r.avatar_url,
      nationality: nat === "-" || nat === "Other" ? "Thai" : nat,
    });
  };

  const cancelEdit = () => {
    setEditKey(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { publicUrl } = await adminUpload("avatars", file, createUrl);
      setEditForm((f) => ({ ...f, avatar_url: publicUrl }));
      toast.success("อัปโหลดรูปสำเร็จ");
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async (r: StaffEntry) => {
    if (!editForm.name.trim()) return;
    setBusyKey(r.key);
    try {
      const targets = r.departments
        .map((d) => ({ department: d, id: r.ids[d]! }))
        .filter((t) => !!t.id);
      if (targets.length === 0) {
        toast.error("ยังไม่ได้กำหนดแผนกของพนักงานคนนี้");
        return;
      }
      await updateFn({
        data: {
          token: requireToken(),
          targets,
          name: editForm.name.trim(),
          emp_code: editForm.emp_code.trim() || null,
          avatar_url: editForm.avatar_url,
          nationality: editForm.nationality || null,
        },
      });
      toast.success("บันทึกข้อมูลแล้ว");
      setEditKey(null);
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const toggleDept = async (r: StaffEntry, dept: Department, enabled: boolean) => {
    setBusyKey(r.key);
    try {
      await toggleFn({
        data: {
          token: requireToken(),
          name: r.name,
          emp_code: r.emp_code,
          avatar_url: r.avatar_url,
          nationality: r.nationality,
          department: dept,
          enabled,
          existingId: r.ids[dept] ?? null,
        },
      });
      toast.success(
        enabled
          ? `เพิ่มเข้าแผนก${DEPT_LABEL[dept]}แล้ว`
          : `ลบออกจากแผนก${DEPT_LABEL[dept]}แล้ว`,
      );
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const addStaff = async () => {
    if (!newName.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }
    setAdding(true);
    try {
      await toggleFn({
        data: {
          token: requireToken(),
          name: newName.trim(),
          emp_code: newCode.trim() || null,
          nationality: newNat,
          department: newDept,
          enabled: true,
          existingId: null,
        },
      });
      toast.success("เพิ่มพนักงานแล้ว");
      setNewName("");
      setNewCode("");
      setNewNat("Thai");
      setNewDept("production");
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setAdding(false);
    }
  };

  const filtered = rows.filter((r) => {
    if (deptFilter !== "all" && !r.departments.includes(deptFilter)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.emp_code ?? "").toLowerCase().includes(q);
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">พนักงานทั้งหมด (ทุกแผนก)</h2>
          <Badge variant="secondary" className="ml-1">
            {rows.length} คน
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ / รหัสพนักงาน"
            className="h-9 w-56"
          />
          <div className="flex max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setDeptFilter("all")}
              className={`rounded px-2 py-1 text-xs font-semibold ${
                deptFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              ทั้งหมด
            </button>
            {DEPARTMENTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeptFilter(d)}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  deptFilter === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {DEPT_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ชื่อพนักงานใหม่"
          className="h-9"
        />
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="รหัส (ไม่บังคับ)"
          className="h-9"
        />
        <select
          value={newNat}
          onChange={(e) => setNewNat(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {NATIONALITIES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={newDept}
          onChange={(e) => setNewDept(e.target.value as Department)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              แผนก: {DEPT_LABEL[d]}
            </option>
          ))}
        </select>
        <Button type="button" className="h-9 gap-1" onClick={() => void addStaff()} disabled={adding}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          เพิ่ม
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          ไม่พบพนักงาน
        </div>
      ) : (
        <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="sticky top-0 z-20 bg-card py-2 pr-3 shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                  พนักงาน
                </th>
                <th className="sticky top-0 z-20 bg-card py-2 pr-3 shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                  รหัส
                </th>
                <th className="sticky top-0 z-20 bg-card py-2 pr-3 shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                  สัญชาติ
                </th>
                {DEPARTMENTS.map((d) => (
                  <th
                    key={d}
                    className="sticky top-0 z-20 w-14 border-l border-border/50 bg-card px-1 py-2 shadow-[inset_0_-1px_0_0_hsl(var(--border))]"
                  >
                    <span className="flex justify-center text-center leading-tight">
                      {DEPT_LABEL[d]}
                    </span>
                  </th>
                ))}
                <th className="sticky top-0 z-20 border-l border-border/50 bg-card py-2 pl-3 pr-3 text-right shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const editing = editKey === r.key;
                const previewUrl = editing ? editForm.avatar_url : r.avatar_url;
                return (
                  <tr key={r.key} className="border-b border-border/60 align-middle">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          {previewUrl ? <AvatarImage src={previewUrl} /> : null}
                          <AvatarFallback className="bg-muted text-xs">
                            {initialsOf(editing ? editForm.name : r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-[180px]">
                          {editing ? (
                            <div className="space-y-1">
                              <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                className="h-8"
                                placeholder="ชื่อ"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  ref={fileRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUpload(f);
                                  }}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => fileRef.current?.click()}
                                  disabled={uploading}
                                >
                                  <Upload className="h-3 w-3" />
                                  {uploading ? "อัปโหลด..." : "เปลี่ยนรูป"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openProfile({ name: r.name, emp_code: r.emp_code })}
                              className="text-left font-semibold hover:text-primary hover:underline"
                              title="ดูโปรไฟล์พนักงาน"
                            >
                              {r.name}
                            </button>
                          )}
                          {!editing && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {r.departments.map((d) => (
                                <span
                                  key={d}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${DEPT_COLOR[d]}`}
                                >
                                  {DEPT_LABEL[d]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {editing ? (
                        <Input
                          value={editForm.emp_code}
                          onChange={(e) => setEditForm((f) => ({ ...f, emp_code: e.target.value }))}
                          className="h-8 w-24"
                          placeholder="รหัส"
                        />
                      ) : (
                        <span className="text-muted-foreground">{r.emp_code ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {editing ? (
                        <select
                          value={editForm.nationality}
                          onChange={(e) => setEditForm((f) => ({ ...f, nationality: e.target.value }))}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          {NATIONALITIES.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">
                          {normalizeNationality(r.nationality)}
                        </span>
                      )}
                    </td>
                    {DEPARTMENTS.map((d) => (
                      <td key={d} className="w-14 border-l border-border/50 px-1 py-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={r.departments.includes(d)}
                            disabled={busyKey === r.key}
                            onCheckedChange={(v) => void toggleDept(r, d, !!v)}
                            aria-label={`${r.name} ${DEPT_LABEL[d]}`}
                          />
                        </div>
                      </td>
                    ))}
                    <td className="border-l border-border/50 py-2 pl-3 pr-1 text-right">
                      {editing ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => void saveEdit(r)}
                            disabled={busyKey === r.key}
                            className="h-8 gap-1"
                          >
                            <Save className="h-3 w-3" /> บันทึก
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 gap-1">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openProfile({ name: r.name, emp_code: r.emp_code })}
                            className="h-8 px-2"
                            title="ดูโปรไฟล์"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(r)}
                            className="h-8 gap-1"
                          >
                            <Pencil className="h-3 w-3" /> แก้ไข
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        เคล็ดลับ: ติ๊ก checkbox เพื่อเพิ่ม/ลบแผนกของพนักงานคนนั้น · กด "แก้ไข" เพื่อแก้ชื่อ รหัส รูป
        และสัญชาติ (จะ sync ทุกแผนกของพนักงานคนนี้)
      </p>
    </section>
  );
}
