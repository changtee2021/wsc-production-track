// หน้า Server Logs — บันทึก SSR/route/health error ย้อนหลัง
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ScrollText, Search, Loader2, Activity, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, XCircle, Trash2, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  adminListErrorLogs, adminRunSsrHealthCheck, adminClearErrorLogs,
  type ErrorLogRow, type HealthCheckItem,
} from "@/lib/features/error-logs.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";

export const Route = createFileRoute("/_protected/server-logs")({
  head: () => ({ meta: [{ title: "Server Logs — WSC" }] }),
  component: ServerLogsPage,
});

function fmtDateTime(iso: string): string {
  try { return new Date(iso).toLocaleString("th-TH"); } catch { return iso; }
}

function ServerLogsPage() {
  const listFn = useServerFn(adminListErrorLogs);
  const healthFn = useServerFn(adminRunSsrHealthCheck);
  const clearFn = useServerFn(adminClearErrorLogs);

  const [days, setDays] = useState("7");
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rows, setRows] = useState<ErrorLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthCheckItem[] | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn({
        data: {
          token: requireToken(),
          days: Number(days),
          level: level as "all" | "error" | "warn",
          source: source as "all" | "ssr" | "route" | "client" | "health",
          search,
        },
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) { showError(e, "โหลดไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [listFn, days, level, source, search]);

  useEffect(() => { load(); }, [load]);

  const onHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const res = await healthFn({ data: { token: requireToken() } });
      setHealth(res.items);
      toast.success(res.healthy ? "ทุก route ปกติ" : "พบ route ที่มีปัญหา");
      void load();
    } catch (e) { showError(e, "ตรวจไม่สำเร็จ"); setHealth([]); }
    finally { setHealthLoading(false); }
  };

  const onClear = async () => {
    if (!confirm("ลบ error logs ทั้งหมด?")) return;
    try {
      await clearFn({ data: { token: requireToken() } });
      toast.success("ลบแล้ว");
      load();
    } catch (e) { showError(e, "ลบไม่สำเร็จ"); }
  };

  return (
    <div className="space-y-4">
      <Toaster richColors position="top-center" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Server Logs</h1>
            <p className="text-sm text-muted-foreground">
              บันทึก SSR/route error ย้อนหลัง ไว้ไล่หาสาเหตุ Internal Server Error
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onHealthCheck} disabled={healthLoading} variant="outline" size="sm">
            {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            รันสุขภาพรูทหลัก
          </Button>
          <Button onClick={onClear} variant="ghost" size="sm" className="text-rose-600">
            <Trash2 className="h-4 w-4" />
            ล้าง
          </Button>
        </div>
      </div>

      {health && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ผลตรวจสุขภาพ SSR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {health.length === 0 ? (
              <p className="text-sm text-destructive">ตรวจไม่สำเร็จ</p>
            ) : (
              health.map((h) => (
                <Badge key={h.path} variant={h.ok ? "secondary" : "destructive"} className="gap-1 font-mono">
                  {h.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {h.path} · {h.status || "ERR"} · {h.ms}ms
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
                placeholder="ค้นข้อความ / route แล้วกด Enter"
                className="pl-8"
              />
            </div>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 วัน</SelectItem>
                <SelectItem value="7">7 วัน</SelectItem>
                <SelectItem value="14">14 วัน</SelectItem>
                <SelectItem value="30">30 วัน</SelectItem>
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับ</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกแหล่ง</SelectItem>
                <SelectItem value="ssr">SSR</SelectItem>
                <SelectItem value="route">Route</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="health">Health</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={load} variant="outline" size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
              ไม่พบ error ในช่วงเวลานี้
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">พบ {total} รายการ</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[170px]">เวลา</TableHead>
                      <TableHead className="w-[80px]">ระดับ</TableHead>
                      <TableHead className="w-[80px]">แหล่ง</TableHead>
                      <TableHead className="w-[140px]">Route</TableHead>
                      <TableHead>ข้อความ</TableHead>
                      <TableHead className="w-[60px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <Fragment key={row.id}>
                        <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                          <TableCell className="whitespace-nowrap text-xs">
                            <span className="inline-flex items-center gap-1">
                              {expanded === row.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {fmtDateTime(row.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.level === "error" ? "destructive" : "secondary"}>
                              {row.level}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{row.source}</TableCell>
                          <TableCell className="font-mono text-xs">{row.route_path ?? "-"}</TableCell>
                          <TableCell className="max-w-[400px] truncate text-xs">{row.message}</TableCell>
                          <TableCell className="text-xs">{row.status_code ?? "-"}</TableCell>
                        </TableRow>
                        {expanded === row.id && (
                          <TableRow key={`${row.id}-detail`}>
                            <TableCell colSpan={6} className="bg-muted/40">
                              <div className="space-y-1 py-2 text-xs">
                                <p className="font-semibold">ข้อความเต็ม</p>
                                <pre className="whitespace-pre-wrap break-all">{row.message}</pre>
                                {row.request_url && (
                                  <p className="text-muted-foreground">URL: {row.request_url}</p>
                                )}
                                {row.user_agent && (
                                  <p className="text-muted-foreground">UA: {row.user_agent}</p>
                                )}
                                {row.stack && (
                                  <>
                                    <p className="mt-2 font-semibold">Stack trace</p>
                                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2">
                                      {row.stack}
                                    </pre>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!loading && rows.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          แอปจะบันทึก error อัตโนมัติเมื่อเกิด Internal Server Error · กดทดสอบที่{" "}
          <a href="/__throw-test" className="underline">/__throw-test</a> เพื่อจำลอง
        </p>
      )}
    </div>
  );
}
