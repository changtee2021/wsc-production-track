// Production line dashboard: Monitor (real-time) + Historical (range, export, popup profile).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetProductionHistory } from "@/lib/features/production-monitor.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { useOpenEmployeeProfile } from "@/components/EmployeeProfileProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialsOf } from "@/lib/utils/i18n";
import {
  Factory,
  Flame,
  RefreshCw,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
} from "lucide-react";
import { AppVersion } from "@/components/AppVersion";
import { MonitorPanel } from "@/components/monitor/MonitorPanel";
import { downloadHistoryCsv, downloadHistoryXlsx } from "@/lib/utils/production-export";
import { paceTone, productionPace } from "@/lib/production-pace";

export const Route = createFileRoute("/_protected/production-dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ดไลน์ผลิต — WSC ProductionTrack" }] }),
  component: DashboardPage,
});

function fmtDuration(sec: number) {
  if (sec < 60) return `${sec} วิ`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} ชม. ${m % 60} น.`;
  const s = sec % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} น.` : `${m} นาที`;
}

function DashboardPage() {
  const [mode, setMode] = useState<"monitor" | "history">("monitor");
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Factory className="h-6 w-6 text-primary" /> แดชบอร์ดไลน์การผลิต
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor ดูสถานะสด (แชร์ลิงก์ได้) หรือสรุปย้อนหลังตามช่วงเวลา + Export รายงาน
          </p>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "monitor" | "history")}>
          <TabsList>
            <TabsTrigger value="monitor">Monitor</TabsTrigger>
            <TabsTrigger value="history">ย้อนหลัง</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "monitor" ? <MonitorPanel /> : <HistoryView />}

      <div className="mt-8 flex justify-center">
        <AppVersion />
      </div>
    </main>
  );
}

// ----------- Historical -----------
type RangeType = "day" | "week" | "month" | "year" | "custom";

function HistoryView() {
  const fn = useServerFn(adminGetProductionHistory);
  const openProfile = useOpenEmployeeProfile();
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState<RangeType>("day");
  const [anchor, setAnchor] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [catId, setCatId] = useState<string>("__all");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminGetProductionHistory>> | null>(
    null,
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fn({
        data: {
          token: requireToken(),
          range,
          anchor,
          end: range === "custom" ? endDate : undefined,
          category_id: catId === "__all" ? null : catId,
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
  }, [range, anchor, endDate, catId]);

  const filenameBase = `production_${range}_${anchor}${range === "custom" ? `_to_${endDate}` : ""}`;

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            {(["day", "week", "month", "year", "custom"] as RangeType[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r === "day"
                  ? "วัน"
                  : r === "week"
                    ? "สัปดาห์"
                    : r === "month"
                      ? "เดือน"
                      : r === "year"
                        ? "ปี"
                        : "เลือกช่วง"}
              </button>
            ))}
          </div>
          <Input
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="h-9 w-40"
          />
          {range === "custom" && (
            <>
              <span className="text-xs text-muted-foreground">ถึง</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-40"
              />
            </>
          )}
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="__all">ทุกหมวด</option>
            {(data?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!data}
              onClick={() => data && downloadHistoryCsv(data.timeline, filenameBase)}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={!data}
              onClick={() =>
                data && downloadHistoryXlsx(data.by_employee, data.timeline, filenameBase)
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
          </div>
        </div>

        {data && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard
              icon={CheckCircle2}
              color="text-emerald-600"
              label="งานเสร็จ"
              value={String(data.totals.finished_count)}
            />
            <SummaryCard
              icon={Clock}
              color="text-blue-600"
              label="เวลารวม"
              value={fmtDuration(data.totals.total_seconds)}
            />
            <SummaryCard
              icon={AlertTriangle}
              color={data.totals.exceeded_count > 0 ? "text-rose-600" : "text-muted-foreground"}
              label="เกินมาตรฐาน"
              value={`${data.totals.exceeded_count} ครั้ง`}
            />
            <SummaryCard
              icon={Users}
              color={data.totals.employees_red > 0 ? "text-rose-600" : "text-muted-foreground"}
              label="พนักงานติดไฟแดง"
              value={`${data.totals.employees_red} คน`}
            />
          </div>
        )}
      </section>

      {loading ? (
        <div className="mt-6 py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
      ) : !data || data.by_employee.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          ไม่มีข้อมูลในช่วงเวลาที่เลือก
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">สรุปต่อพนักงาน</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">พนักงาน</th>
                    <th className="py-2 pr-3 text-right">งานเสร็จ</th>
                    <th className="py-2 pr-3 text-right">เวลารวม</th>
                    <th className="py-2 pr-3 text-right">เกินมาตรฐาน</th>
                    <th className="py-2 pr-3 text-center">ไฟแดง</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_employee.map((e) => (
                    <tr
                      key={`${e.employee_id ?? ""}|${e.employee_name}`}
                      className={`border-b border-border/60 ${e.is_red ? "bg-rose-50/40 dark:bg-rose-950/10" : ""}`}
                    >
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() =>
                            openProfile({ name: e.employee_name, emp_code: e.emp_code })
                          }
                          className="flex items-center gap-2 hover:text-primary hover:underline"
                        >
                          <Avatar className="h-7 w-7 border border-border">
                            {e.avatar_url && <AvatarImage src={e.avatar_url} />}
                            <AvatarFallback className="bg-muted text-[10px]">
                              {initialsOf(e.employee_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <div className="font-semibold">{e.employee_name}</div>
                            {e.emp_code && (
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {e.emp_code}
                              </div>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-right">{e.finished_count}</td>
                      <td className="py-2 pr-3 text-right">{fmtDuration(e.total_seconds)}</td>
                      <td
                        className={`py-2 pr-3 text-right font-semibold ${e.exceeded_count > 0 ? "text-rose-600" : ""}`}
                      >
                        {e.exceeded_count}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        {e.is_red ? <Flame className="mx-auto h-4 w-4 text-rose-600" /> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">ไทม์ไลน์ ({data.timeline.length} รายการ)</h2>
            {data.timeline.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                ไม่มีข้อมูล
              </div>
            ) : (
              <ol className="space-y-2">
                {data.timeline.slice(0, 300).map((t, idx) => {
                  const tone = paceTone(
                    productionPace(t.actual_seconds, t.normal_seconds, t.target_seconds),
                  );
                  return (
                    <li key={`${t.job_id}-${idx}`} className={`rounded-xl border p-3 ${tone.card}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              openProfile({ name: t.employee_name, emp_code: t.emp_code })
                            }
                            className="font-semibold hover:text-primary hover:underline"
                          >
                            {t.employee_name}
                          </button>
                          <div className="text-xs text-muted-foreground">
                            {new Date(t.started_at).toLocaleString("th-TH")} →{" "}
                            {new Date(t.finished_at).toLocaleTimeString("th-TH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.step_name}
                            {t.category_name && <> · {t.category_name}</>} · Job{" "}
                            <span className="font-mono">{t.job_id}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${tone.text}`}>
                            {fmtDuration(t.actual_seconds)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {tone.label || "ยังไม่ตั้งเวลา"}
                            {t.normal_seconds ? ` · ปกติ ${fmtDuration(t.normal_seconds)}` : ""}
                            {t.target_seconds ? ` · เกิน ${fmtDuration(t.target_seconds)}` : ""}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {data.timeline.length > 300 && (
                  <li className="text-center text-xs text-muted-foreground">
                    แสดง 300 แถวแรก · ใช้ Export เพื่อดูทั้งหมด ({data.timeline.length} รายการ)
                  </li>
                )}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  );
}

function SummaryCard({
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
