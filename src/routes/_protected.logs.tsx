import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminFetchLogs } from "@/lib/admin.functions";
import { adminSignMediaUrls } from "@/lib/media.functions";
import { getAdminToken } from "@/lib/auth/admin-session";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { FileText, Image as ImageIcon, Search, Filter, CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_protected/logs")({
  head: () => ({ meta: [{ title: "Production Logs — WSC ProductionTrack" }] }),
  component: LogsPage,
});

interface LogRow {
  id: string;
  job_id: string;
  action: string;
  created_at: string;
  note: string | null;
  note_image_url: string | null;
  category_id: string | null;
  employees: { id: string; name: string } | null;
  steps: { id: string; step_name: string } | null;
  categories: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [onlyNotes, setOnlyNotes] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [appliedFrom, setAppliedFrom] = useState<Date | undefined>(undefined);
  const [appliedTo, setAppliedTo] = useState<Date | undefined>(undefined);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});


  const fetchLogs = useServerFn(adminFetchLogs);
  const signUrls = useServerFn(adminSignMediaUrls);


  useEffect(() => {
    (async () => {
      const token = getAdminToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const [logResp, { data: catData }] = await Promise.all([
          fetchLogs({
            data: {
              token,
              select:
                "id, job_id, action, created_at, note, note_image_url, category_id, employees(id,name), steps(id,step_name), categories(id,name)",
              limit: 1000,
            },
          }),
          supabase.from("categories").select("id,name").eq("active", true).order("name"),
        ]);
        const rows = (logResp.rows as unknown as LogRow[]) ?? [];
        setLogs(rows);
        setCategories((catData as Category[]) ?? []);
        const refs = Array.from(
          new Set(rows.map((r) => r.note_image_url).filter((u): u is string => !!u)),
        );
        if (refs.length > 0) {
          try {
            const { urlMap } = await signUrls({
              data: { token, refs, defaultBucket: "log-notes" },
            });
            setSignedMap(urlMap);
          } catch {
            // Display will fall back to the raw value (legacy public URLs)
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      }
      setLoading(false);
    })();
  }, [fetchLogs, signUrls]);

  const signedSrc = (ref: string) => signedMap[ref] ?? ref;


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = appliedFrom
      ? new Date(appliedFrom).setHours(0, 0, 0, 0)
      : null;
    const toTs = appliedTo
      ? new Date(appliedTo).setHours(23, 59, 59, 999)
      : null;
    return logs.filter((l) => {
      if (categoryFilter !== "all" && l.category_id !== categoryFilter) return false;
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (onlyNotes && !l.note && !l.note_image_url) return false;
      if (fromTs || toTs) {
        const ts = new Date(l.created_at).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      if (q) {
        const hay = `${l.job_id} ${l.employees?.name ?? ""} ${l.steps?.step_name ?? ""} ${l.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, categoryFilter, actionFilter, onlyNotes, appliedFrom, appliedTo]);


  const notesCount = useMemo(
    () => logs.filter((l) => l.note || l.note_image_url).length,
    [logs],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          รายละเอียดบันทึกการผลิต
        </h1>
        <p className="text-sm text-muted-foreground">
          ดูหมายเหตุและรูปภาพปัญหาของแต่ละงาน · มีหมายเหตุทั้งหมด {notesCount} รายการ
        </p>
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ค้นหา Job / พนักงาน / หมายเหตุ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="หมวดหมู่งาน" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="การกระทำ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="start">เริ่ม</SelectItem>
            <SelectItem value="finish">เสร็จ</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
          <input
            type="checkbox"
            checked={onlyNotes}
            onChange={(e) => setOnlyNotes(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          เฉพาะที่มีหมายเหตุ/รูป
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <span className="text-sm font-medium text-muted-foreground">ช่วงวันที่:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", !dateFrom && "text-muted-foreground")}
            >
              <CalendarIcon className="h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd MMM yyyy") : "ตั้งแต่"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground">—</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", !dateTo && "text-muted-foreground")}
            >
              <CalendarIcon className="h-4 w-4" />
              {dateTo ? format(dateTo, "dd MMM yyyy") : "ถึง"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              setAppliedFrom(dateFrom);
              setAppliedTo(dateTo);
            }}
          >
            <Search className="h-3.5 w-3.5" /> ค้นหา
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const t = new Date();
              const f = new Date(t.getFullYear(), t.getMonth(), t.getDate());
              setDateFrom(f);
              setDateTo(t);
              setAppliedFrom(f);
              setAppliedTo(t);
            }}
          >
            วันนี้
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const t = new Date();
              const f = new Date();
              f.setDate(t.getDate() - 6);
              setDateFrom(f);
              setDateTo(t);
              setAppliedFrom(f);
              setAppliedTo(t);
            }}
          >
            7 วัน
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const t = new Date();
              const f = new Date();
              f.setDate(t.getDate() - 29);
              setDateFrom(f);
              setDateTo(t);
              setAppliedFrom(f);
              setAppliedTo(t);
            }}
          >
            30 วัน
          </Button>
          {(dateFrom || dateTo || appliedFrom || appliedTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => {
                setDateFrom(undefined);
                setDateTo(undefined);
                setAppliedFrom(undefined);
                setAppliedTo(undefined);
              }}
            >
              <X className="h-3.5 w-3.5" /> ล้าง
            </Button>
          )}
        </div>
      </div>


      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">ไม่พบข้อมูล</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-3">เวลา</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">หมวดหมู่</th>
                  <th className="px-4 py-3">พนักงาน</th>
                  <th className="px-4 py-3">ขั้นตอน</th>
                  <th className="px-4 py-3">การกระทำ</th>
                  <th className="px-4 py-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => {
                  const hasNote = !!(l.note || l.note_image_url);
                  return (
                    <tr
                      key={l.id}
                      onClick={() => hasNote && setSelected(l)}
                      className={hasNote ? "cursor-pointer hover:bg-muted/40" : ""}
                    >
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("th-TH")}
                      </td>
                      <td className="px-4 py-2 font-mono font-semibold text-primary">
                        {l.job_id}
                      </td>
                      <td className="px-4 py-2">
                        {l.categories?.name ? (
                          <Badge variant="outline">{l.categories.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {l.employees?.name ?? (
                          <span className="text-xs italic text-muted-foreground">
                            พนักงานถูกลบ
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2">{l.steps?.step_name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            l.action === "finish"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary/15 text-secondary"
                          }`}
                        >
                          {l.action === "finish" ? "เสร็จ" : "เริ่ม"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {hasNote ? (
                          <div className="flex items-center gap-2 text-xs">
                            {l.note && <FileText className="h-4 w-4 text-secondary" />}
                            {l.note_image_url && (
                              <ImageIcon className="h-4 w-4 text-secondary" />
                            )}
                            <span className="max-w-[200px] truncate text-muted-foreground">
                              {l.note ?? "(มีรูปภาพ)"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>รายละเอียดหมายเหตุ</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Info label="Job" value={selected.job_id} mono />
                <Info
                  label="เวลา"
                  value={new Date(selected.created_at).toLocaleString("th-TH")}
                />
                <Info label="พนักงาน" value={selected.employees?.name ?? "พนักงานถูกลบ"} />
                <Info label="ขั้นตอน" value={selected.steps?.step_name ?? "—"} />
                <Info label="หมวดหมู่" value={selected.categories?.name ?? "—"} />
                <Info
                  label="การกระทำ"
                  value={selected.action === "finish" ? "เสร็จ" : "เริ่ม"}
                />
              </div>
              {selected.note && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    หมายเหตุ
                  </div>
                  <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3">
                    {selected.note}
                  </p>
                </div>
              )}
              {selected.note_image_url && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    รูปภาพแนบ
                  </div>
                  <a
                    href={signedSrc(selected.note_image_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={signedSrc(selected.note_image_url)}
                      alt="note"
                      className="max-h-96 w-full object-contain bg-muted"

                    />
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono font-semibold text-primary" : "font-medium"}>
        {value}
      </div>
    </div>
  );
}
