import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  Calendar,
  TrendingUp,
  CheckSquare,
  FileSpreadsheet,
  Activity,
  Trophy,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_protected/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ProductionTrack" }] }),
  component: Dashboard,
});

interface LogRow {
  id: string;
  job_id: string;
  action: string;
  created_at: string;
  employee_id: string;
  step_id: string;
  category_id: string | null;
  employees: { id: string; name: string } | null;
  steps: { id: string; step_name: string; std_duration_minutes: number | null } | null;
  categories: { id: string; name: string } | null;
}

interface CategoryRow {
  id: string;
  name: string;
}

interface NamedRow {
  id: string;
  name: string;
}

const CHART_COLORS = [
  "oklch(0.32 0.10 256)",
  "oklch(0.60 0.20 256)",
  "oklch(0.65 0.18 145)",
  "oklch(0.75 0.15 80)",
  "oklch(0.55 0.20 30)",
  "oklch(0.50 0.15 300)",
];

function Dashboard() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"day" | "month">("day");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [employees, setEmployees] = useState<NamedRow[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [steps, setSteps] = useState<NamedRow[]>([]);
  const [stepFilter, setStepFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      // Paginate production_logs to bypass the 1000-row default cap
      const PAGE = 1000;
      const all: LogRow[] = [];
      let from = 0;
      // Hard upper bound to avoid runaway loops on huge datasets
      const MAX_PAGES = 100;
      for (let p = 0; p < MAX_PAGES; p++) {
        const { data, error } = await supabase
          .from("production_logs")
          .select(
            "id, job_id, action, created_at, employee_id, step_id, category_id, employees(id,name), steps(id,step_name,std_duration_minutes), categories(id,name)",
          )
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) {
          toast.error(error.message);
          break;
        }
        const rows = (data as unknown as LogRow[]) ?? [];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }

      const [{ data: catData }, { data: empData }, { data: stepData }] = await Promise.all([
        supabase.from("categories").select("id,name").eq("active", true).order("name"),
        supabase.from("employees").select("id,name").eq("active", true).order("name"),
        supabase.from("steps").select("id,step_name").eq("active", true).order("step_name"),
      ]);
      setLogs(all);
      setCategories((catData as CategoryRow[]) ?? []);
      setEmployees((empData as NamedRow[]) ?? []);
      setSteps(
        ((stepData as { id: string; step_name: string }[]) ?? []).map((s) => ({
          id: s.id,
          name: s.step_name,
        })),
      );
      setLoading(false);
    })();
  }, []);

  const hasFilter = categoryFilter !== "all" || employeeFilter !== "all" || stepFilter !== "all";

  // Apply filters globally
  const scopedLogs = useMemo(() => {
    return logs.filter((l) => {
      if (categoryFilter !== "all" && l.category_id !== categoryFilter) return false;
      if (employeeFilter !== "all" && l.employee_id !== employeeFilter) return false;
      if (stepFilter !== "all" && l.step_id !== stepFilter) return false;
      return true;
    });
  }, [logs, categoryFilter, employeeFilter, stepFilter]);

  // Filter logs by selected day/month for ranking & report sections
  const filtered = useMemo(() => {
    if (scope === "day") {
      return scopedLogs.filter((l) => l.created_at.slice(0, 10) === day);
    }
    return scopedLogs.filter((l) => l.created_at.slice(0, 7) === month);
  }, [scopedLogs, scope, day, month]);

  // Build sessions: pair start/finish per (employee, step, job)
  // Used for: avg duration, over-standard list, MoM speed
  type Session = {
    job_id: string;
    employee_id: string;
    employee_name: string;
    step_id: string;
    step_name: string;
    std: number | null;
    start: Date;
    finish: Date;
    durationMin: number;
  };

  const sessions = useMemo<Session[]>(() => {
    const sorted = [...scopedLogs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const open = new Map<string, LogRow>();
    const out: Session[] = [];
    for (const l of sorted) {
      const key = `${l.employee_id}|${l.step_id}|${l.job_id}`;
      if (l.action === "start") {
        open.set(key, l);
      } else if (l.action === "finish") {
        const s = open.get(key);
        if (s) {
          open.delete(key);
          const start = new Date(s.created_at);
          const finish = new Date(l.created_at);
          out.push({
            job_id: l.job_id,
            employee_id: l.employee_id,
            employee_name: l.employees?.name ?? "—",
            step_id: l.step_id,
            step_name: l.steps?.step_name ?? "—",
            std: l.steps?.std_duration_minutes ?? null,
            start,
            finish,
            durationMin: (finish.getTime() - start.getTime()) / 60000,
          });
        }
      }
    }
    return out;
  }, [scopedLogs]);

  // Stats for top cards
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const finishedToday = new Set<string>();
    const finishedMonth = new Set<string>();
    for (const l of scopedLogs) {
      if (l.action !== "finish") continue;
      const d = new Date(l.created_at);
      if (d >= today) finishedToday.add(l.job_id);
      if (d >= monthStart) finishedMonth.add(l.job_id);
    }
    return {
      todayCount: finishedToday.size,
      monthCount: finishedMonth.size,
      total: scopedLogs.length,
    };
  }, [scopedLogs]);

  // 14-day chart
  const days14 = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arr: { day: string; finishes: number; starts: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const item = {
        day: d.toLocaleDateString("th-TH", { month: "short", day: "numeric" }),
        finishes: 0,
        starts: 0,
      };
      for (const l of scopedLogs) {
        if (l.created_at.slice(0, 10) === key) {
          if (l.action === "finish") item.finishes += 1;
          else if (l.action === "start") item.starts += 1;
        }
      }
      arr.push(item);
    }
    return arr;
  }, [scopedLogs]);

  // Step pie (last 30 days starts)
  const stepPie = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    const map = new Map<string, number>();
    for (const l of scopedLogs) {
      if (l.action !== "start") continue;
      if (new Date(l.created_at) < cutoff) continue;
      const n = l.steps?.step_name ?? "ไม่ทราบ";
      map.set(n, (map.get(n) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [scopedLogs]);

  // Employee ranking within filtered scope
  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; jobs: number }>();
    const seen = new Set<string>(); // employee+job dedup for finishes
    for (const l of filtered) {
      if (l.action !== "finish") continue;
      const key = `${l.employee_id}|${l.job_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = map.get(l.employee_id) ?? {
        name: l.employees?.name ?? "—",
        jobs: 0,
      };
      cur.jobs += 1;
      map.set(l.employee_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.jobs - a.jobs);
  }, [filtered]);

  // MoM: compare current month vs previous month per employee
  // Two metrics: jobs finished count, avg duration (minutes)
  const mom = useMemo(() => {
    const now = new Date();
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = curStart;

    const stat = (from: Date, to: Date | null) => {
      const jobsByEmp = new Map<string, { name: string; jobs: Set<string>; durations: number[] }>();
      // jobs finished
      for (const l of scopedLogs) {
        if (l.action !== "finish") continue;
        const d = new Date(l.created_at);
        if (d < from) continue;
        if (to && d >= to) continue;
        const cur = jobsByEmp.get(l.employee_id) ?? {
          name: l.employees?.name ?? "—",
          jobs: new Set<string>(),
          durations: [],
        };
        cur.jobs.add(l.job_id);
        jobsByEmp.set(l.employee_id, cur);
      }
      // durations from sessions
      for (const s of sessions) {
        if (s.finish < from) continue;
        if (to && s.finish >= to) continue;
        const cur = jobsByEmp.get(s.employee_id) ?? {
          name: s.employee_name,
          jobs: new Set<string>(),
          durations: [],
        };
        cur.durations.push(s.durationMin);
        jobsByEmp.set(s.employee_id, cur);
      }
      return jobsByEmp;
    };

    const cur = stat(curStart, null);
    const prev = stat(prevStart, prevEnd);

    const allIds = new Set<string>([...cur.keys(), ...prev.keys()]);
    return Array.from(allIds).map((id) => {
      const c = cur.get(id);
      const p = prev.get(id);
      const name = c?.name ?? p?.name ?? "—";
      const curJobs = c?.jobs.size ?? 0;
      const prevJobs = p?.jobs.size ?? 0;
      const jobsPct =
        prevJobs === 0 ? (curJobs > 0 ? 100 : 0) : ((curJobs - prevJobs) / prevJobs) * 100;

      const avg = (xs: number[]) =>
        xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
      const curAvg = avg(c?.durations ?? []);
      const prevAvg = avg(p?.durations ?? []);
      // negative speedPct means faster (good)
      const speedPct =
        curAvg == null || prevAvg == null || prevAvg === 0
          ? null
          : ((curAvg - prevAvg) / prevAvg) * 100;
      return { id, name, curJobs, prevJobs, jobsPct, curAvg, prevAvg, speedPct };
    }).sort((a, b) => b.curJobs - a.curJobs);
  }, [scopedLogs, sessions]);

  // Over-standard sessions in scope
  const overStandard = useMemo(() => {
    return sessions
      .filter((s) => {
        if (s.std == null) return false;
        if (scope === "day") {
          return s.finish.toISOString().slice(0, 10) === day;
        }
        return s.finish.toISOString().slice(0, 7) === month;
      })
      .map((s) => ({ ...s, over: s.durationMin - (s.std ?? 0) }))
      .sort((a, b) => b.over - a.over);
  }, [sessions, scope, day, month]);

  type ExportConfig = {
    rangeMode: "current" | "custom" | "all";
    fromDate: string; // yyyy-mm-dd
    toDate: string;
    empIds: Set<string>; // empty = all
    stepIds: Set<string>;
    catIds: Set<string>;
    sheets: Set<string>;
  };

  const runExport = (cfg: ExportConfig) => {
    // Resolve range bounds
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    let scopeLabel = "all";
    if (cfg.rangeMode === "current") {
      if (scope === "day") {
        rangeStart = new Date(`${day}T00:00:00`);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
        scopeLabel = day;
      } else {
        const [y, m] = month.split("-").map(Number);
        rangeStart = new Date(y, m - 1, 1);
        rangeEnd = new Date(y, m, 1);
        scopeLabel = month;
      }
    } else if (cfg.rangeMode === "custom" && cfg.fromDate && cfg.toDate) {
      rangeStart = new Date(`${cfg.fromDate}T00:00:00`);
      rangeEnd = new Date(`${cfg.toDate}T00:00:00`);
      rangeEnd.setDate(rangeEnd.getDate() + 1);
      scopeLabel = `${cfg.fromDate}_${cfg.toDate}`;
    }

    const inRange = (iso: string) => {
      if (!rangeStart || !rangeEnd) return true;
      const d = new Date(iso);
      return d >= rangeStart && d < rangeEnd;
    };

    const matchEmp = (id: string) => cfg.empIds.size === 0 || cfg.empIds.has(id);
    const matchStep = (id: string) => cfg.stepIds.size === 0 || cfg.stepIds.has(id);
    const matchCat = (id: string | null) =>
      cfg.catIds.size === 0 || (id != null && cfg.catIds.has(id));

    const inScopeLogs = logs.filter(
      (l) =>
        inRange(l.created_at) &&
        matchEmp(l.employee_id) &&
        matchStep(l.step_id) &&
        matchCat(l.category_id),
    );

    // Build sessions from filtered logs
    type Sess = {
      job_id: string;
      employee_id: string;
      employee_name: string;
      step_id: string;
      step_name: string;
      std: number | null;
      start: Date;
      finish: Date;
      durationMin: number;
    };
    const sortedAll = [...logs]
      .filter((l) => matchEmp(l.employee_id) && matchStep(l.step_id) && matchCat(l.category_id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const open = new Map<string, LogRow>();
    const allSessions: Sess[] = [];
    for (const l of sortedAll) {
      const k = `${l.employee_id}|${l.step_id}|${l.job_id}`;
      if (l.action === "start") open.set(k, l);
      else if (l.action === "finish") {
        const s = open.get(k);
        if (s) {
          open.delete(k);
          const start = new Date(s.created_at);
          const finish = new Date(l.created_at);
          allSessions.push({
            job_id: l.job_id,
            employee_id: l.employee_id,
            employee_name: l.employees?.name ?? "—",
            step_id: l.step_id,
            step_name: l.steps?.step_name ?? "—",
            std: l.steps?.std_duration_minutes ?? null,
            start,
            finish,
            durationMin: (finish.getTime() - start.getTime()) / 60000,
          });
        }
      }
    }
    const inScopeSessions = allSessions.filter(
      (s) => !rangeStart || !rangeEnd || (s.finish >= rangeStart && s.finish < rangeEnd),
    );

    const wb = XLSX.utils.book_new();
    const want = (k: string) => cfg.sheets.has(k);

    // Info
    const fmtDate = (d: Date | null) => (d ? d.toLocaleString("th-TH") : "—");
    const empNameById = new Map(employees.map((e) => [e.id, e.name]));
    const stepNameById = new Map(steps.map((s) => [s.id, s.name]));
    const catNameById = new Map(categories.map((c) => [c.id, c.name]));
    const namesOf = (ids: Set<string>, src: Map<string, string>) =>
      ids.size === 0 ? "ทั้งหมด" : Array.from(ids).map((i) => src.get(i) ?? i).join(", ");
    const meta = [
      {
        Field: "ช่วงเวลา",
        Value:
          cfg.rangeMode === "all"
            ? "ทั้งหมด"
            : `${fmtDate(rangeStart)} → ${fmtDate(rangeEnd)}`,
      },
      { Field: "พนักงาน", Value: namesOf(cfg.empIds, empNameById) },
      { Field: "ขั้นตอน", Value: namesOf(cfg.stepIds, stepNameById) },
      { Field: "หมวดหมู่", Value: namesOf(cfg.catIds, catNameById) },
      { Field: "จำนวน log ในช่วง", Value: inScopeLogs.length },
      { Field: "วันที่ส่งออก", Value: new Date().toLocaleString("th-TH") },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "Info");

    // Ranking
    if (want("Ranking")) {
      const finishCountByEmp = new Map<string, number>();
      const seen = new Set<string>();
      for (const l of inScopeLogs) {
        if (l.action !== "finish") continue;
        const k = `${l.employee_id}|${l.job_id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        finishCountByEmp.set(l.employee_id, (finishCountByEmp.get(l.employee_id) ?? 0) + 1);
      }
      const baseEmps =
        cfg.empIds.size === 0
          ? employees
          : employees.filter((e) => cfg.empIds.has(e.id));
      const baseMap = new Map(baseEmps.map((e) => [e.id, e.name]));
      for (const id of finishCountByEmp.keys()) {
        if (!baseMap.has(id)) {
          const f = inScopeLogs.find((l) => l.employee_id === id);
          baseMap.set(id, f?.employees?.name ?? "—");
        }
      }
      const rows = Array.from(baseMap.entries())
        .map(([id, name]) => ({ id, name, jobs: finishCountByEmp.get(id) ?? 0 }))
        .sort((a, b) => b.jobs - a.jobs)
        .map((r, i) => ({ Rank: i + 1, Employee: r.name, Jobs_Finished: r.jobs }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Ranking");
    }

    // MoM — current range vs equivalent previous range
    if (want("MoM") && rangeStart && rangeEnd) {
      const span = rangeEnd.getTime() - rangeStart.getTime();
      const prevStart = new Date(rangeStart.getTime() - span);
      const prevEnd = rangeStart;
      const stat = (from: Date, to: Date) => {
        const m = new Map<string, { name: string; jobs: Set<string>; durations: number[] }>();
        for (const l of logs) {
          if (l.action !== "finish") continue;
          if (!matchEmp(l.employee_id) || !matchStep(l.step_id) || !matchCat(l.category_id))
            continue;
          const d = new Date(l.created_at);
          if (d < from || d >= to) continue;
          const cur = m.get(l.employee_id) ?? {
            name: l.employees?.name ?? "—",
            jobs: new Set<string>(),
            durations: [],
          };
          cur.jobs.add(l.job_id);
          m.set(l.employee_id, cur);
        }
        for (const s of allSessions) {
          if (s.finish < from || s.finish >= to) continue;
          const cur = m.get(s.employee_id) ?? {
            name: s.employee_name,
            jobs: new Set<string>(),
            durations: [],
          };
          cur.durations.push(s.durationMin);
          m.set(s.employee_id, cur);
        }
        return m;
      };
      const cur = stat(rangeStart, rangeEnd);
      const prev = stat(prevStart, prevEnd);
      const baseEmps =
        cfg.empIds.size === 0 ? employees : employees.filter((e) => cfg.empIds.has(e.id));
      const ids = new Set<string>([
        ...baseEmps.map((e) => e.id),
        ...cur.keys(),
        ...prev.keys(),
      ]);
      const rows = Array.from(ids).map((id) => {
        const c = cur.get(id);
        const p = prev.get(id);
        const name = c?.name ?? p?.name ?? empNameById.get(id) ?? "—";
        const curJ = c?.jobs.size ?? 0;
        const prevJ = p?.jobs.size ?? 0;
        const jobsPct = prevJ === 0 ? (curJ > 0 ? 100 : 0) : ((curJ - prevJ) / prevJ) * 100;
        const avg = (xs: number[]) =>
          xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
        const ca = avg(c?.durations ?? []);
        const pa = avg(p?.durations ?? []);
        const speedPct = ca == null || pa == null || pa === 0 ? null : ((ca - pa) / pa) * 100;
        return {
          Employee: name,
          Cur_Jobs: curJ,
          Prev_Jobs: prevJ,
          Jobs_MoM_Pct: Math.round(jobsPct * 10) / 10,
          Cur_AvgMin: ca != null ? Math.round(ca * 10) / 10 : "",
          Prev_AvgMin: pa != null ? Math.round(pa * 10) / 10 : "",
          Speed_MoM_Pct: speedPct == null ? "" : Math.round(speedPct * 10) / 10,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "MoM");
    }

    // Sessions
    if (want("Sessions")) {
      const rows = inScopeSessions
        .sort((a, b) => b.finish.getTime() - a.finish.getTime())
        .map((s) => ({
          Job_ID: s.job_id,
          Employee: s.employee_name,
          Step: s.step_name,
          Std_Min: s.std ?? "",
          Actual_Min: Math.round(s.durationMin * 10) / 10,
          Over_Min: s.std == null ? "" : Math.round((s.durationMin - s.std) * 10) / 10,
          Start: s.start.toLocaleString("th-TH"),
          Finish: s.finish.toLocaleString("th-TH"),
        }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Sessions");
    }

    // Over_Standard
    if (want("Over_Standard")) {
      const rows = inScopeSessions
        .filter((s) => s.std != null && s.durationMin > (s.std ?? 0))
        .map((s) => ({
          Employee: s.employee_name,
          Step: s.step_name,
          Job_ID: s.job_id,
          Std_Min: s.std,
          Actual_Min: Math.round(s.durationMin * 10) / 10,
          Over_Min: Math.round((s.durationMin - (s.std ?? 0)) * 10) / 10,
          Finished_At: s.finish.toLocaleString("th-TH"),
        }))
        .sort((a, b) => (b.Over_Min as number) - (a.Over_Min as number));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Over_Standard");
    }

    // By_Step
    if (want("By_Step")) {
      const m = new Map<string, number>();
      const seen = new Set<string>();
      for (const l of inScopeLogs) {
        if (l.action !== "finish") continue;
        const k = `${l.step_id}|${l.job_id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const n = l.steps?.step_name ?? "—";
        m.set(n, (m.get(n) ?? 0) + 1);
      }
      const rows = Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([Step, Jobs_Finished]) => ({ Step, Jobs_Finished }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "By_Step");
    }

    // By_Category
    if (want("By_Category")) {
      const m = new Map<string, number>();
      const seen = new Set<string>();
      for (const l of inScopeLogs) {
        if (l.action !== "finish") continue;
        const k = `${l.category_id ?? "none"}|${l.job_id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const n = l.categories?.name ?? "(ไม่ระบุ)";
        m.set(n, (m.get(n) ?? 0) + 1);
      }
      const rows = Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([Category, Jobs_Finished]) => ({ Category, Jobs_Finished }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "By_Category");
    }

    // Logs (raw)
    if (want("Logs")) {
      const rows = inScopeLogs.map((l) => ({
        Time: new Date(l.created_at).toLocaleString("th-TH"),
        Job_ID: l.job_id,
        Employee: l.employees?.name ?? "",
        Category: l.categories?.name ?? "",
        Step: l.steps?.step_name ?? "",
        Action: l.action === "start" ? "เริ่มงาน" : l.action === "finish" ? "เสร็จงาน" : l.action,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Logs");
    }

    XLSX.writeFile(wb, `summary_${scopeLabel}.xlsx`);
    toast.success("ส่งออก Excel สำเร็จ");
  };

  // Export dialog state
  const ALL_SHEETS = ["Ranking", "MoM", "Sessions", "Over_Standard", "By_Step", "By_Category", "Logs"];
  const [exportOpen, setExportOpen] = useState(false);
  const [exRange, setExRange] = useState<"current" | "custom" | "all">("current");
  const [exFrom, setExFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [exTo, setExTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exEmpIds, setExEmpIds] = useState<Set<string>>(new Set());
  const [exStepIds, setExStepIds] = useState<Set<string>>(new Set());
  const [exCatIds, setExCatIds] = useState<Set<string>>(new Set());
  const [exSheets, setExSheets] = useState<Set<string>>(() => new Set(ALL_SHEETS));

  const toggleInSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleExport = () => {
    if (exRange === "custom" && (!exFrom || !exTo || exFrom > exTo)) {
      toast.error("กรุณาเลือกช่วงเวลาให้ถูกต้อง");
      return;
    }
    runExport({
      rangeMode: exRange,
      fromDate: exFrom,
      toDate: exTo,
      empIds: exEmpIds,
      stepIds: exStepIds,
      catIds: exCatIds,
      sheets: exSheets,
    });
    setExportOpen(false);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            แดชบอร์ดการผลิต
          </h1>
          <p className="text-sm text-muted-foreground">
            ภาพรวมงาน ขั้นตอน และประสิทธิภาพพนักงาน
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-[170px]">
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
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="พนักงาน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">พนักงานทั้งหมด</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stepFilter} onValueChange={setStepFilter}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="ขั้นตอน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกขั้นตอน</SelectItem>
              {steps.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilter && (
            <Button
              onClick={() => {
                setCategoryFilter("all");
                setEmployeeFilter("all");
                setStepFilter("all");
              }}
              variant="ghost"
              size="sm"
            >
              ล้างฟิลเตอร์
            </Button>
          )}
          <Button
            onClick={() => setExportOpen(true)}
            size="sm"
            className="gap-2 bg-secondary hover:bg-secondary/90"
          >
            <FileSpreadsheet className="h-4 w-4" />
            สรุป Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<CheckSquare className="h-5 w-5" />}
          label="งานเสร็จวันนี้"
          value={stats.todayCount}
          tone="primary"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="งานเสร็จเดือนนี้"
          value={stats.monthCount}
          tone="secondary"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="บันทึกทั้งหมด"
          value={stats.total}
          tone="success"
        />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="performance">ประสิทธิภาพ</TabsTrigger>
          <TabsTrigger value="activity">กิจกรรมล่าสุด</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="14 วันล่าสุด — เริ่มงาน vs เสร็จงาน"
            icon={<TrendingUp className="h-4 w-4" />}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={days14}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 247)" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="starts" fill="oklch(0.60 0.20 256)" name="เริ่ม" radius={[4, 4, 0, 0]} />
                <Bar dataKey="finishes" fill="oklch(0.32 0.10 256)" name="เสร็จ" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="กิจกรรมรายขั้นตอน (30 วัน)" icon={<Activity className="h-4 w-4" />}>
            {stepPie.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stepPie} dataKey="value" nameKey="name" outerRadius={90} label>
                    {stepPie.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-border bg-muted p-1">
                <button
                  onClick={() => setScope("day")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    scope === "day"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setScope("month")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    scope === "month"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  รายเดือน
                </button>
              </div>
              {scope === "day" ? (
                <Input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="max-w-[180px]"
                />
              ) : (
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="max-w-[180px]"
                />
              )}
            </div>

            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-secondary" />
              อันดับพนักงาน — งานที่ทำเสร็จ
            </h3>
            {ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงเวลาที่เลือก</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, ranking.length * 36)}>
                <BarChart data={ranking} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 247)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                  <Tooltip />
                  <Bar dataKey="jobs" fill="oklch(0.60 0.20 256)" name="งานเสร็จ" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-secondary" />
              เปรียบเทียบเดือนนี้ vs เดือนก่อน (MoM)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3">พนักงาน</th>
                    <th className="pb-2 pr-3 text-right">งาน (เดือนนี้)</th>
                    <th className="pb-2 pr-3 text-right">งาน MoM %</th>
                    <th className="pb-2 pr-3 text-right">เวลาเฉลี่ย (นาที)</th>
                    <th className="pb-2 text-right">ความเร็ว MoM %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mom.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3 text-right">{r.curJobs}</td>
                      <td className="py-2 pr-3 text-right">
                        <PctBadge value={r.jobsPct} higherIsBetter />
                      </td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">
                        {r.curAvg != null ? r.curAvg.toFixed(1) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {r.speedPct == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <PctBadge value={-r.speedPct} higherIsBetter />
                        )}
                      </td>
                    </tr>
                  ))}
                  {mom.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        ยังไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              งานที่เกินเวลามาตรฐาน
            </h3>
            {overStandard.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ไม่มีงานเกินเวลามาตรฐานในช่วงเวลาที่เลือก 🎉
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3">พนักงาน</th>
                      <th className="pb-2 pr-3">ขั้นตอน</th>
                      <th className="pb-2 pr-3">Job</th>
                      <th className="pb-2 pr-3 text-right">มาตรฐาน</th>
                      <th className="pb-2 pr-3 text-right">จริง</th>
                      <th className="pb-2 text-right">เกิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overStandard.map((s, i) => (
                      <tr key={i} className="bg-destructive/5">
                        <td className="py-2 pr-3 font-medium">{s.employee_name}</td>
                        <td className="py-2 pr-3">{s.step_name}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-primary">{s.job_id}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">
                          {s.std} น.
                        </td>
                        <td className="py-2 pr-3 text-right">{s.durationMin.toFixed(1)} น.</td>
                        <td className="py-2 text-right font-bold text-destructive">
                          +{s.over.toFixed(1)} น.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-foreground">กิจกรรมล่าสุด</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
            ) : scopedLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีบันทึก</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3">เวลา</th>
                      <th className="pb-2 pr-3">Job</th>
                      <th className="pb-2 pr-3">พนักงาน</th>
                      <th className="pb-2 pr-3">ขั้นตอน</th>
                      <th className="pb-2">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {scopedLogs.slice(0, 30).map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {new Date(l.created_at).toLocaleString("th-TH")}
                        </td>
                        <td className="py-2 pr-3 font-mono font-semibold text-primary">
                          {l.job_id}
                        </td>
                        <td className="py-2 pr-3">{l.employees?.name ?? "—"}</td>
                        <td className="py-2 pr-3">{l.steps?.step_name ?? "—"}</td>
                        <td className="py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                              l.action === "finish"
                                ? "bg-primary/10 text-primary"
                                : "bg-secondary/15 text-secondary"
                            }`}
                          >
                            {l.action === "finish" ? "เสร็จ" : "เริ่ม"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function PctBadge({ value, higherIsBetter }: { value: number; higherIsBetter: boolean }) {
  const positive = value > 0.5;
  const negative = value < -0.5;
  const good = higherIsBetter ? positive : negative;
  const bad = higherIsBetter ? negative : positive;
  const cls = good
    ? "bg-success/15 text-success"
    : bad
      ? "bg-destructive/15 text-destructive"
      : "bg-muted text-muted-foreground";
  const Icon = positive ? ArrowUp : negative ? ArrowDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "secondary" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "secondary"
        ? "bg-secondary text-secondary-foreground"
        : "bg-success text-success-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold text-foreground">{value}</div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-secondary">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      ยังไม่มีกิจกรรมใน 30 วันล่าสุด
    </div>
  );
}
