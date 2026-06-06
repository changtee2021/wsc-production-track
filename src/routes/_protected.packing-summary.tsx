import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminFetchPackingSummary } from "@/lib/admin.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Loader2, RefreshCw, BarChart3, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_protected/packing-summary")({
  head: () => ({ meta: [{ title: "สรุปแพ็คของ — WSC ProductionTrack" }] }),
  component: PackingSummaryPage,
});

type Bucket = { key: string; total: number; pass: number; fail: number; unknown: number };
type Totals = { total: number; pass: number; fail: number; unknown: number };

const PASS_COLOR = "hsl(142 71% 45%)";
const FAIL_COLOR = "hsl(0 72% 51%)";
const UNKNOWN_COLOR = "hsl(220 9% 60%)";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function defaultRange(granularity: "day" | "month"): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (granularity === "day") from.setDate(from.getDate() - 29);
  else from.setMonth(from.getMonth() - 11);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function PackingSummaryPage() {
  const fetchSummary = useServerFn(adminFetchPackingSummary);
  const [granularity, setGranularity] = useState<"day" | "month">("day");
  const [{ from, to }, setRange] = useState(() => defaultRange("day"));
  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [byCategory, setByCategory] = useState<Bucket[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, pass: 0, fail: 0, unknown: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIsoEnd = new Date(`${to}T23:59:59.999`).toISOString();
      const res = await fetchSummary({
        data: { token, from: fromIso, to: toIsoEnd, granularity },
      });
      setBuckets(res.buckets);
      setByCategory(res.byCategory);
      setTotals(res.totals);
    } catch (e) {
      showError(e, "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, from, to, granularity]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeGranularity = (g: "day" | "month") => {
    setGranularity(g);
    setRange(defaultRange(g));
  };

  const pieData = useMemo(
    () => [
      { name: "ผ่าน", value: totals.pass, color: PASS_COLOR },
      { name: "ไม่ผ่าน", value: totals.fail, color: FAIL_COLOR },
      { name: "ไม่ระบุ", value: totals.unknown, color: UNKNOWN_COLOR },
    ],
    [totals],
  );

  const passRate = totals.total ? (totals.pass / totals.total) * 100 : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <Toaster richColors position="top-center" />
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">สรุปแพ็คของ</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>ช่วงการสรุป</Label>
            <Select value={granularity} onValueChange={(v) => onChangeGranularity(v as "day" | "month")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">รายวัน</SelectItem>
                <SelectItem value="month">รายเดือน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>จากวันที่</Label>
            <Input type="date" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div>
            <Label>ถึงวันที่</Label>
            <Input type="date" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={load} disabled={loading} className="w-full md:w-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              โหลดข้อมูล
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">งานแพ็คของ ทั้งหมด</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">อัตราผ่าน {passRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" />ผ่าน</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{totals.pass.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{pct(totals.pass, totals.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1 text-muted-foreground"><XCircle className="h-4 w-4 text-red-600" />ไม่ผ่าน</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{totals.fail.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{pct(totals.fail, totals.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1 text-muted-foreground"><HelpCircle className="h-4 w-4" />ยังไม่ระบุผล</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.unknown.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{pct(totals.unknown, totals.total)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Trend bar chart */}
      <Card>
        <CardHeader><CardTitle>แนวโน้ม{granularity === "day" ? "รายวัน" : "รายเดือน"}</CardTitle></CardHeader>
        <CardContent className="h-[320px]">
          {buckets.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">ไม่มีข้อมูลในช่วงนี้</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pass" stackId="a" fill={PASS_COLOR} name="ผ่าน" />
                <Bar dataKey="fail" stackId="a" fill={FAIL_COLOR} name="ไม่ผ่าน" />
                <Bar dataKey="unknown" stackId="a" fill={UNKNOWN_COLOR} name="ไม่ระบุ" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie */}
        <Card>
          <CardHeader><CardTitle>สัดส่วนผลตรวจ</CardTitle></CardHeader>
          <CardContent className="h-[320px]">
            {totals.total === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label>
                    {pieData.map((d) => (<Cell key={d.name} fill={d.color} />))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By category */}
        <Card>
          <CardHeader><CardTitle>แยกตามหมวด</CardTitle></CardHeader>
          <CardContent className="h-[320px]">
            {byCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="key" type="category" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pass" stackId="c" fill={PASS_COLOR} name="ผ่าน" />
                  <Bar dataKey="fail" stackId="c" fill={FAIL_COLOR} name="ไม่ผ่าน" />
                  <Bar dataKey="unknown" stackId="c" fill={UNKNOWN_COLOR} name="ไม่ระบุ" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>ตารางสรุป</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{granularity === "day" ? "วันที่" : "เดือน"}</TableHead>
                <TableHead className="text-right">รวม</TableHead>
                <TableHead className="text-right text-green-600">ผ่าน</TableHead>
                <TableHead className="text-right text-red-600">ไม่ผ่าน</TableHead>
                <TableHead className="text-right">ไม่ระบุ</TableHead>
                <TableHead className="text-right">อัตราผ่าน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
              ) : (
                buckets.map((b) => (
                  <TableRow key={b.key}>
                    <TableCell className="font-mono">{b.key}</TableCell>
                    <TableCell className="text-right">{b.total}</TableCell>
                    <TableCell className="text-right text-green-600">{b.pass}</TableCell>
                    <TableCell className="text-right text-red-600">{b.fail}</TableCell>
                    <TableCell className="text-right">{b.unknown}</TableCell>
                    <TableCell className="text-right">{pct(b.pass, b.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
