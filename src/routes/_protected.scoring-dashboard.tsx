import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { Trophy, RefreshCw, Loader2, Zap, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { requireToken, showError } from "@/lib/admin-helpers";
import { adminScoringOverview, adminBackfillScores } from "@/lib/scoring-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_protected/scoring-dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ดคะแนนพนักงาน — WSC ProductionTrack" }] }),
  component: Page,
});

type Overview = Awaited<ReturnType<typeof import("@/lib/scoring-admin.functions").adminScoringOverview>> extends infer T
  ? T extends { leaderboard: infer L } ? { leaderboard: L; bottlenecks: any[]; total_points: number; total_scored: number; on_time_pct: number; range: string } : never
  : never;

function Page() {
  const fn = useServerFn(adminScoringOverview);
  const backfill = useServerFn(adminBackfillScores);
  const [range, setRange] = useState<"today" | "week" | "month">("week");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const r = await fn({ data: { token, range } });
      setData(r as unknown as Overview);
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  }, [fn, range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Toaster richColors />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> แดชบอร์ดคะแนนพนักงาน</h2>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
            {(["today", "week", "month"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1 rounded ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {r === "today" ? "วันนี้" : r === "week" ? "สัปดาห์" : "เดือน"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={async () => {
            try { const r = await backfill({ data: { token: requireToken(), days: 30 } }); toast.success(`Backfill: เพิ่มคะแนน ${r.inserted} รายการ`); load(); }
            catch (e) { showError(e); }
          }}>Backfill 30 วัน</Button>
          <Link to="/scoring-standards"><Button size="sm">มาตรฐานคะแนน</Button></Link>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card><CardHeader><CardTitle className="text-sm">คะแนนรวม</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{data.total_points.toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">รอบงานที่นับ</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{data.total_scored.toLocaleString()}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">% ทันเวลา</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold text-emerald-600">{data.on_time_pct}%</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> อันดับพนักงาน</CardTitle></CardHeader>
            <CardContent>
              {data.leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล — ตรวจสอบว่าตั้งมาตรฐานและมีงาน finish ในช่วงนี้</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead className="text-right">คะแนน</TableHead>
                      <TableHead className="text-right">รอบงาน</TableHead>
                      <TableHead className="text-right">โบนัส</TableHead>
                      <TableHead className="text-right">ทันเวลา</TableHead>
                      <TableHead className="text-right">เลท</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.leaderboard as any[]).map((e, i) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell>{e.name}</TableCell>
                        <TableCell className="text-right font-semibold">{e.points}</TableCell>
                        <TableCell className="text-right">{e.count}</TableCell>
                        <TableCell className="text-right text-amber-600">{e.bonus}</TableCell>
                        <TableCell className="text-right text-emerald-600">{e.on_time}</TableCell>
                        <TableCell className="text-right text-rose-600">{e.late}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> ขั้นตอนเจ้าปัญหา (% Late)</CardTitle></CardHeader>
            <CardContent>
              {data.bottlenecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีขั้นตอนที่ Late บ่อย</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.bottlenecks as any[]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Bar dataKey="late_pct" fill="hsl(0 72% 51%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
