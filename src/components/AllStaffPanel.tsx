// Aggregated staff directory across all departments.
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminBulkEditStaff,
  adminDeleteStaffMany,
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
import {
  Users,
  Pencil,
  Save,
  X,
  Upload,
  Loader2,
  Eye,
  Plus,
  Printer,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { useOpenEmployeeProfile } from "@/components/EmployeeProfileProvider";
import { toast } from "sonner";
import { initialsOf } from "@/lib/utils/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeIdCard } from "@/components/EmployeeIdCard";
import {
  BADGE_CSS,
  openBadgeA4Print,
  openBadgePrint,
  toBadgePerson,
  type BadgeSource,
} from "@/lib/employee-badge";

type StaffEntry = {
  key: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  nationality: string | null;
  is_sub: boolean;
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
  const deleteFn = useServerFn(adminDeleteStaffMany);
  const bulkFn = useServerFn(adminBulkEditStaff);
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
  const [badgeRows, setBadgeRows] = useState<StaffEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkNat, setBulkNat] = useState("");
  const [bulkDept, setBulkDept] = useState<Department | "">("");
  const [bulkDeptOn, setBulkDeptOn] = useState(true);

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
        enabled ? `เพิ่มเข้าแผนก${DEPT_LABEL[dept]}แล้ว` : `ลบออกจากแผนก${DEPT_LABEL[dept]}แล้ว`,
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

  const toPerson = (r: StaffEntry) => ({
    targets: r.departments.map((d) => ({ department: d, id: r.ids[d]! })).filter((t) => !!t.id),
    name: r.name,
    emp_code: r.emp_code,
    avatar_url: r.avatar_url,
    nationality: r.nationality,
    is_sub: r.is_sub,
  });

  const deletePeople = async (people: StaffEntry[]) => {
    const ready = people.filter((r) => r.departments.length > 0);
    if (ready.length === 0) return;
    const label =
      ready.length === 1
        ? `ลบ ${ready[0].name} ออกจากทุกแผนก?\nประวัติงานเก่ายังอยู่ แต่จะไม่ผูกชื่อคนนี้แล้ว`
        : `ลบพนักงาน ${ready.length} คนออกจากทุกแผนก?\nประวัติงานเก่ายังอยู่ แต่จะไม่ผูกชื่อแล้ว`;
    if (!confirm(label)) return;
    setBulkBusy(true);
    try {
      for (let i = 0; i < ready.length; i += 100) {
        await deleteFn({
          data: { token: requireToken(), people: ready.slice(i, i + 100).map(toPerson) },
        });
      }
      toast.success(ready.length === 1 ? "ลบพนักงานแล้ว" : `ลบพนักงาน ${ready.length} คนแล้ว`);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of ready) next.delete(r.key);
        return next;
      });
      if (editKey && ready.some((r) => r.key === editKey)) cancelEdit();
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBulkBusy(false);
    }
  };

  const applyBulkEdit = async () => {
    const people = rows.filter((r) => selected.has(r.key));
    if (people.length === 0) return;
    if (!bulkNat && !bulkDept) {
      toast.error("เลือกสัญชาติหรือแผนกที่ต้องการแก้");
      return;
    }
    setBulkBusy(true);
    try {
      let skipped = 0;
      for (let i = 0; i < people.length; i += 100) {
        const res = await bulkFn({
          data: {
            token: requireToken(),
            people: people.slice(i, i + 100).map(toPerson),
            nationality: bulkNat || undefined,
            department: bulkDept || undefined,
            departmentEnabled: bulkDept ? bulkDeptOn : undefined,
          },
        });
        skipped += res.nationalitySkipped ?? 0;
      }
      toast.success(
        skipped > 0
          ? `แก้แล้ว · สัญชาติข้าม ${skipped} คนที่ไม่อยู่แผนกผลิต`
          : `แก้พนักงาน ${people.length} คนแล้ว`,
      );
      setBulkOpen(false);
      setSelected(new Set());
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBulkBusy(false);
    }
  };

  const filtered = rows.filter((r) => {
    if (deptFilter !== "all" && !r.departments.includes(deptFilter)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.emp_code ?? "").toLowerCase().includes(q);
  });

  const withPhoto = rows.filter((r) => !!r.avatar_url);
  const regular = filtered.filter((r) => !r.is_sub);
  const subs = filtered.filter((r) => r.is_sub);
  const listed: Array<
    { kind: "head"; key: string; title: string } | { kind: "row"; r: StaffEntry }
  > = [
    ...(regular.length
      ? [{ kind: "head" as const, key: "head-regular", title: `พนักงานประจำ ${regular.length} คน` }]
      : []),
    ...regular.map((r) => ({ kind: "row" as const, r })),
    ...(subs.length
      ? [{ kind: "head" as const, key: "head-sub", title: `พนักงาน Sub ${subs.length} คน` }]
      : []),
    ...subs.map((r) => ({ kind: "row" as const, r })),
  ];

  const selectedRows = rows.filter((r) => selected.has(r.key));
  const selectedInView = filtered.filter((r) => selected.has(r.key)).length;
  const allFilteredSelected = filtered.length > 0 && selectedInView === filtered.length;

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
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-1"
            disabled={filtered.length === 0}
            onClick={() => setBadgeRows(filtered)}
          >
            <Printer className="h-4 w-4" />
            พิมพ์บัตร ({filtered.length})
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-1 sm:h-9"
            disabled={withPhoto.length === 0}
            onClick={() => {
              try {
                openBadgeA4Print(withPhoto.map((r) => toBadgePerson(r as BadgeSource)));
              } catch (err) {
                showError(err);
              }
            }}
          >
            <Printer className="h-4 w-4" />
            PDF A4 ที่มีรูป ({withPhoto.length})
          </Button>
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
        <Button
          type="button"
          className="h-9 gap-1"
          onClick={() => void addStaff()}
          disabled={adding}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          เพิ่ม
        </Button>
      </div>

      {selectedRows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-semibold">เลือกแล้ว {selectedRows.length} คน</span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-1 sm:min-h-9"
            disabled={bulkBusy}
            onClick={() => {
              setBulkNat("");
              setBulkDept("");
              setBulkDeptOn(true);
              setBulkOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            แก้ไขชุด
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-1 border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 sm:min-h-9"
            disabled={bulkBusy}
            onClick={() => void deletePeople(selectedRows)}
          >
            {bulkBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            ลบที่เลือก
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 sm:min-h-9"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
          >
            ยกเลิกการเลือก
          </Button>
        </div>
      )}

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
                <th className="sticky top-0 z-20 w-12 bg-card px-2 py-2 shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                  <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                    <Checkbox
                      className="h-5 w-5"
                      checked={
                        allFilteredSelected ? true : selectedInView > 0 ? "indeterminate" : false
                      }
                      disabled={bulkBusy || filtered.length === 0}
                      onCheckedChange={() => {
                        const on = !allFilteredSelected;
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const r of filtered) {
                            if (on) next.add(r.key);
                            else next.delete(r.key);
                          }
                          return next;
                        });
                      }}
                      aria-label="เลือกพนักงานที่แสดงทั้งหมด"
                    />
                  </label>
                </th>
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
              {listed.map((item) => {
                if (item.kind === "head") {
                  return (
                    <tr key={item.key} className="border-b border-sky-200 bg-sky-50">
                      <td
                        colSpan={4 + DEPARTMENTS.length + 1}
                        className="px-3 py-2 text-sm font-semibold text-sky-900"
                      >
                        {item.title}
                      </td>
                    </tr>
                  );
                }
                const r = item.r;
                const editing = editKey === r.key;
                const previewUrl = editing ? editForm.avatar_url : r.avatar_url;
                return (
                  <tr key={r.key} className="border-b border-border/60 align-middle">
                    <td className="px-2 py-2">
                      <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                        <Checkbox
                          className="h-5 w-5"
                          checked={selected.has(r.key)}
                          disabled={bulkBusy}
                          onCheckedChange={(v) => {
                            const on = v === true;
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (on) next.add(r.key);
                              else next.delete(r.key);
                              return next;
                            });
                          }}
                          aria-label={`เลือก ${r.name}`}
                        />
                      </label>
                    </td>
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
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, name: e.target.value }))
                                }
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
                          {r.is_sub && (
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                              Sub
                            </span>
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
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, nationality: e.target.value }))
                          }
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            className="h-8 gap-1"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-11 min-w-11 px-2 sm:min-h-9 sm:min-w-9"
                            aria-label={`ดูโปรไฟล์ของ ${r.name}`}
                            title="ดูโปรไฟล์พนักงาน"
                            onClick={() => openProfile({ name: r.name, emp_code: r.emp_code })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="min-h-11 min-w-11 px-2 sm:min-h-9 sm:min-w-9"
                                aria-label={`ตัวเลือกของ ${r.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                className="min-h-11 gap-2"
                                onSelect={() => startEdit(r)}
                              >
                                <Pencil className="h-4 w-4" /> แก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="min-h-11 gap-2"
                                onSelect={() => setBadgeRows([r])}
                              >
                                <Printer className="h-4 w-4" /> พิมพ์บัตร
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="min-h-11 gap-2 text-red-700 focus:text-red-700"
                                disabled={bulkBusy}
                                onSelect={() => {
                                  window.setTimeout(() => void deletePeople([r]), 0);
                                }}
                              >
                                <Trash2 className="h-4 w-4" /> ลบ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
        ช่องติ๊กหน้าชื่อใช้เลือกหลายคน เพื่อลบหรือแก้สัญชาติกับแผนกพร้อมกัน ·
        ติ๊กในคอลัมน์แผนกยังใช้ เพิ่มหรือเอาออกทีละแผนก · กดรูปตาเพื่อดูโปรไฟล์ · กด ... เพื่อแก้ไข
        พิมพ์บัตร หรือลบคนนั้น · รายชื่อที่คลุมสีฟ้าอยู่กลุ่ม Sub · บัตรสร้างจากข้อมูลนี้ทันที
      </p>

      <Dialog open={bulkOpen} onOpenChange={(open) => !bulkBusy && setBulkOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขพนักงานที่เลือก {selectedRows.length} คน</DialogTitle>
            <p className="text-sm text-muted-foreground">
              เปลี่ยนเฉพาะช่องที่เลือก สัญชาติบันทึกได้กับคนที่อยู่แผนกผลิต ถ้าเอาออกจากแผนกสุดท้าย
              คนนั้นจะหายจากรายการ
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              สัญชาติ
              <select
                value={bulkNat}
                onChange={(e) => setBulkNat(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">ไม่เปลี่ยน</option>
                {NATIONALITIES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              แผนก
              <select
                value={bulkDept}
                onChange={(e) => setBulkDept(e.target.value as Department | "")}
                className="mt-1 h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">ไม่เปลี่ยน</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPT_LABEL[d]}
                  </option>
                ))}
              </select>
            </label>
            {bulkDept && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={bulkDeptOn ? "default" : "outline"}
                  className="min-h-11 flex-1"
                  onClick={() => setBulkDeptOn(true)}
                >
                  เพิ่มเข้าแผนก
                </Button>
                <Button
                  type="button"
                  variant={!bulkDeptOn ? "default" : "outline"}
                  className="min-h-11 flex-1"
                  onClick={() => setBulkDeptOn(false)}
                >
                  เอาออกจากแผนก
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={bulkBusy}
              onClick={() => setBulkOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              className="min-h-11 gap-1"
              disabled={bulkBusy || (!bulkNat && !bulkDept)}
              onClick={() => void applyBulkEdit()}
            >
              {bulkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึกชุดนี้
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={badgeRows !== null} onOpenChange={(open) => !open && setBadgeRows(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>บัตรพนักงาน {badgeRows?.length ?? 0} ใบ</DialogTitle>
            <p className="text-sm text-muted-foreground">
              ขนาดพิมพ์ 54×86 มม. บัตรแนวตั้งมาตรฐาน ใบละ 1 หน้า ตอนพิมพ์เลือกบันทึกเป็น PDF
              หรือกระดาษขนาดนี้ ถ้าไม่มีรูปจะใช้ไอคอนคนแทน
            </p>
          </DialogHeader>
          <style>{BADGE_CSS}</style>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-wrap gap-4">
              {(badgeRows ?? []).map((r) => (
                <div key={r.key} className="h-[116mm] w-[73mm] overflow-hidden">
                  <div className="origin-top-left scale-[1.35]">
                    <EmployeeIdCard person={toBadgePerson(r as BadgeSource)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              className="h-11 gap-2"
              onClick={() => {
                if (!badgeRows?.length) return;
                try {
                  openBadgePrint(badgeRows.map((r) => toBadgePerson(r)));
                } catch (err) {
                  showError(err);
                }
              }}
            >
              <Printer className="h-4 w-4" />
              พิมพ์ / บันทึก PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
