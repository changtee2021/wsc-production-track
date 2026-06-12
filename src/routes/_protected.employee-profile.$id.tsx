// Aggregated employee profile across all 5 departments.
// Route param `id` is a base64url-encoded "name|emp_code" staff key.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetEmployeeAggregateProfile } from "@/lib/features/employee-profile.functions";
import { decodeStaffKey } from "@/lib/utils/staff-key";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialsOf } from "@/lib/utils/i18n";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Wrench,
  Package,
  ShieldCheck,
  Receipt,
  Boxes,
} from "lucide-react";
import { AppVersion } from "@/components/AppVersion";

export const Route = createFileRoute("/_protected/employee-profile/$id")({
  head: () => ({ meta: [{ title: "โปรไฟล์พนักงาน — WSC ProductionTrack" }] }),
  component: EmployeeProfilePage,
});

const DEPT_LABEL: Record<string, string> = {
  production: "ผลิต",
  qc: "QC",
  packing: "แพ็ค",
  maintenance: "ซ่อม",
  office: "ออฟฟิศ",
};
const DEPT_COLOR: Record<string, string> = {
  production: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  qc: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  packing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  maintenance: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  office: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}
function fmtDuration(sec: number) {
  if (sec < 60) return `${sec} วิ`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} ชม. ${m % 60} นาที`;
  const s = sec % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} น.` : `${m} นาที`;
}

type Range = "day" | "week" | "month";

function EmployeeProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getProfile = useServerFn(adminGetEmployeeAggregateProfile);
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState<Range>("day");
  const [anchor, setAnchor] = useState(today);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof adminGetEmployeeAggregateProfile>
  > | null>(null);

  const decoded = useMemo(() => decodeStaffKey(id), [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getProfile({
        data: {
          token: requireToken(),
          name: decoded.name,
          emp_code: decoded.emp_code,
          range,
          anchor,
        },
      });
      setData(res);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id, range, anchor]);

  const emp = data?.employee;
  const prod = data?.production;
  const rangeLabel = range === "day" ? "วันนี้" : range === "week" ? "สัปดาห์" : "เดือน";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/manage", search: {} })}
        className="mb-3 gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าพนักงาน
      </Button>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {emp?.avatar_url && <AvatarImage src={emp.avatar_url} />}
            <AvatarFallback className="bg-muted">{emp ? initialsOf(emp.name) : "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold tracking-tight">{emp?.name ?? decoded.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {emp?.emp_code && <span className="font-mono">{emp.emp_code}</span>}
              {emp?.nationality && <Badge variant="secondary">{emp.nationality}</Badge>}
              {(emp?.departments ?? []).map((d) => (
                <Badge key={d} className={DEPT_COLOR[d]}>
                  {DEPT_LABEL[d]}
                </Badge>
              ))}
              {prod?.is_red && (
                <Badge variant="destructive" className="gap-1">
                  <Flame className="h-3 w-3" /> ไฟแดง (เกินมาตรฐานครบเกณฑ์)
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              {(["day", "week", "month"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    range === r
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {r === "day" ? "วัน" : r === "week" ? "สัปดาห์" : "เดือน"}
                </button>
              ))}
            </div>
            <Input
              type="date"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
              className="h-9 w-44"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={CheckCircle2}
            color="text-emerald-600"
            label={`ชิ้น/รอบที่เสร็จ (${rangeLabel})`}
            value={String(prod?.finished_count ?? 0)}
          />
          <StatCard
            icon={Clock}
            color="text-blue-600"
            label="เวลาทำงานรวม"
            value={fmtDuration(prod?.total_seconds ?? 0)}
          />
          <StatCard
            icon={AlertTriangle}
            color={(prod?.exceeded_count ?? 0) > 0 ? "text-rose-600" : "text-muted-foreground"}
            label="เกินเวลามาตรฐาน"
            value={`${prod?.exceeded_count ?? 0} ครั้ง`}
          />
          <StatCard
            icon={Activity}
            color={prod?.is_red ? "text-rose-600" : "text-emerald-600"}
            label="สถานะ"
            value={prod?.is_red ? "🔴 ไฟแดง" : "🟢 ปกติ"}
          />
        </div>
      </section>

      <Tabs defaultValue="production" className="mt-5">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
          <TabsTrigger value="production" className="gap-1">
            <Activity className="h-3.5 w-3.5" />
            ผลิต ({prod?.finished_count ?? 0})
          </TabsTrigger>
          <TabsTrigger value="qc" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            QC ({data?.qc.count ?? 0})
          </TabsTrigger>
          <TabsTrigger value="packing" className="gap-1">
            <Package className="h-3.5 w-3.5" />
            แพ็ค ({data?.packing.count ?? 0})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1">
            <Wrench className="h-3.5 w-3.5" />
            ซ่อม ({data?.maintenance.count ?? 0})
          </TabsTrigger>
          <TabsTrigger value="office" className="gap-1">
            <Boxes className="h-3.5 w-3.5" />
            ออฟฟิศ ({(data?.office.count ?? 0) + (data?.expenses.count ?? 0)})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="production">
          <Section title="ไทม์ไลน์การปฏิบัติงาน">
            {loading ? (
              <Loader />
            ) : !prod || prod.rows.length === 0 ? (
              <Empty>ไม่มีบันทึกการทำงานในช่วงเวลานี้</Empty>
            ) : (
              <ol className="space-y-3">
                {prod.rows.map((r, idx) => {
                  const target = r.target_seconds;
                  const pct = target
                    ? Math.min(200, Math.round((r.actual_seconds / target) * 100))
                    : 100;
                  return (
                    <li
                      key={`${r.job_id}-${idx}`}
                      className={`relative rounded-xl border p-4 ${r.exceeded ? "border-rose-300 bg-rose-50/50 dark:bg-rose-950/20" : "border-border bg-background"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {fmtTime(r.started_at)} → {fmtTime(r.finished_at)} ·{" "}
                            {new Date(r.finished_at).toLocaleDateString("th-TH")}
                          </div>
                          <div className="mt-0.5 font-semibold">{r.step_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Job: <span className="font-mono">{r.job_id}</span>
                            {r.category_name && <> • {r.category_name}</>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${r.exceeded ? "text-rose-600" : "text-emerald-600"}`}
                          >
                            {fmtDuration(r.actual_seconds)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            มาตรฐาน: {target ? fmtDuration(target) : "—"}
                          </div>
                        </div>
                      </div>
                      {target && (
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${r.exceeded ? "bg-rose-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      )}
                      <div className="mt-1">
                        {r.exceeded ? (
                          <span className="text-xs font-semibold text-rose-600">
                            🔴 เกินเวลามาตรฐาน
                          </span>
                        ) : target ? (
                          <span className="text-xs font-semibold text-emerald-600">
                            🟢 ผ่านเกณฑ์
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            — ยังไม่ตั้งค่ามาตรฐาน —{" "}
                            <Link to="/production-setup" search={{}} className="underline">
                              ตั้งค่า
                            </Link>
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="qc">
          <Section title="รายงาน QC">
            {loading ? (
              <Loader />
            ) : (data?.qc.rows.length ?? 0) === 0 ? (
              <Empty>ไม่มีรายงาน QC</Empty>
            ) : (
              <ul className="space-y-2">
                {data!.qc.rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        Job: <span className="font-mono">{r.job_id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(r.created_at)}
                      </div>
                    </div>
                    {r.overall_result && (
                      <Badge variant={r.overall_result === "pass" ? "default" : "destructive"}>
                        {r.overall_result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="packing">
          <Section title="รายงานแพ็ค">
            {loading ? (
              <Loader />
            ) : (data?.packing.rows.length ?? 0) === 0 ? (
              <Empty>ไม่มีรายงานแพ็ค</Empty>
            ) : (
              <ul className="space-y-2">
                {data!.packing.rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        Job: <span className="font-mono">{r.job_id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(r.created_at)}
                      </div>
                    </div>
                    {r.overall_result && (
                      <Badge variant={r.overall_result === "pass" ? "default" : "destructive"}>
                        {r.overall_result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="maintenance">
          <Section title="งานซ่อมบำรุง (Ticket)">
            {loading ? (
              <Loader />
            ) : (data?.maintenance.rows.length ?? 0) === 0 ? (
              <Empty>ไม่มี ticket</Empty>
            ) : (
              <ul className="space-y-2">
                {data!.maintenance.rows.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border bg-background p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{r.ticket_no}</span>
                      <Badge variant="secondary">{r.status}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {fmtDateTime(r.reported_at)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm">{r.problem_text}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="office">
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="คำขอเบิกออฟฟิศ">
              {loading ? (
                <Loader />
              ) : (data?.office.rows.length ?? 0) === 0 ? (
                <Empty>ไม่มีคำขอ</Empty>
              ) : (
                <ul className="space-y-2">
                  {data!.office.rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm"
                    >
                      <div>
                        <div className="font-mono font-semibold">{r.req_no}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDateTime(r.created_at)}
                        </div>
                      </div>
                      <Badge variant="secondary">{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section
              title={`ค่าใช้จ่าย (${data?.expenses.count ?? 0} รายการ · ${(data?.expenses.total ?? 0).toLocaleString("th-TH", { style: "currency", currency: "THB" })})`}
            >
              {loading ? (
                <Loader />
              ) : (data?.expenses.rows.length ?? 0) === 0 ? (
                <Empty>ไม่มีค่าใช้จ่าย</Empty>
              ) : (
                <ul className="space-y-2">
                  {data!.expenses.rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-3.5 w-3.5" />
                          <span className="font-mono font-semibold">{r.exp_no}</span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.merchant_name ?? "—"} · {fmtDateTime(r.created_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          ฿ {Number(r.total_amount).toLocaleString("th-TH")}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-center">
        <AppVersion />
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof Clock;
  color: string;
  label: string;
  value: string;
}) {
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
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
function Loader() {
  return <div className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
