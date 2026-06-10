// Excel-like pivoted production history with filters, row selection, CSV/XLSX export, and Google Sheets sync.
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminGetProductionExcel,
  adminSyncProductionExcelToSheets,
  type ExcelJob,
} from "@/lib/features/production-excel.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  Download,
  Send,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  buildHeaders,
  buildRows,
  downloadCsv,
  downloadXlsx,
} from "@/lib/utils/production-excel-export";

export const Route = createFileRoute("/_protected/production-excel")({
  head: () => ({
    meta: [{ title: "พรีวิว Excel ประวัติผลิต — WSC ProductionTrack" }],
  }),
  component: ProductionExcelPage,
});

type Category = { id: string; name: string };

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function ProductionExcelPage() {
  const getData = useServerFn(adminGetProductionExcel);
  const syncSheets = useServerFn(adminSyncProductionExcelToSheets);

  const [start, setStart] = useState(todayISO(-7));
  const [end, setEnd] = useState(todayISO(0));
  const [categoryId, setCategoryId] = useState<string>("__all");
  const [jobSearch, setJobSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ExcelJob[]>([]);
  const [maxSteps, setMaxSteps] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("ProductionHistory");
  const [syncMode, setSyncMode] = useState<"append" | "replace">("append");

  const load = async () => {
    setLoading(true);
    try {
      const res = await getData({
        data: {
          token: requireToken(),
          start,
          end,
          category_id: categoryId === "__all" ? null : categoryId,
        },
      });
      setJobs(res.jobs);
      setMaxSteps(res.max_steps);
      setCategories(res.categories);
      setSelected(new Set());
      if (res.jobs.length === 0) toast.info("ไม่พบข้อมูลในช่วงที่เลือก");
    } catch (e) {
      showError(e, "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.job_id.toLowerCase().includes(q) ||
        (j.category_name ?? "").toLowerCase().includes(q),
    );
  }, [jobs, jobSearch]);

  const targetJobs = useMemo(() => {
    if (selected.size === 0) return filteredJobs;
    return filteredJobs.filter((j) => selected.has(j.job_id));
  }, [filteredJobs, selected]);

  const headers = useMemo(() => buildHeaders(maxSteps), [maxSteps]);
  const rows = useMemo(() => buildRows(targetJobs, maxSteps), [targetJobs, maxSteps]);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filteredJobs.map((j) => j.job_id)));
    else setSelected(new Set());
  };
  const toggleOne = (jobId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  };
  const allChecked =
    filteredJobs.length > 0 && selected.size >= filteredJobs.length;

  const onDownloadCsv = () => {
    if (rows.length === 0) return toast.info("ไม่มีข้อมูลให้ดาวน์โหลด");
    downloadCsv(headers, rows);
  };
  const onDownloadXlsx = () => {
    if (rows.length === 0) return toast.info("ไม่มีข้อมูลให้ดาวน์โหลด");
    downloadXlsx(headers, rows);
  };

  const onSync = async () => {
    if (!spreadsheetId.trim()) return toast.error("กรุณาใส่ Spreadsheet ID");
    if (rows.length === 0) return toast.error("ไม่มีข้อมูลให้ส่ง");
    setSyncing(true);
    const tid = toast.loading("กำลังส่งข้อมูลเข้า Google Sheets...");
    try {
      const res = await syncSheets({
        data: {
          token: requireToken(),
          spreadsheet_id: spreadsheetId.trim(),
          sheet_name: sheetName.trim() || "Sheet1",
          mode: syncMode,
          headers,
          rows,
        },
      });
      toast.success(`ส่งสำเร็จ — ${res.written} แถว`, { id: tid });
      setSyncOpen(false);
    } catch (e) {
      toast.dismiss(tid);
      showError(e, "ส่งข้อมูลไม่สำเร็จ");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileSpreadsheet className="h-6 w-6 text-primary" /> พรีวิว Excel
          ประวัติผลิต
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ตารางแบบ Excel: 1 แถว = 1 Job, คอลัมน์ขั้นตอนกระจายตามลำดับเวลา
          พร้อมส่งออก CSV/XLSX และ Sync เข้า Google Sheets
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label className="text-xs">เริ่ม</Label>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ถึง</Label>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">หมวดหมู่</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">ทั้งหมด</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            โหลดข้อมูล
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="ค้นหา Job / หมวด"
                className="w-[220px] pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm text-muted-foreground">
          ทั้งหมด {filteredJobs.length} Job
          {selected.size > 0 && ` · เลือก ${selected.size}`} · คอลัมน์ขั้นตอน
          สูงสุด {maxSteps}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onDownloadCsv}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onDownloadXlsx}>
            <Download className="mr-1 h-4 w-4" /> XLSX
          </Button>
          <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Send className="mr-1 h-4 w-4" /> ส่งเข้า Google Sheets
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ส่งข้อมูลเข้า Google Sheets</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Spreadsheet ID</Label>
                  <Input
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="1abc...xyz (ดูใน URL ของชีท)"
                  />
                  <p className="text-xs text-muted-foreground">
                    จาก URL: docs.google.com/spreadsheets/d/<b>SPREADSHEET_ID</b>
                    /edit
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ชื่อ Sheet</Label>
                  <Input
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Sheet1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">โหมด</Label>
                  <Select
                    value={syncMode}
                    onValueChange={(v) => setSyncMode(v as "append" | "replace")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="append">
                        ต่อท้าย (Append) — ใส่ header อัตโนมัติถ้าชีทว่าง
                      </SelectItem>
                      <SelectItem value="replace">
                        เขียนทับ (Replace) — ล้างชีทแล้วเขียนใหม่
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  จะส่ง <b>{rows.length}</b> แถว ({headers.length} คอลัมน์)
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSyncOpen(false)}
                  disabled={syncing}
                >
                  ยกเลิก
                </Button>
                <Button onClick={onSync} disabled={syncing}>
                  {syncing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  ส่งเลย
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Excel-like table */}
      <div className="overflow-auto rounded-md border bg-card">
        <table className="w-max min-w-full text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="sticky left-0 z-20 border-b border-r bg-muted px-2 py-2">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
              </th>
              <th className="border-b border-r bg-muted px-2 py-2 text-left font-semibold whitespace-nowrap">
                วันเริ่ม
              </th>
              <th className="border-b border-r bg-muted px-2 py-2 text-left font-semibold whitespace-nowrap">
                วันจบ
              </th>
              <th className="sticky left-[40px] z-20 border-b border-r bg-muted px-2 py-2 text-left font-semibold">
                Job
              </th>
              <th className="border-b border-r bg-muted px-2 py-2 text-left font-semibold">
                หมวดหมู่
              </th>
              <th className="border-b border-r bg-muted px-2 py-2 text-left font-semibold whitespace-nowrap">
                เวลาเริ่ม
              </th>
              <th className="border-b border-r bg-muted px-2 py-2 text-left font-semibold whitespace-nowrap">
                เวลาจบ
              </th>
              <th className="border-b border-r bg-muted px-2 py-2 text-right font-semibold">
                #ขั้น
              </th>
              {Array.from({ length: maxSteps }).map((_, i) => (
                <th
                  key={i}
                  colSpan={4}
                  className="border-b border-l-2 border-l-primary/40 border-r bg-orange-50 px-2 py-2 text-center font-semibold dark:bg-orange-950/30"
                >
                  ขั้นตอน ({i + 1})
                </th>
              ))}
            </tr>

            <tr>
              <th className="sticky left-0 z-20 border-b bg-muted" />
              <th className="border-b bg-muted" />
              <th className="border-b bg-muted" />
              <th className="sticky left-[40px] z-20 border-b bg-muted" />
              <th className="border-b bg-muted" />
              <th className="border-b bg-muted" />
              <th className="border-b bg-muted" />
              <th className="border-b bg-muted" />
              {Array.from({ length: maxSteps }).map((_, i) => (
                <SubHead key={i} />
              ))}
            </tr>

          </thead>
          <tbody>
            {filteredJobs.map((j) => {
              const checked = selected.has(j.job_id);
              return (
                <tr key={j.job_id} className="even:bg-muted/30 hover:bg-accent/40">
                  <td className="sticky left-0 z-10 border-r bg-inherit px-2 py-1">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleOne(j.job_id, !!v)}
                    />
                  </td>
                  <td className="border-r px-2 py-1 whitespace-nowrap">
                    {fmtDate(j.started_at)}
                  </td>
                  <td className="border-r px-2 py-1 whitespace-nowrap">
                    {fmtDate(j.finished_at)}
                  </td>
                  <td className="sticky left-[40px] z-10 border-r bg-inherit px-2 py-1 font-mono">
                    {j.job_id.slice(0, 8)}
                  </td>
                  <td className="border-r px-2 py-1">{j.category_name ?? "—"}</td>
                  <td className="border-r px-2 py-1 whitespace-nowrap">
                    {fmtTime(j.started_at)}
                  </td>
                  <td className="border-r px-2 py-1 whitespace-nowrap">
                    {fmtTime(j.finished_at)}
                  </td>
                  <td className="border-r px-2 py-1 text-right">{j.step_count}</td>
                  {Array.from({ length: maxSteps }).map((_, i) => {
                    const s = j.steps[i];
                    return (
                      <StepCells key={i} step={s} />
                    );
                  })}
                </tr>
              );
            })}

            {filteredJobs.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6 + maxSteps * 4}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  ยังไม่มีข้อมูล — เลือกช่วงวันที่แล้วกด "โหลดข้อมูล"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function SubHead() {
  return (
    <>
      <th className="border-b border-l-2 border-l-primary/40 bg-orange-100/60 px-2 py-1 text-left text-[10px] font-medium dark:bg-orange-900/20">
        ขั้นตอน
      </th>
      <th className="border-b bg-orange-100/60 px-2 py-1 text-left text-[10px] font-medium dark:bg-orange-900/20">
        พนักงาน
      </th>
      <th className="border-b bg-orange-100/60 px-2 py-1 text-left text-[10px] font-medium dark:bg-orange-900/20">
        เริ่ม
      </th>
      <th className="border-b border-r bg-orange-100/60 px-2 py-1 text-left text-[10px] font-medium dark:bg-orange-900/20">
        จบ
      </th>
    </>
  );
}

function StepCells({
  step,
}: {
  step?: {
    step_name: string;
    employee_name: string;
    emp_code: string | null;
    started_at: string;
    finished_at: string;
  };
}) {
  if (!step) {
    return (
      <>
        <td className="border-l-2 border-l-primary/40 px-2 py-1 text-muted-foreground">—</td>
        <td className="px-2 py-1 text-muted-foreground">—</td>
        <td className="px-2 py-1 text-muted-foreground">—</td>
        <td className="border-r px-2 py-1 text-muted-foreground">—</td>
      </>
    );
  }
  return (
    <>
      <td className="border-l-2 border-l-primary/40 px-2 py-1 whitespace-nowrap">
        {step.step_name}
      </td>
      <td className="px-2 py-1 whitespace-nowrap">
        {step.employee_name}
        {step.emp_code && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            ({step.emp_code})
          </span>
        )}
      </td>
      <td className="px-2 py-1 whitespace-nowrap">{fmt(step.started_at)}</td>
      <td className="border-r px-2 py-1 whitespace-nowrap">{fmt(step.finished_at)}</td>
    </>
  );
}

function fmt(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("th-TH", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
