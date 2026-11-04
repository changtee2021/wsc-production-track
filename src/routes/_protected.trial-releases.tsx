import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminToken } from "@/lib/auth/admin-session";
import { adminFetchJobDetail } from "@/lib/features/admin.functions";
import {
  adminDeleteTrialRelease,
  adminListTrialReleases,
  adminListTrialRuns,
  adminLookupTrialEmployee,
  adminUpdateTrialRelease,
} from "@/lib/scan-trial.functions";
import {
  flowById,
  TRIAL_FLOWS,
  trialProductLabel,
  trialStepView,
  type TrialFlowId,
  type TrialStepSnapshot,
} from "@/lib/scan-trial";
import { ChevronDown, PenLine, Pencil, PlayCircle, Search, StopCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_protected/trial-releases")({
  head: () => ({ meta: [{ title: "ออเดอร์เข้าไลน์ — WSC" }] }),
  component: TrialReleasesRoute,
});

function TrialReleasesRoute() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Toaster richColors position="top-center" />
      <TrialReleasesPage />
    </main>
  );
}

type ReleaseRow = {
  job_id: string;
  product: string;
  sent_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type Draft = {
  step: "gate" | "edit" | "confirm";
  intent: "save" | "delete";
  row: ReleaseRow;
  product: string;
  reason: string;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(at: number | null): string {
  if (!at) return "—";
  return new Date(at).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TimelineLog = {
  id: string;
  action: string;
  created_at: string;
  note: string | null;
  steps: { step_name: string | null } | null;
  categories: { name: string | null } | null;
  employees: { name: string | null; emp_code: string | null; avatar_url: string | null } | null;
};

function actionMeta(action: string): { label: string; Icon: typeof PlayCircle; cls: string } {
  if (action === "start") {
    return { label: "เริ่มงาน", Icon: PlayCircle, cls: "text-blue-600 bg-blue-50" };
  }
  if (action === "finish") {
    return { label: "เสร็จงาน", Icon: StopCircle, cls: "text-emerald-600 bg-emerald-50" };
  }
  return { label: action, Icon: PlayCircle, cls: "text-muted-foreground bg-muted" };
}

function runsAsLogs(runs: TrialStepSnapshot[]): TimelineLog[] {
  const logs: TimelineLog[] = [];
  for (const run of runs) {
    const sameInstant = run.finishedAt != null && Math.abs(run.finishedAt - run.startedAt) < 1000;
    if (!sameInstant) {
      logs.push({
        id: `${run.step}-start`,
        action: "start",
        created_at: new Date(run.startedAt).toISOString(),
        note: null,
        steps: { step_name: run.step },
        categories: null,
        employees: { name: run.employeeName, emp_code: null, avatar_url: null },
      });
    }
    if (run.status === "done" && run.finishedAt) {
      logs.push({
        id: `${run.step}-finish`,
        action: "finish",
        created_at: new Date(run.finishedAt).toISOString(),
        note: null,
        steps: { step_name: run.step },
        categories: null,
        employees: { name: run.employeeName, emp_code: null, avatar_url: null },
      });
    }
  }
  return logs.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Keep the job-lookup history, and add scan steps that are not already in it. */
function combinedTimeline(history: TimelineLog[] | undefined, runs: TrialStepSnapshot[]): TimelineLog[] {
  const scanned = runsAsLogs(runs);
  const logged = history ?? [];
  if (logged.length === 0) return scanned;
  const seen = new Set(logged.map((log) => `${log.action}|${log.steps?.step_name ?? ""}`));
  const extra = scanned.filter((log) => !seen.has(`${log.action}|${log.steps?.step_name ?? ""}`));
  return [...logged, ...extra].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function StepTimeline({
  jobId,
  product,
  sentBy,
  sentAt,
  runs,
}: {
  jobId: string;
  product: string;
  sentBy: string | null;
  sentAt: string;
  runs: TrialStepSnapshot[];
}) {
  const fetchDetail = useServerFn(adminFetchJobDetail);
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const [logs, setLogs] = useState<TimelineLog[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) {
      setLogs(runsAsLogs(runsRef.current));
      return;
    }
    void fetchDetail({ data: { token, job_id: jobId } })
      .then((detail) => {
        if (cancelled) return;
        const found = detail as { found?: boolean; logs?: TimelineLog[] };
        setLogs(combinedTimeline(found.found ? found.logs : [], runsRef.current));
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLogs(runsAsLogs(runsRef.current));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDetail, jobId]);

  if (!logs) {
    return <p className="text-sm text-muted-foreground">กำลังโหลดไทม์ไลน์…</p>;
  }

  return (
    <div className="flex max-h-[min(32rem,calc(100vh-6rem))] flex-col">
      <p className="mb-2 shrink-0 text-sm font-semibold">ไทม์ไลน์การผลิต ({logs.length + 1})</p>
      {failed && (
        <p className="mb-2 shrink-0 text-xs text-muted-foreground">โหลดประวัติเต็มไม่ได้ แสดงจากขั้นที่สแกน</p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 pr-1 pl-1">
        <ol className="relative ml-3 space-y-3 border-l border-border py-1 pl-4">
          <li className="relative">
            <span className="absolute -left-6 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-2 ring-popover">
              <PenLine className="h-3 w-3" />
            </span>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  คีย์ออเดอร์
                </span>
                <p className="mt-1 text-sm font-medium leading-snug break-words">{trialProductLabel(product)}</p>
                <p className="mt-1 text-sm leading-snug break-words">
                  <span className="font-medium">{sentBy || "พนักงานออฟฟิศ"}</span>
                  <span className="ml-2 text-xs text-muted-foreground">ออฟฟิศ</span>
                </p>
              </div>
              <time className="shrink-0 pt-0.5 text-right text-xs leading-snug text-muted-foreground">
                {formatWhen(sentAt)}
              </time>
            </div>
          </li>
          {logs.map((log) => {
            const meta = actionMeta(log.action);
            return (
              <li key={log.id} className="relative">
                <span
                  className={`absolute -left-6 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-popover ${meta.cls}`}
                >
                  <meta.Icon className="h-3 w-3" />
                </span>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${meta.cls}`}
                      >
                        {meta.label}
                      </span>
                      {log.categories?.name && (
                        <Badge variant="outline" className="max-w-full text-[10px] break-words">
                          {log.categories.name}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug break-words">{log.steps?.step_name ?? "—"}</p>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      {log.employees?.avatar_url ? (
                        <img
                          src={log.employees.avatar_url}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                          {log.employees?.name?.[0] ?? "?"}
                        </div>
                      )}
                      <span className="min-w-0 leading-snug break-words">
                        <span className="font-medium">{log.employees?.name ?? "ไม่ระบุ"}</span>
                        {log.employees?.emp_code && (
                          <span className="ml-2 text-xs text-muted-foreground">#{log.employees.emp_code}</span>
                        )}
                      </span>
                    </div>
                    {log.note && (
                      <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm break-words">
                        {log.note}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 pt-0.5 text-right text-xs leading-snug whitespace-nowrap text-muted-foreground">
                    {formatWhen(log.created_at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function productChoices(current: string): { id: string; label: string }[] {
  const choices = TRIAL_FLOWS.map((flow) => ({ id: flow.id, label: flow.label }));
  if (!choices.some((choice) => choice.id === current)) {
    choices.push({ id: current, label: trialProductLabel(current) });
  }
  return choices;
}

export function TrialReleasesPage() {
  const listReleases = useServerFn(adminListTrialReleases);
  const listRuns = useServerFn(adminListTrialRuns);
  const lookupEmployee = useServerFn(adminLookupTrialEmployee);
  const updateRelease = useServerFn(adminUpdateTrialRelease);
  const deleteRelease = useServerFn(adminDeleteTrialRelease);
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [runs, setRuns] = useState<
    (TrialStepSnapshot & { jobId: string; flow: TrialFlowId })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const rowsRef = useRef<ReleaseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [empCode, setEmpCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await listReleases({ data: { token } });
      const next = (res.rows ?? []) as ReleaseRow[];
      rowsRef.current = next;
      setRows(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดรายการไม่สำเร็จ");
    }
    setLoading(false);
  }, [listReleases]);

  const refreshRuns = useCallback(
    async (jobIds: string[]) => {
      const token = getAdminToken();
      if (!token || !jobIds.length) {
        if (!jobIds.length) setRuns([]);
        return;
      }
      try {
        const res = await listRuns({ data: { token, jobIds } });
        setRuns(res.runs);
      } catch {
        // Keep the last snapshot on a missed poll.
      }
    },
    [listRuns],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    void refreshRuns(rows.map((row) => row.job_id));
  }, [loading, rows, refreshRuns]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshRuns(rowsRef.current.map((row) => row.job_id));
    }, 5000);
    return () => window.clearInterval(id);
  }, [refreshRuns]);

  function openEdit(row: ReleaseRow) {
    setEmpCode("");
    setCodeError(null);
    setDraft({ step: "gate", intent: "save", row, product: row.product, reason: "" });
  }

  function closeDraft() {
    if (busy) return;
    setDraft(null);
    setEmpCode("");
    setCodeError(null);
  }

  async function enterEdit() {
    const token = getAdminToken();
    if (!token || draft?.step !== "gate") return;
    const code = empCode.trim();
    if (!code) {
      setCodeError("ใส่รหัสพนักงานก่อน");
      return;
    }
    setBusy(true);
    setCodeError(null);
    try {
      await lookupEmployee({ data: { token, empCode: code } });
      setEmpCode("");
      setDraft({ ...draft, step: "edit" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่พบรหัสพนักงานนี้";
      setCodeError(message);
    }
    setBusy(false);
  }

  function askConfirm(intent: "save" | "delete") {
    if (!draft || draft.step !== "edit") return;
    const reason = draft.reason.trim();
    if (!reason) {
      toast.error("ใส่สาเหตุก่อน");
      return;
    }
    if (intent === "save") {
      const flow = TRIAL_FLOWS.find((item) => item.id === draft.product);
      if (!flow || flow.id === draft.row.product) {
        toast.error("เลือกสินค้าใหม่ก่อนบันทึก");
        return;
      }
    }
    setEmpCode("");
    setCodeError(null);
    setDraft({ ...draft, step: "confirm", intent, reason });
  }

  async function confirmAction() {
    const token = getAdminToken();
    if (!token || draft?.step !== "confirm") return;
    const code = empCode.trim();
    if (!code) {
      setCodeError("ใส่รหัสพนักงานก่อน");
      return;
    }
    setBusy(true);
    setCodeError(null);
    try {
      const editor = await lookupEmployee({ data: { token, empCode: code } });
      if (draft.intent === "save") {
        const flow = TRIAL_FLOWS.find((item) => item.id === draft.product);
        if (!flow) throw new Error("เลือกสินค้าก่อน");
        await updateRelease({
          data: {
            token,
            jobId: draft.row.job_id,
            product: flow.id,
            empCode: editor.emp_code,
            reason: draft.reason,
          },
        });
        toast.success("แก้สินค้าแล้ว");
      } else {
        await deleteRelease({
          data: {
            token,
            jobId: draft.row.job_id,
            empCode: editor.emp_code,
            reason: draft.reason,
          },
        });
        toast.success("ลบแล้ว");
      }
      setDraft(null);
      setEmpCode("");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ";
      if (message.includes("รหัส")) setCodeError(message);
      else toast.error(message);
    }
    setBusy(false);
  }

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (productFilter !== "all" && row.product !== productFilter) return false;
      if (!query) return true;
      const hay = `${row.job_id} ${row.sent_by_name ?? ""} ${trialProductLabel(row.product)}`.toLowerCase();
      return hay.includes(query);
    });
  }, [rows, search, productFilter]);

  const reasonReady = (draft?.reason.trim().length ?? 0) > 0;
  const productChanged =
    draft != null &&
    TRIAL_FLOWS.some((flow) => flow.id === draft.product) &&
    draft.product !== draft.row.product;

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">ออเดอร์เข้าไลน์</h2>
          <p className="text-sm text-muted-foreground">
            กดแก้ไขแล้วใส่รหัสพนักงานก่อนเข้า ตอนบันทึกหรือลบต้องใส่รหัสอีกครั้ง และต้องบอกสาเหตุ
            ความคืบหน้าอัปเดตเองทุกไม่กี่วินาที
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="h-11 w-44" aria-label="กรองสินค้า">
              <SelectValue placeholder="สินค้า" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สินค้าทั้งหมด</SelectItem>
              {TRIAL_FLOWS.map((flow) => (
                <SelectItem key={flow.id} value={flow.id}>
                  {flow.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหา Job / ผู้ลงข้อมูล"
              className="h-11 w-64 pl-9"
              aria-label="ค้นหาออเดอร์เข้าไลน์"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : visibleRows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {rows.length === 0 ? "ยังไม่มีออเดอร์ที่ส่งเข้าไลน์" : "ไม่พบรายการที่ค้นหา"}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3">เวลาที่ส่ง</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">ผู้ลงข้อมูล</th>
                <th className="px-4 py-3">สินค้า</th>
                <th className="px-4 py-3">ขั้นตอน</th>
                <th className="px-4 py-3">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.map((row) => {
                const flow = TRIAL_FLOWS.some((item) => item.id === row.product)
                  ? flowById(row.product as TrialFlowId)
                  : null;
                const jobRuns = runs.filter((run) => run.jobId === row.job_id);
                const view = flow ? trialStepView(flow, jobRuns) : null;
                return (
                  <tr key={row.job_id}>
                    <td className="px-4 py-3 text-muted-foreground">{formatWhen(row.created_at)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-primary">{row.job_id}</td>
                    <td className="px-4 py-3">{row.sent_by_name || "พนักงานออฟฟิศ"}</td>
                    <td className="px-4 py-3">{trialProductLabel(row.product)}</td>
                    <td className="px-4 py-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="group inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-left font-medium hover:bg-muted"
                            aria-label="ดูขั้นก่อนหน้า"
                          >
                            <span>
                              {view ? view.headline : "—"}
                              {view?.who ? ` · ${view.who}` : ""}
                              {view?.since ? ` ตั้งแต่ ${formatClock(view.since)}` : ""}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          collisionPadding={16}
                          className="w-[min(34rem,calc(100vw-2rem))] p-4"
                        >
                          <StepTimeline
                            jobId={row.job_id}
                            product={row.product}
                            sentBy={row.sent_by_name}
                            sentAt={row.created_at}
                            runs={jobRuns}
                          />
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 min-w-11 px-2.5"
                        aria-label="แก้ไข"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={draft != null} onOpenChange={(open) => !open && closeDraft()}>
        <DialogContent className="max-w-md">
          {draft?.step === "gate" && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void enterEdit();
              }}
            >
              <DialogTitle>ใส่รหัสพนักงาน</DialogTitle>
              <DialogDescription>
                ใส่รหัสเพื่อเข้าแก้ไขหรือลบ {draft.row.job_id}
              </DialogDescription>
              <label className="block space-y-1 text-sm font-medium" htmlFor="release-gate-code">
                รหัสพนักงาน
                <Input
                  id="release-gate-code"
                  value={empCode}
                  autoFocus
                  autoComplete="off"
                  className="h-11 font-mono"
                  onChange={(event) => setEmpCode(event.target.value)}
                />
              </label>
              {codeError && <p className="text-sm font-medium text-destructive">{codeError}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="min-h-11 flex-1" disabled={busy}>
                  {busy ? "กำลังตรวจรหัส" : "เข้าแก้ไข"}
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={closeDraft}>
                  ยกเลิก
                </Button>
              </div>
            </form>
          )}

          {draft?.step === "edit" && (
            <div className="space-y-4">
              <DialogTitle>แก้ไขออเดอร์</DialogTitle>
              <DialogDescription>
                {draft.row.job_id} · สินค้าตอนนี้ {trialProductLabel(draft.row.product)}
              </DialogDescription>
              <label className="block space-y-1 text-sm font-medium" htmlFor="release-product">
                สินค้า
                <select
                  id="release-product"
                  value={draft.product}
                  onChange={(event) => setDraft({ ...draft, product: event.target.value })}
                  className="h-11 w-full rounded-lg border bg-background px-2"
                >
                  {productChoices(draft.row.product).map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium" htmlFor="release-reason">
                สาเหตุ
                <Textarea
                  id="release-reason"
                  value={draft.reason}
                  maxLength={500}
                  placeholder="บอกสาเหตุก่อนบันทึกหรือลบ"
                  className="min-h-24"
                  onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  disabled={!reasonReady || !productChanged}
                  onClick={() => askConfirm("save")}
                >
                  บันทึก
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100"
                  disabled={!reasonReady}
                  onClick={() => askConfirm("delete")}
                >
                  ลบ
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={closeDraft}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          )}

          {draft?.step === "confirm" && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmAction();
              }}
            >
              <DialogTitle>
                {draft.intent === "save" ? "ยืนยันการแก้ไข" : "ยืนยันการลบ"}
              </DialogTitle>
              <DialogDescription>
                {draft.intent === "save"
                  ? `${draft.row.job_id} จาก ${trialProductLabel(draft.row.product)} เป็น ${trialProductLabel(draft.product)}`
                  : `ลบ ${draft.row.job_id} สินค้า ${trialProductLabel(draft.row.product)} ออกจากไลน์`}
              </DialogDescription>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="block text-xs text-muted-foreground">สาเหตุ</span>
                {draft.reason}
              </p>
              <label className="block space-y-1 text-sm font-medium" htmlFor="release-emp-code">
                รหัสพนักงาน
                <Input
                  id="release-emp-code"
                  value={empCode}
                  autoFocus
                  autoComplete="off"
                  className="h-11 font-mono"
                  onChange={(event) => setEmpCode(event.target.value)}
                />
              </label>
              {codeError && <p className="text-sm font-medium text-destructive">{codeError}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="min-h-11 flex-1" disabled={busy}>
                  {busy ? "กำลังยืนยัน" : "ยืนยันรหัส"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => setDraft({ ...draft, step: "edit" })}
                >
                  กลับ
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
