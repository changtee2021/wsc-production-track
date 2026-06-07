// Popup version of the employee profile page.
// Mirrors src/routes/_protected.employee-profile.$id.tsx but in a Dialog,
// adds Export (CSV + XLSX).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { adminGetEmployeeAggregateProfile } from "@/lib/features/employee-profile.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { downloadProfileXlsx } from "@/lib/utils/production-export";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialsOf } from "@/lib/utils/i18n";
import {
  Clock, CheckCircle2, AlertTriangle, Flame, Activity,
  Wrench, Package, ShieldCheck, Receipt, Boxes, Download,
} from "lucide-react";

type Target = { name: string; emp_code: string | null };
type Range = "day" | "week" | "month";

const DEPT_LABEL: Record<string, string> = {
  production: "ผลิต", qc: "QC", packing: "แพ็ค", maintenance: "ซ่อม", office: "ออฟฟิศ",
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

export function EmployeeProfileDialog({
  target,
  onClose,
}: {
  target: Target | null;
  onClose: () => void;
}) {
  const getProfile = useServerFn(adminGetEmployeeAggregateProfile);
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState<Range>("day");
  const [anchor, setAnchor] = useState(today);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminGetEmployeeAggregateProfile>> | null>(null);

  useEffect(() => {
    if (!target) { setData(null); return; }
    setLoading(true);
    getProfile({
      data: {
        token: requireToken(),
        name: target.name, emp_code: target.emp_code,
        range, anchor,
      },
    })
      .then(setData)
      .catch(showError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, range, anchor]);

  const emp = data?.employee;
  const prod = data?.production;
  const rangeLabel = range === "day" ? "วันนี้" : range === "week" ? "สัปดาห์" : "เดือน";

  const exportXlsx = () => {
    if (!data) return;
    const safe = (emp?.name ?? "employee").replace(/[^\p{L}\p{N}_-]+/gu, "_");
    downloadProfileXlsx(`profile_${safe}_${range}_${anchor}`, {
      "สรุป": [{
        ชื่อ: emp?.name ?? "",
        รหัส: emp?.emp_code ?? "",
        แผนก: (emp?.departments ?? []).map((d) => DEPT_LABEL[d] ?? d).join(", "),
        ช่วง: `${range} @ ${anchor}`,
        "เสร็จ(ผลิต)": prod?.finished_count ?? 0,
        "เวลารวม(วิ)": prod?.total_seconds ?? 0,
        เกินมาตรฐาน: prod?.exceeded_count ?? 0,
        ไฟแดง: prod?.is_red ? "🔴" : "",
        QC: data.qc.count, แพ็ค: data.packing.count, ซ่อม: data.maintenance.count,
        ออฟฟิศ: data.office.count, ค่าใช้จ่าย: data.expenses.count,
      }],
      "Production": (prod?.rows ?? []).map((r) => ({
        Job: r.job_id, ขั้นตอน: r.step_name, หมวด: r.category_name ?? "",
        เริ่ม: fmtDateTime(r.started_at), เสร็จ: fmtDateTime(r.finished_at),
        "เวลาจริง(วิ)": r.actual_seconds, "มาตรฐาน(วิ)": r.target_seconds ?? "",
        เกิน: r.exceeded ? "เกิน" : "",
      })),
      "QC": data.qc.rows.map((r) => ({ Job: r.job_id, วันที่: fmtDateTime(r.created_at), ผล: r.overall_result ?? "" })),
      "Packing": data.packing.rows.map((r) => ({ Job: r.job_id, วันที่: fmtDateTime(r.created_at), ผล: r.overall_result ?? "" })),
      "Maintenance": data.maintenance.rows.map((r) => ({ Ticket: r.ticket_no, สถานะ: r.status, แจ้ง: fmtDateTime(r.reported_at), ปัญหา: r.problem_text })),
      "Office": data.office.rows.map((r) => ({ Req: r.req_no, สถานะ: r.status, วันที่: fmtDateTime(r.created_at) })),
      "Expenses": data.expenses.rows.map((r) => ({ เลขที่: r.exp_no, ร้าน: r.merchant_name ?? "", สถานะ: r.status, ยอด: r.total_amount, วันที่: fmtDateTime(r.created_at) })),
    });
  };

  const open = !!target;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> โปรไฟล์พนักงาน
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4">
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-14 w-14 border border-border">
                {emp?.avatar_url && <AvatarImage src={emp.avatar_url} />}
                <AvatarFallback className="bg-muted">{emp ? initialsOf(emp.name) : "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-[180px]">
                <h2 className="text-xl font-bold tracking-tight">{emp?.name ?? target?.name ?? "—"}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {emp?.emp_code && <span className="font-mono">{emp.emp_code}</span>}
                  {emp?.nationality && <Badge variant="secondary">{emp.nationality}</Badge>}
                  {(emp?.departments ?? []).map((d) => (
                    <Badge key={d} className={DEPT_COLOR[d]}>{DEPT_LABEL[d]}</Badge>
                  ))}
                  {prod?.is_red && (
                    <Badge variant="destructive" className="gap-1">
                      <Flame className="h-3 w-3" /> ไฟแดง
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
                        range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >{r === "day" ? "วัน" : r === "week" ? "สัปดาห์" : "เดือน"}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="h-9 w-40" />
                  <Button size="sm" variant="outline" className="gap-1" onClick={exportXlsx} disabled={!data}>
                    <Download className="h-3.5 w-3.5" /> Export
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat icon={CheckCircle2} color="text-emerald-600" label={`เสร็จ (${rangeLabel})`} value={String(prod?.finished_count ?? 0)} />
              <Stat icon={Clock} color="text-blue-600" label="เวลาทำงานรวม" value={fmtDuration(prod?.total_seconds ?? 0)} />
              <Stat icon={AlertTriangle} color={(prod?.exceeded_count ?? 0) > 0 ? "text-rose-600" : "text-muted-foreground"} label="เกินมาตรฐาน" value={`${prod?.exceeded_count ?? 0} ครั้ง`} />
              <Stat icon={Activity} color={prod?.is_red ? "text-rose-600" : "text-emerald-600"} label="สถานะ" value={prod?.is_red ? "🔴 ไฟแดง" : "🟢 ปกติ"} />
            </div>
          </section>

          <Tabs defaultValue="production" className="mt-4">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
              <TabsTrigger value="production" className="gap-1"><Activity className="h-3.5 w-3.5" />ผลิต ({prod?.finished_count ?? 0})</TabsTrigger>
              <TabsTrigger value="qc" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" />QC ({data?.qc.count ?? 0})</TabsTrigger>
              <TabsTrigger value="packing" className="gap-1"><Package className="h-3.5 w-3.5" />แพ็ค ({data?.packing.count ?? 0})</TabsTrigger>
              <TabsTrigger value="maintenance" className="gap-1"><Wrench className="h-3.5 w-3.5" />ซ่อม ({data?.maintenance.count ?? 0})</TabsTrigger>
              <TabsTrigger value="office" className="gap-1"><Boxes className="h-3.5 w-3.5" />ออฟฟิศ ({(data?.office.count ?? 0) + (data?.expenses.count ?? 0)})</TabsTrigger>
            </TabsList>

            <TabsContent value="production">
              <Section title="ไทม์ไลน์การปฏิบัติงาน">
                {loading ? <Loader /> : !prod || prod.rows.length === 0 ? (
                  <Empty>ไม่มีบันทึกการทำงานในช่วงเวลานี้</Empty>
                ) : (
                  <ol className="space-y-3">
                    {prod.rows.map((r, idx) => {
                      const pct = r.target_seconds ? Math.min(200, Math.round((r.actual_seconds / r.target_seconds) * 100)) : 100;
                      return (
                        <li key={`${r.job_id}-${idx}`} className={`relative rounded-xl border p-4 ${r.exceeded ? "border-rose-300 bg-rose-50/50 dark:bg-rose-950/20" : "border-border bg-background"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-xs text-muted-foreground">{fmtTime(r.started_at)} → {fmtTime(r.finished_at)} · {new Date(r.finished_at).toLocaleDateString("th-TH")}</div>
                              <div className="mt-0.5 font-semibold">{r.step_name}</div>
                              <div className="text-xs text-muted-foreground">Job: <span className="font-mono">{r.job_id}</span>{r.category_name && <> • {r.category_name}</>}</div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${r.exceeded ? "text-rose-600" : "text-emerald-600"}`}>{fmtDuration(r.actual_seconds)}</div>
                              <div className="text-xs text-muted-foreground">มาตรฐาน: {r.target_seconds ? fmtDuration(r.target_seconds) : "—"}</div>
                            </div>
                          </div>
                          {r.target_seconds && (
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div className={`h-full ${r.exceeded ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          )}
                          <div className="mt-1">
                            {r.exceeded
                              ? <span className="text-xs font-semibold text-rose-600">🔴 เกินเวลามาตรฐาน</span>
                              : r.target_seconds
                                ? <span className="text-xs font-semibold text-emerald-600">🟢 ผ่านเกณฑ์</span>
                                : <span className="text-xs text-muted-foreground">— ยังไม่ตั้งค่ามาตรฐาน — <Link to="/production-setup" className="underline">ตั้งค่า</Link></span>}
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
                {loading ? <Loader /> : (data?.qc.rows.length ?? 0) === 0 ? <Empty>ไม่มีรายงาน QC</Empty> : (
                  <ul className="space-y-2">
                    {data!.qc.rows.map((r) => (
                      <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                        <div>
                          <div className="font-semibold">Job: <span className="font-mono">{r.job_id}</span></div>
                          <div className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</div>
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
                {loading ? <Loader /> : (data?.packing.rows.length ?? 0) === 0 ? <Empty>ไม่มีรายงานแพ็ค</Empty> : (
                  <ul className="space-y-2">
                    {data!.packing.rows.map((r) => (
                      <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                        <div>
                          <div className="font-semibold">Job: <span className="font-mono">{r.job_id}</span></div>
                          <div className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</div>
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
                {loading ? <Loader /> : (data?.maintenance.rows.length ?? 0) === 0 ? <Empty>ไม่มี ticket</Empty> : (
                  <ul className="space-y-2">
                    {data!.maintenance.rows.map((r) => (
                      <li key={r.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{r.ticket_no}</span>
                          <Badge variant="secondary">{r.status}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(r.reported_at)}</div>
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
                  {loading ? <Loader /> : (data?.office.rows.length ?? 0) === 0 ? <Empty>ไม่มีคำขอ</Empty> : (
                    <ul className="space-y-2">
                      {data!.office.rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                          <div>
                            <div className="font-mono font-semibold">{r.req_no}</div>
                            <div className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</div>
                          </div>
                          <Badge variant="secondary">{r.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title={`ค่าใช้จ่าย (${data?.expenses.count ?? 0} รายการ · ${(data?.expenses.total ?? 0).toLocaleString("th-TH", { style: "currency", currency: "THB" })})`}>
                  {loading ? <Loader /> : (data?.expenses.rows.length ?? 0) === 0 ? <Empty>ไม่มีค่าใช้จ่าย</Empty> : (
                    <ul className="space-y-2">
                      {data!.expenses.rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3 text-sm">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5" /><span className="font-mono font-semibold">{r.exp_no}</span></div>
                            <div className="truncate text-xs text-muted-foreground">{r.merchant_name ?? "—"} · {fmtDateTime(r.created_at)}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">฿ {Number(r.total_amount).toLocaleString("th-TH")}</div>
                            <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, color, label, value }: { icon: typeof Clock; color: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${color}`} /><span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}
function Loader() { return <div className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</div>; }
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{children}</div>;
}
