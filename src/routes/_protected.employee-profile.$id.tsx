// Production profile for a single production employee.
// Daily timeline of paired start/finish logs vs production_standards.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetEmployeeTimeline } from "@/lib/features/production-monitor.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialsOf } from "@/lib/utils/i18n";
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle, Flame, Activity } from "lucide-react";
import { AppVersion } from "@/components/AppVersion";

export const Route = createFileRoute("/_protected/employee-profile/$id")({
  head: () => ({ meta: [{ title: "โปรไฟล์การผลิต — WSC ProductionTrack" }] }),
  component: EmployeeProfilePage,
});

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(sec: number) {
  if (sec < 60) return `${sec} วิ`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} น.` : `${m} นาที`;
}

type Row = {
  job_id: string;
  step_name: string;
  category_name: string | null;
  started_at: string;
  finished_at: string;
  actual_seconds: number;
  target_seconds: number | null;
  exceeded: boolean;
};

function EmployeeProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getTimeline = useServerFn(adminGetEmployeeTimeline);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<{
    name: string; emp_code: string | null; avatar_url: string | null; nationality: string | null;
  } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ finished_count: 0, total_seconds: 0, exceeded_count: 0, is_red: false, threshold: 3 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTimeline({ data: { token: requireToken(), employee_id: id, date } });
      setEmployee(res.employee as typeof employee);
      setRows(res.rows);
      setStats(res.stats);
    } catch (err) { showError(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, date]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/manage" })} className="mb-3 gap-1">
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าพนักงาน
      </Button>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {employee?.avatar_url && <AvatarImage src={employee.avatar_url} />}
            <AvatarFallback className="bg-muted">{employee ? initialsOf(employee.name) : "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold tracking-tight">{employee?.name ?? "—"}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {employee?.emp_code && <span className="font-mono">{employee.emp_code}</span>}
              {employee?.nationality && <Badge variant="secondary">{employee.nationality}</Badge>}
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">ฝ่ายผลิต</Badge>
              {stats.is_red && (
                <Badge variant="destructive" className="gap-1">
                  <Flame className="h-3 w-3" /> เกินมาตรฐาน ≥ {stats.threshold} ครั้งวันนี้
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">วันที่</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={CheckCircle2} color="text-emerald-600" label="ชิ้น/รอบที่เสร็จ" value={String(stats.finished_count)} />
          <StatCard icon={Clock} color="text-blue-600" label="เวลาทำงานรวม" value={fmtDuration(stats.total_seconds)} />
          <StatCard icon={AlertTriangle} color={stats.exceeded_count > 0 ? "text-rose-600" : "text-muted-foreground"} label="เกินเวลามาตรฐาน" value={`${stats.exceeded_count} ครั้ง`} />
          <StatCard icon={Activity} color={stats.is_red ? "text-rose-600" : "text-muted-foreground"} label="สถานะวันนี้" value={stats.is_red ? "🔴 ไฟแดง" : "🟢 ปกติ"} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">ไทม์ไลน์การปฏิบัติงาน</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            ไม่มีบันทึกการทำงานในวันนี้
          </div>
        ) : (
          <ol className="space-y-3">
            {rows.map((r, idx) => {
              const target = r.target_seconds;
              const pct = target ? Math.min(200, Math.round((r.actual_seconds / target) * 100)) : 100;
              return (
                <li key={`${r.job_id}-${idx}`} className={`relative rounded-xl border p-4 ${r.exceeded ? "border-rose-300 bg-rose-50/50 dark:bg-rose-950/20" : "border-border bg-background"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">{fmtTime(r.started_at)} → {fmtTime(r.finished_at)}</div>
                      <div className="mt-0.5 font-semibold">{r.step_name}</div>
                      <div className="text-xs text-muted-foreground">Job: <span className="font-mono">{r.job_id}</span>{r.category_name && <> • หมวดหมู่: {r.category_name}</>}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${r.exceeded ? "text-rose-600" : "text-emerald-600"}`}>{fmtDuration(r.actual_seconds)}</div>
                      <div className="text-xs text-muted-foreground">มาตรฐาน: {target ? fmtDuration(target) : "—"}</div>
                    </div>
                  </div>
                  {target && (
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${r.exceeded ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  )}
                  <div className="mt-1">
                    {r.exceeded ? (
                      <span className="text-xs font-semibold text-rose-600">🔴 เกินเวลามาตรฐาน</span>
                    ) : target ? (
                      <span className="text-xs font-semibold text-emerald-600">🟢 ผ่านเกณฑ์</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">— ยังไม่ได้ตั้งค่ามาตรฐาน — <Link to="/production-standards" className="underline">ตั้งค่า</Link></span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-6 flex justify-center"><AppVersion /></div>
    </main>
  );
}

function StatCard({ icon: Icon, color, label, value }: { icon: typeof Clock; color: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
