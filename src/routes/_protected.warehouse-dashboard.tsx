import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Layers, Truck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminToken } from "@/lib/auth/admin-session";
import { adminWhDashboardKpis } from "@/lib/features/warehouse-reports.functions";

export const Route = createFileRoute("/_protected/warehouse-dashboard")({
  head: () => ({ meta: [{ title: "คลังสินค้า Dashboard" }] }),
  component: WarehouseDashboard,
});

function KpiCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: typeof Package;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function WarehouseDashboard() {
  const token = getAdminToken() ?? "";
  const kpisFn = useServerFn(adminWhDashboardKpis);
  const { data } = useQuery({
    queryKey: ["wh-dashboard"],
    queryFn: () => kpisFn({ data: { token } }),
    enabled: !!token,
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">คลังสินค้า — Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="กล่องรับวันนี้" value={data?.boxes_received_today ?? 0} icon={Package} />
        <KpiCard title="Pallet จัดวันนี้" value={data?.pallets_today ?? 0} icon={Layers} />
        <KpiCard title="รอส่งออก" value={data?.pending_export ?? 0} icon={Truck} />
        <KpiCard title="นับไม่ครบ" value={data?.incomplete_counts ?? 0} icon={AlertTriangle} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">กล่องรับ 7 วันล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-2">
            {(data?.boxes_last_7_days ?? []).map((d) => {
              const max = Math.max(...(data?.boxes_last_7_days ?? []).map((x) => x.boxes), 1);
              const h = (d.boxes / max) * 100;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${Math.max(h, 4)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">สถานะ Pallet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {Object.entries(data?.pallet_status ?? {}).map(([k, v]) => (
            <span key={k} className="rounded-full border px-3 py-1 text-sm">
              {k}: {v}
            </span>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
