// Popup version of the employee profile page.
// Mirrors src/routes/_protected.employee-profile.$id.tsx but in a Dialog,
// adds Export (CSV + XLSX).
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { adminGetEmployeeAggregateProfile } from "@/lib/features/employee-profile.functions";
import { employeeGetMyProfile } from "@/lib/features/employee-auth.functions";
import { getEmployeeToken } from "@/lib/auth/employee-session";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { downloadProfileXlsx } from "@/lib/utils/production-export";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialsOf } from "@/lib/utils/i18n";
import { todayBangkok } from "@/lib/utils/bangkok-date";
import { cn } from "@/lib/utils";
import {
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
  Download,
  BarChart3,
  Home,
  LayoutDashboard,
  ListTree,
} from "lucide-react";

type Target = { name: string; emp_code: string | null };
type Range = "day" | "month";
type ProfileTab = "production" | "qc" | "packing" | "maintenance" | "office";
type ProfilePanel = "work" | "dashboard";

const PROFILE_TABS: ProfileTab[] = ["production", "qc", "packing", "maintenance", "office"];
const OTHER_TABS: ProfileTab[] = ["qc", "packing", "maintenance", "office"];

const DEPT_LABEL: Record<string, string> = {
  production: "ผลิต",
  qc: "QC",
  packing: "แพ็ค",
  maintenance: "ซ่อม",
  office: "ออฟฟิศ",
  stock: "สต๊อก",
};
const DEPT_COLOR: Record<string, string> = {
  production: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  qc: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  packing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  maintenance: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  office: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  stock: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
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

export function EmployeeProfileDialog({
  target,
  onClose,
  mode = "admin",
}: {
  target: Target | null;
  onClose: () => void;
  /** admin = admin token; self = logged-in employee token (identity from session). */
  mode?: "admin" | "self";
}) {
  const getAdminProfile = useServerFn(adminGetEmployeeAggregateProfile);
  const getMyProfile = useServerFn(employeeGetMyProfile);
  const today = todayBangkok();
  const [range, setRange] = useState<Range>("day");
  const [dayFrom, setDayFrom] = useState(today);
  const [dayTo, setDayTo] = useState(today);
  const [monthValue, setMonthValue] = useState(today.slice(0, 7));
  const [panel, setPanel] = useState<ProfilePanel>("work");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof adminGetEmployeeAggregateProfile>
  > | null>(null);

  const anchor = range === "day" ? dayFrom : `${monthValue}-01`;
  const from = range === "day" ? dayFrom : null;
  const to = range === "day" ? dayTo : null;

  useEffect(() => {
    if (!target) {
      setData(null);
      setPanel("work");
      return;
    }
    setLoading(true);
    const payload = {
      range,
      anchor,
      from,
      to,
    };
    const run =
      mode === "self"
        ? (() => {
            const token = getEmployeeToken();
            if (!token) return Promise.reject(new Error("กรุณาเข้าสู่ระบบพนักงานก่อน"));
            return getMyProfile({ data: { token, ...payload } });
          })()
        : getAdminProfile({
            data: {
              token: requireToken(),
              name: target.name,
              emp_code: target.emp_code,
              ...payload,
            },
          });
    run
      .then(setData)
      .catch(showError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, range, anchor, from, to, mode]);

  const emp = data?.employee;
  const prod = data?.production;
  const rangeLabel =
    range === "day"
      ? dayFrom === dayTo
        ? dayFrom === today
          ? "วันนี้"
          : "วันที่เลือก"
        : `${dayFrom} → ${dayTo}`
      : monthValue;

  // Show only department tabs matching this employee's assigned duties.
  // Office staff can view all tabs (same oversight scope as floor buttons).
  const visibleTabs = useMemo(() => {
    const depts = emp?.departments ?? [];
    if (depts.includes("office")) return [...PROFILE_TABS];
    return PROFILE_TABS.filter((t) => depts.includes(t));
  }, [emp?.departments]);

  const hasProduction = visibleTabs.includes("production");
  const otherTabs = useMemo(() => OTHER_TABS.filter((t) => visibleTabs.includes(t)), [visibleTabs]);

  const [tab, setTab] = useState<ProfileTab>("qc");
  useEffect(() => {
    if (otherTabs.length === 0) return;
    if (!otherTabs.includes(tab)) setTab(otherTabs[0]);
  }, [otherTabs, tab]);

  const exportXlsx = () => {
    if (!data) return;
    const safe = (emp?.name ?? "employee").replace(/[^\p{L}\p{N}_-]+/gu, "_");
    const rangeTag = range === "day" ? `${dayFrom}_${dayTo}` : monthValue;
    downloadProfileXlsx(`profile_${safe}_${range}_${rangeTag}`, {
      สรุป: [
        {
          ชื่อ: emp?.name ?? "",
          รหัส: emp?.emp_code ?? "",
          แผนก: (emp?.departments ?? []).map((d) => DEPT_LABEL[d] ?? d).join(", "),
          ช่วง: rangeLabel,
          "เสร็จ(ผลิต)": prod?.finished_count ?? 0,
          "เวลารวม(วิ)": prod?.total_seconds ?? 0,
          เกินมาตรฐาน: prod?.exceeded_count ?? 0,
          ไฟแดง: prod?.is_red ? "🔴" : "",
          QC: data.qc.count,
          แพ็ค: data.packing.count,
          ซ่อม: data.maintenance.count,
          ออฟฟิศ: data.office.count,
          ค่าใช้จ่าย: data.expenses.count,
        },
      ],
      Production: (prod?.rows ?? []).map((r) => ({
        Job: r.job_id,
        ขั้นตอน: r.step_name,
        หมวด: r.category_name ?? "",
        เริ่ม: fmtDateTime(r.started_at),
        เสร็จ: fmtDateTime(r.finished_at),
        "เวลาจริง(วิ)": r.actual_seconds,
        "มาตรฐาน(วิ)": r.target_seconds ?? "",
        เกิน: r.exceeded ? "เกิน" : "",
      })),
      ProductionSteps: (prod?.steps ?? []).map((s) => ({
        ขั้นตอน: s.step_name,
        จำนวนงาน: s.jobs,
        "เวลารวม(วิ)": s.total_seconds,
        "เวลาเฉลี่ย(วิ)": s.average_seconds,
      })),
      QC: data.qc.rows.map((r) => ({
        Job: r.job_id,
        วันที่: fmtDateTime(r.created_at),
        ผล: r.overall_result ?? "",
      })),
      Packing: data.packing.rows.map((r) => ({
        Job: r.job_id,
        วันที่: fmtDateTime(r.created_at),
        ผล: r.overall_result ?? "",
      })),
      Maintenance: data.maintenance.rows.map((r) => ({
        Ticket: r.ticket_no,
        สถานะ: r.status,
        แจ้ง: fmtDateTime(r.reported_at),
        ปัญหา: r.problem_text,
      })),
      Office: data.office.rows.map((r) => ({
        Req: r.req_no,
        สถานะ: r.status,
        วันที่: fmtDateTime(r.created_at),
      })),
      Expenses: data.expenses.rows.map((r) => ({
        เลขที่: r.exp_no,
        ร้าน: r.merchant_name ?? "",
        สถานะ: r.status,
        ยอด: r.total_amount,
        วันที่: fmtDateTime(r.created_at),
      })),
    });
  };

  const open = !!target;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="h-[100dvh] w-[100dvw] min-w-0 max-w-[100dvw] overflow-x-hidden overflow-y-auto rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:rounded-lg">
        <DialogHeader className="sticky top-0 z-20 min-w-0 border-b border-border bg-card px-3 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> โปรไฟล์พนักงาน
              </DialogTitle>
              <DialogDescription className="sr-only">
                ข้อมูลพนักงานรวมทุกแผนก พร้อมประวัติงานและ Export รายงาน
              </DialogDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
              <Link to="/" onClick={() => onClose()}>
                <Home className="h-3.5 w-3.5" />
                กลับหน้าแรก
              </Link>
            </Button>
          </div>
        </DialogHeader>

        <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
          <section className="min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <div className="flex min-w-0 items-center gap-3 sm:contents">
                <Avatar className="h-12 w-12 shrink-0 border border-border sm:h-14 sm:w-14">
                  {emp?.avatar_url && <AvatarImage src={emp.avatar_url} />}
                  <AvatarFallback className="bg-muted">
                    {emp ? initialsOf(emp.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold tracking-tight sm:text-xl">
                    {emp?.name ?? target?.name ?? "—"}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {emp?.emp_code && <span className="font-mono">{emp.emp_code}</span>}
                    {emp?.nationality && <Badge variant="secondary">{emp.nationality}</Badge>}
                    {(emp?.departments ?? []).map((d) => (
                      <Badge key={d} className={DEPT_COLOR[d]}>
                        {DEPT_LABEL[d]}
                      </Badge>
                    ))}
                    {prod?.is_red && (
                      <Badge variant="destructive" className="gap-1">
                        <Flame className="h-3 w-3" /> ไฟแดง
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:items-end">
                <div className="grid w-full grid-cols-2 items-center gap-1 rounded-lg border border-border bg-background p-1 sm:flex sm:w-auto">
                  {(["day", "month"] as Range[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRange(r)}
                      className={`rounded-md px-2 py-1.5 text-xs font-semibold transition sm:px-3 sm:py-1 ${
                        range === r
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {r === "day" ? "วัน" : "เดือน"}
                    </button>
                  ))}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                  {range === "day" && (
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                      <label className="min-w-0 text-xs text-muted-foreground">
                        จาก
                        <Input
                          type="date"
                          value={dayFrom}
                          max={dayTo}
                          onChange={(e) => setDayFrom(e.target.value)}
                          className="mt-1 h-9 w-full sm:w-40"
                        />
                      </label>
                      <label className="min-w-0 text-xs text-muted-foreground">
                        ถึง
                        <Input
                          type="date"
                          value={dayTo}
                          min={dayFrom}
                          onChange={(e) => setDayTo(e.target.value)}
                          className="mt-1 h-9 w-full sm:w-40"
                        />
                      </label>
                    </div>
                  )}
                  {range === "month" && (
                    <label className="w-full text-xs text-muted-foreground sm:w-auto">
                      เลือกเดือน
                      <Input
                        type="month"
                        value={monthValue}
                        onChange={(e) => setMonthValue(e.target.value)}
                        className="mt-1 h-9 w-full sm:w-44"
                      />
                    </label>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1 sm:w-auto"
                    onClick={exportXlsx}
                    disabled={!data}
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                icon={CheckCircle2}
                color="text-emerald-600"
                label={`เสร็จ (${rangeLabel})`}
                value={String(prod?.finished_count ?? 0)}
              />
              <Stat
                icon={Clock}
                color="text-blue-600"
                label="เวลาทำงานรวม"
                value={fmtDuration(prod?.total_seconds ?? 0)}
              />
              <Stat
                icon={AlertTriangle}
                color={(prod?.exceeded_count ?? 0) > 0 ? "text-rose-600" : "text-muted-foreground"}
                label="เกินมาตรฐาน"
                value={`${prod?.exceeded_count ?? 0} ครั้ง`}
              />
              <Stat
                icon={Activity}
                color={prod?.is_red ? "text-rose-600" : "text-emerald-600"}
                label="สถานะ"
                value={prod?.is_red ? "🔴 ไฟแดง" : "🟢 ปกติ"}
              />
            </div>
          </section>

          {visibleTabs.length === 0 && !loading && (
            <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              ยังไม่ได้กำหนดแผนกงานให้พนักงานคนนี้
            </p>
          )}

          {hasProduction && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setPanel("work")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition sm:text-sm",
                    panel === "work"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <ListTree className="h-4 w-4 shrink-0" />
                  แยกตามขั้นตอน
                </button>
                <button
                  type="button"
                  onClick={() => setPanel("dashboard")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition sm:text-sm",
                    panel === "dashboard"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  แดชบอร์ดรวม
                </button>
              </div>

              {panel === "dashboard" ? (
                <>
                  <Section title="แดชบอร์ดรวม — สะสมทั้งหมด">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniMetric
                        label="งานสะสม"
                        value={`${prod?.insights.all_time.jobs ?? 0} งาน`}
                      />
                      <MiniMetric
                        label="ขั้นตอนที่เคยทำ"
                        value={`${prod?.insights.all_time.steps ?? 0} ขั้นตอน`}
                      />
                      <MiniMetric
                        label="เวลาทำงานสะสม"
                        value={fmtDuration(prod?.insights.all_time.total_seconds ?? 0)}
                      />
                      <MiniMetric
                        label="ข้อมูลล่าสุด"
                        value={
                          prod?.insights.all_time.last_finished_at
                            ? new Date(prod.insights.all_time.last_finished_at).toLocaleDateString(
                                "th-TH",
                              )
                            : "—"
                        }
                      />
                    </div>
                  </Section>

                  <Section title="เปรียบเทียบผลงาน">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ComparisonCard
                        title="สัปดาห์นี้เทียบสัปดาห์ก่อน"
                        current={prod?.insights.week.current_jobs ?? 0}
                        previous={prod?.insights.week.previous_jobs ?? 0}
                        currentSeconds={prod?.insights.week.current_seconds ?? 0}
                        previousSeconds={prod?.insights.week.previous_seconds ?? 0}
                      />
                      <ComparisonCard
                        title="เดือนนี้เทียบเดือนก่อน"
                        current={prod?.insights.month.current_jobs ?? 0}
                        previous={prod?.insights.month.previous_jobs ?? 0}
                        currentSeconds={prod?.insights.month.current_seconds ?? 0}
                        previousSeconds={prod?.insights.month.previous_seconds ?? 0}
                      />
                    </div>
                  </Section>
                </>
              ) : (
                <>
                  <Section title={`แยกตามขั้นตอน (${rangeLabel})`}>
                    {loading ? (
                      <Loader />
                    ) : !prod || prod.steps.length === 0 ? (
                      <Empty>ไม่มีขั้นตอนในช่วงเวลาที่เลือก</Empty>
                    ) : (
                      <div className="space-y-2">
                        {prod.steps.map((step) => {
                          const maxJobs = Math.max(...prod.steps.map((s) => s.jobs), 1);
                          return (
                            <div
                              key={step.step_id}
                              className="rounded-xl border border-border bg-background p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">{step.step_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    เฉลี่ย {fmtDuration(step.average_seconds)} / งาน
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-lg font-bold text-primary">
                                    {step.jobs} งาน
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    รวม {fmtDuration(step.total_seconds)}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{
                                    width: `${Math.max(6, (step.jobs / maxJobs) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Section>

                  <Section title="ไทม์ไลน์การปฏิบัติงาน">
                    {loading ? (
                      <Loader />
                    ) : !prod || prod.rows.length === 0 ? (
                      <Empty>ไม่มีบันทึกการทำงานในช่วงเวลานี้</Empty>
                    ) : (
                      <ol className="space-y-3">
                        {prod.rows.map((r, idx) => {
                          const pct = r.target_seconds
                            ? Math.min(200, Math.round((r.actual_seconds / r.target_seconds) * 100))
                            : 100;
                          return (
                            <li
                              key={`${r.job_id}-${idx}`}
                              className={`relative rounded-xl border p-3 sm:p-4 ${r.exceeded ? "border-rose-300 bg-rose-50/50 dark:bg-rose-950/20" : "border-border bg-background"}`}
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
                                    มาตรฐาน:{" "}
                                    {r.target_seconds ? fmtDuration(r.target_seconds) : "—"}
                                  </div>
                                </div>
                              </div>
                              {r.target_seconds && (
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
                                ) : r.target_seconds ? (
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
                </>
              )}
            </div>
          )}

          {otherTabs.length > 0 && (
            <Tabs
              value={otherTabs.includes(tab) ? tab : otherTabs[0]}
              onValueChange={(v) => setTab(v as ProfileTab)}
              className="mt-4"
            >
              <div className="-mx-3 max-w-[calc(100%+1.5rem)] overflow-x-auto px-3 sm:mx-0 sm:max-w-full sm:px-0">
                <TabsList
                  className={cn(
                    "grid w-full",
                    otherTabs.length === 1 && "grid-cols-1",
                    otherTabs.length === 2 && "grid-cols-2",
                    otherTabs.length === 3 && "grid-cols-3",
                    otherTabs.length >= 4 && "grid-cols-4",
                  )}
                >
                  {otherTabs.includes("qc") && (
                    <TabsTrigger value="qc" className="gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      QC ({data?.qc.count ?? 0})
                    </TabsTrigger>
                  )}
                  {otherTabs.includes("packing") && (
                    <TabsTrigger value="packing" className="gap-1">
                      <Package className="h-3.5 w-3.5" />
                      แพ็ค ({data?.packing.count ?? 0})
                    </TabsTrigger>
                  )}
                  {otherTabs.includes("maintenance") && (
                    <TabsTrigger value="maintenance" className="gap-1">
                      <Wrench className="h-3.5 w-3.5" />
                      ซ่อม ({data?.maintenance.count ?? 0})
                    </TabsTrigger>
                  )}
                  {otherTabs.includes("office") && (
                    <TabsTrigger value="office" className="gap-1">
                      <Boxes className="h-3.5 w-3.5" />
                      ออฟฟิศ ({(data?.office.count ?? 0) + (data?.expenses.count ?? 0)})
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              {otherTabs.includes("qc") && (
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
                              <Badge
                                variant={r.overall_result === "pass" ? "default" : "destructive"}
                              >
                                {r.overall_result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </TabsContent>
              )}

              {otherTabs.includes("packing") && (
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
                              <Badge
                                variant={r.overall_result === "pass" ? "default" : "destructive"}
                              >
                                {r.overall_result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </TabsContent>
              )}

              {otherTabs.includes("maintenance") && (
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
              )}

              {otherTabs.includes("office") && (
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
              )}
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background p-3">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-base font-bold sm:text-lg">{value}</div>
    </div>
  );
}

function ComparisonCard({
  title,
  current,
  previous,
  currentSeconds,
  previousSeconds,
}: {
  title: string;
  current: number;
  previous: number;
  currentSeconds: number;
  previousSeconds: number;
}) {
  const diff = current - previous;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((diff / previous) * 100);
  const max = Math.max(current, previous, 1);
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">ช่วงปัจจุบัน</div>
          <div className="text-xl font-bold text-primary">{current} งาน</div>
          <div className="text-xs text-muted-foreground">{fmtDuration(currentSeconds)}</div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(current > 0 ? 8 : 0, (current / max) * 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">ช่วงก่อนหน้า</div>
          <div className="text-xl font-bold">{previous} งาน</div>
          <div className="text-xs text-muted-foreground">{fmtDuration(previousSeconds)}</div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-muted-foreground/50"
              style={{ width: `${Math.max(previous > 0 ? 8 : 0, (previous / max) * 100)}%` }}
            />
          </div>
        </div>
      </div>
      <div
        className={`mt-3 text-xs font-semibold ${
          diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-muted-foreground"
        }`}
      >
        {diff > 0 ? "+" : ""}
        {diff} งาน ({pct > 0 ? "+" : ""}
        {pct}%)
      </div>
    </div>
  );
}

function Stat({
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
    <section className="mt-4 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <h3 className="mb-3 text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}
function Loader() {
  return <div className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
