import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStorageUsage } from "@/lib/storage-usage.functions";
import { formatBytes, requireToken, showError } from "@/lib/admin-helpers";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Database, HardDrive, RefreshCw, Loader2, Folder } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_protected/storage")({
  head: () => ({ meta: [{ title: "พื้นที่จัดเก็บ — WSC ProductionTrack" }] }),
  component: StoragePage,
});

interface Usage {
  generated_at: string;
  database: {
    total_bytes: number;
    tables: Array<{ name: string; size_bytes: number; row_count: number }>;
  };
  storage: {
    total_bytes: number;
    buckets: Array<{ name: string; size_bytes: number; file_count: number }>;
  };
}

function StoragePage() {
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchUsage = useServerFn(getStorageUsage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const res = await fetchUsage({ data: { token } });
      setData(res as Usage);
    } catch (e) {
      showError(e, "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [fetchUsage]);

  useEffect(() => {
    load();
  }, [load]);

  const DB_LIMIT_MB = 500;
  const STORAGE_LIMIT_MB = 1024;
  const BYTES_PER_MB = 1_048_576;
  const dbUsedMB = (data?.database.total_bytes ?? 0) / BYTES_PER_MB;
  const stUsedMB = (data?.storage.total_bytes ?? 0) / BYTES_PER_MB;
  const dbPct = Math.min(100, (dbUsedMB / DB_LIMIT_MB) * 100);
  const stPct = Math.min(100, (stUsedMB / STORAGE_LIMIT_MB) * 100);

  const dbMax = Math.max(1, ...(data?.database.tables.map((t) => t.size_bytes) ?? [1]));
  const stMax = Math.max(1, ...(data?.storage.buckets.map((b) => b.size_bytes) ?? [1]));
  const grandTotal = (data?.database.total_bytes ?? 0) + (data?.storage.total_bytes ?? 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">การใช้พื้นที่จัดเก็บ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ติดตามขนาดฐานข้อมูลและไฟล์ทั้งหมดในระบบ เพื่อวางแผนเพิ่มพื้นที่
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading} className="gap-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Database className="h-5 w-5 text-secondary" />}
          label="ฐานข้อมูล"
          value={data ? formatBytes(data.database.total_bytes) : "—"}
        />
        <SummaryCard
          icon={<HardDrive className="h-5 w-5 text-secondary" />}
          label="ไฟล์ Storage"
          value={data ? formatBytes(data.storage.total_bytes) : "—"}
        />
        <SummaryCard
          icon={<Folder className="h-5 w-5 text-secondary" />}
          label="รวมทั้งหมด"
          value={data ? formatBytes(grandTotal) : "—"}
        />
      </div>

      {/* Database */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5 text-secondary" />
            ฐานข้อมูล (ต่อตาราง)
          </h2>
          <span className="text-sm font-medium text-muted-foreground">
            {data ? formatBytes(data.database.total_bytes) : ""}
          </span>
        </header>
        {loading && !data ? (
          <SkeletonRows />
        ) : (
          <ul className="space-y-3">
            {data?.database.tables.map((t) => (
              <li key={t.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-mono">{t.name}</span>
                  <span className="text-muted-foreground">
                    {formatBytes(t.size_bytes)} ·{" "}
                    <span className="tabular-nums">{t.row_count.toLocaleString()}</span> แถว
                  </span>
                </div>
                <Progress value={(t.size_bytes / dbMax) * 100} className="h-1.5" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Storage */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <HardDrive className="h-5 w-5 text-secondary" />
            ไฟล์ Storage (ต่อ bucket)
          </h2>
          <span className="text-sm font-medium text-muted-foreground">
            {data ? formatBytes(data.storage.total_bytes) : ""}
          </span>
        </header>
        {loading && !data ? (
          <SkeletonRows />
        ) : (
          <ul className="space-y-3">
            {data?.storage.buckets.map((b) => (
              <li key={b.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-mono">{b.name}</span>
                  <span className="text-muted-foreground">
                    {formatBytes(b.size_bytes)} ·{" "}
                    <span className="tabular-nums">{b.file_count.toLocaleString()}</span> ไฟล์
                  </span>
                </div>
                <Progress value={(b.size_bytes / stMax) * 100} className="h-1.5" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          อัปเดตล่าสุด: {new Date(data.generated_at).toLocaleString("th-TH")}
        </p>
      )}
    </main>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
