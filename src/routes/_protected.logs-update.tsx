import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminFetchSystemLogs,
  adminInsertSystemLog,
  adminDeleteSystemLog,
} from "@/lib/system-logs.functions";
import { adminSendLineTest } from "@/lib/line.functions";
import { adminGetLineSchedule, adminSetLineSchedule } from "@/lib/line-schedule.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Plus, Trash2, Search, Clock, FileCode, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { markLogsSeen } from "@/lib/utils/log-seen";

export const Route = createFileRoute("/_protected/logs-update")({
  head: () => ({ meta: [{ title: "LogUpdate — WSC ProductionTrack" }] }),
  component: LogsUpdatePage,
});

type Category = "feature" | "bugfix" | "security" | "ui" | "refactor";

interface LogRow {
  id: string;
  title: string;
  summary: string;
  category: Category;
  version: string | null;
  paths: string[];
  created_at: string;
}

const CATEGORY_META: Record<Category, { label: string; cls: string }> = {
  feature: { label: "ฟีเจอร์ใหม่", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  bugfix: { label: "แก้บั๊ก", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  security: { label: "ความปลอดภัย", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  ui: { label: "ปรับ UI", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" },
  refactor: { label: "ปรับโครงสร้าง", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30" },
};

function LogsUpdatePage() {
  const fetchLogs = useServerFn(adminFetchSystemLogs);
  const insertLog = useServerFn(adminInsertSystemLog);
  const deleteLog = useServerFn(adminDeleteSystemLog);
  const sendLineTest = useServerFn(adminSendLineTest);
  const getSchedule = useServerFn(adminGetLineSchedule);
  const setSchedule = useServerFn(adminSetLineSchedule);
  const [lineSending, setLineSending] = useState(false);
  const [schedTime, setSchedTime] = useState("08:30");
  const [schedEnabled, setSchedEnabled] = useState(true);
  const [schedLastSent, setSchedLastSent] = useState<string | null>(null);
  const [schedLoading, setSchedLoading] = useState(true);
  const [schedSaving, setSchedSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSchedule({ data: { token: requireToken() } });
        setSchedTime(s.time);
        setSchedEnabled(s.enabled);
        setSchedLastSent(s.lastSentDate);
      } catch (e) {
        showError(e, "โหลดค่าตั้งเวลาไม่สำเร็จ");
      } finally {
        setSchedLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendLineTest = async () => {
    setLineSending(true);
    try {
      await sendLineTest({ data: { token: requireToken() } });
      toast.success("ส่งข้อความทดสอบ LINE สำเร็จ ✅");
    } catch (e) {
      showError(e, "ส่งข้อความทดสอบ LINE ไม่สำเร็จ");
    } finally {
      setLineSending(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSchedSaving(true);
    try {
      await setSchedule({
        data: { token: requireToken(), time: schedTime, enabled: schedEnabled },
      });
      toast.success("บันทึกเวลาส่งอัตโนมัติแล้ว");
    } catch (e) {
      showError(e, "บันทึกไม่สำเร็จ");
    } finally {
      setSchedSaving(false);
    }
  };

  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");

  // Add dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    category: "feature" as Category,
    version: "",
    paths: "",
  });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetchLogs({ data: { token: requireToken(), limit: 300 } });
      setRows((res.rows ?? []) as LogRow[]);
      // Mark as seen so the sidebar NEW badge clears
      if (res.rows && res.rows.length > 0) {
        markLogsSeen(res.rows[0].created_at);
      }
    } catch (e) {
      showError(e, "โหลดบันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.category !== filter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (
          !r.title.toLowerCase().includes(s) &&
          !r.summary.toLowerCase().includes(s) &&
          !r.paths.some((p) => p.toLowerCase().includes(s))
        )
          return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  // Group by day for timeline display
  const grouped = useMemo(() => {
    const map = new Map<string, LogRow[]>();
    for (const r of filtered) {
      const day = format(new Date(r.created_at), "yyyy-MM-dd");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error("กรอกหัวข้อและสรุปก่อน");
      return;
    }
    setSaving(true);
    try {
      await insertLog({
        data: {
          token: requireToken(),
          title: form.title.trim(),
          summary: form.summary.trim(),
          category: form.category,
          version: form.version.trim() || null,
          paths: form.paths
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
        },
      });
      toast.success("เพิ่มบันทึกแล้ว");
      setOpen(false);
      setForm({ title: "", summary: "", category: "feature", version: "", paths: "" });
      await reload();
    } catch (e) {
      showError(e, "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ลบบันทึกนี้?")) return;
    try {
      await deleteLog({ data: { token: requireToken(), id } });
      toast.success("ลบแล้ว");
      await reload();
    } catch (e) {
      showError(e, "ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Toaster />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">บันทึกการอัปเดตแอป</h2>
          <p className="text-sm text-muted-foreground">
            ประวัติการเพิ่ม/แก้ไข/ปรับปรุงระบบ
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1">
              <Plus className="h-4 w-4" />
              เพิ่มบันทึก
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>เพิ่มบันทึกใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">หัวข้อ</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="เช่น เพิ่มหน้า LogUpdate"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">สรุปการเปลี่ยนแปลง</label>
                <Textarea
                  rows={4}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="อธิบายสั้นๆ ว่าทำอะไรบ้าง"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">หมวด</label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v as Category })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_META[c].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวอร์ชัน (ไม่บังคับ)</label>
                  <Input
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="v1.2.3"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  ไฟล์/path ที่แก้ (คั่นด้วย comma)
                </label>
                <Input
                  value={form.paths}
                  onChange={(e) => setForm({ ...form, paths: e.target.value })}
                  placeholder="src/routes/foo.tsx, src/lib/bar.ts"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Send className="h-4 w-4 text-primary" />
            ทดสอบการแจ้งเตือน LINE
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            กดปุ่มเพื่อส่งสรุปภาพรวมประจำวันไปยังกลุ่ม LINE ที่ตั้งค่าไว้
          </p>
        </div>
        <Button
          onClick={handleSendLineTest}
          disabled={lineSending}
          size="sm"
          className="mt-3 gap-2 sm:mt-0"
        >
          {lineSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {lineSending ? "กำลังส่ง..." : "ส่งข้อความทดสอบ"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              ตั้งเวลาส่งสรุปอัตโนมัติ (รายวัน)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              ระบบจะส่งสรุปเข้ากลุ่ม LINE ตามเวลาที่ตั้งไว้ (เวลาไทย){" "}
              {schedLastSent ? `· ส่งล่าสุด: ${schedLastSent}` : "· ยังไม่เคยส่งโดยอัตโนมัติ"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">เวลา</label>
            <Input
              type="time"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
              disabled={schedLoading}
              className="w-32"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={schedEnabled}
              onChange={(e) => setSchedEnabled(e.target.checked)}
              disabled={schedLoading}
              className="h-4 w-4 accent-primary"
            />
            เปิดใช้งานการส่งอัตโนมัติ
          </label>
          <Button
            onClick={handleSaveSchedule}
            disabled={schedLoading || schedSaving}
            size="sm"
            className="sm:ml-auto gap-2"
          >
            {schedSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            {schedSaving ? "กำลังบันทึก..." : "บันทึกเวลา"}
          </Button>
        </div>
      </div>



      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา..."
            className="pl-8"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Category | "all")}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวด</SelectItem>
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_META[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">กำลังโหลด...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">ไม่มีบันทึก</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="sticky top-14 z-10 bg-background/95 backdrop-blur py-1 mb-2 border-b">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {format(new Date(day), "EEEE d MMMM yyyy", { locale: th })}
                </div>
              </div>
              <div className="space-y-3">
                {items.map((row) => (
                  <LogCard key={row.id} row={row} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogCard({ row, onDelete }: { row: LogRow; onDelete: (id: string) => void }) {
  const meta = CATEGORY_META[row.category];
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={meta.cls}>
              {meta.label}
            </Badge>
            {row.version && (
              <Badge variant="secondary" className="font-mono text-xs">
                {row.version}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(new Date(row.created_at), "HH:mm")}
            </span>
          </div>
          <h3 className="font-semibold text-base">{row.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {row.summary}
          </p>
          {row.paths.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {row.paths.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
                >
                  <FileCode className="h-3 w-3" />
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(row.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
