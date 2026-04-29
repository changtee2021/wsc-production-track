import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  Download,
  FileSpreadsheet,
  Activity,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_admin/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — ProductionTrack Admin" }],
  }),
  component: Dashboard,
});

interface LogRow {
  id: string;
  job_id: string;
  action: string;
  created_at: string;
  employees: { name: string } | null;
  steps: { step_name: string } | null;
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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("production_logs")
        .select("id, job_id, action, created_at, employees(name), steps(step_name)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) toast.error(error.message);
      setLogs((data as unknown as LogRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // "Jobs completed" = unique job_ids with a finish today/this month
    const finishedToday = new Set<string>();
    const finishedMonth = new Set<string>();
    for (const l of logs) {
      if (l.action !== "finish") continue;
      const d = new Date(l.created_at);
      if (d >= today) finishedToday.add(l.job_id);
      if (d >= monthStart) finishedMonth.add(l.job_id);
    }

    // Jobs completed per day for last 14 days (finishes)
    const days: { day: string; finishes: number; starts: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        finishes: 0,
        starts: 0,
      });
      for (const l of logs) {
        if (l.created_at.slice(0, 10) === key) {
          if (l.action === "finish") days[days.length - 1].finishes += 1;
          else days[days.length - 1].starts += 1;
        }
      }
    }

    // Per month for last 6 months
    const months: { month: string; finishes: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      let count = 0;
      const seen = new Set<string>();
      for (const l of logs) {
        if (l.action !== "finish") continue;
        const ld = new Date(l.created_at);
        if (ld >= d && ld < next && !seen.has(l.job_id)) {
          seen.add(l.job_id);
          count += 1;
        }
      }
      months.push({
        month: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        finishes: count,
      });
    }

    // Step distribution: in-progress jobs (started but not finished) per step
    // simpler: total starts per step over last 30 days
    const stepCounts = new Map<string, number>();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);
    for (const l of logs) {
      if (l.action !== "start") continue;
      if (new Date(l.created_at) < cutoff) continue;
      const name = l.steps?.step_name ?? "Unknown";
      stepCounts.set(name, (stepCounts.get(name) ?? 0) + 1);
    }
    const stepPie = Array.from(stepCounts.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    return {
      todayCount: finishedToday.size,
      monthCount: finishedMonth.size,
      total: logs.length,
      days,
      months,
      stepPie,
    };
  }, [logs]);

  const exportCSV = () => {
    const rows = logs.map((l) => ({
      job_id: l.job_id,
      employee: l.employees?.name ?? "",
      step: l.steps?.step_name ?? "",
      action: l.action,
      timestamp: new Date(l.created_at).toISOString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    download(csv, "production_logs.csv", "text/csv");
  };

  const exportXLSX = () => {
    const rows = logs.map((l) => ({
      Job_ID: l.job_id,
      Employee: l.employees?.name ?? "",
      Step: l.steps?.step_name ?? "",
      Action: l.action,
      Timestamp: new Date(l.created_at).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "production_logs.xlsx");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Production Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Live overview of jobs, steps, and worker activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={exportXLSX} className="gap-2 bg-secondary hover:bg-secondary/90">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<CheckSquare className="h-5 w-5" />}
          label="Jobs finished today"
          value={stats.todayCount}
          tone="primary"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Jobs finished this month"
          value={stats.monthCount}
          tone="secondary"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Total log entries"
          value={stats.total}
          tone="success"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Last 14 days — starts vs finishes"
          icon={<TrendingUp className="h-4 w-4" />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 247)" />
              <XAxis dataKey="day" fontSize={11} stroke="oklch(0.45 0.03 256)" />
              <YAxis fontSize={11} allowDecimals={false} stroke="oklch(0.45 0.03 256)" />
              <Tooltip />
              <Legend />
              <Bar dataKey="starts" fill="oklch(0.60 0.20 256)" name="Starts" radius={[4, 4, 0, 0]} />
              <Bar dataKey="finishes" fill="oklch(0.32 0.10 256)" name="Finishes" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Last 6 months — jobs completed"
          icon={<Calendar className="h-4 w-4" />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.01 247)" />
              <XAxis dataKey="month" fontSize={11} stroke="oklch(0.45 0.03 256)" />
              <YAxis fontSize={11} allowDecimals={false} stroke="oklch(0.45 0.03 256)" />
              <Tooltip />
              <Bar dataKey="finishes" fill="oklch(0.32 0.10 256)" name="Completed jobs" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Step activity (last 30 days)"
          icon={<Activity className="h-4 w-4" />}
          full
        >
          {stats.stepPie.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.stepPie}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {stats.stepPie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-foreground">Recent activity</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Job</th>
                  <th className="pb-2 pr-3">Employee</th>
                  <th className="pb-2 pr-3">Step</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.slice(0, 20).map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
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
                        {l.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
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
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
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
  full,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${
        full ? "lg:col-span-2" : ""
      }`}
    >
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
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      No activity in the last 30 days yet.
    </div>
  );
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
