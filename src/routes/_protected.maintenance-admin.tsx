import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { adminMaintenanceSummary } from "@/lib/maintenance.functions";
import { getAdminToken } from "@/lib/auth/admin-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, AlertTriangle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_protected/maintenance-admin")({
  component: MaintenanceAdminPage,
});

type Summary = Awaited<ReturnType<typeof adminMaintenanceSummary>>;

const STATUS_LABEL: Record<string, string> = {
  open: "เปิดงาน",
  in_progress: "กำลังซ่อม",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-rose-500",
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
  cancelled: "bg-muted-foreground",
};

function MaintenanceAdminPage() {
  const fetchSummary = useServerFn(adminMaintenanceSummary);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchSummary({ data: { token } });
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-orange-600" />
          <h2 className="text-lg font-bold">สรุปงานซ่อมบำรุง</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            รีเฟรช
          </Button>
          <Link to="/maintenance">
            <Button size="sm" className="gap-1 bg-orange-600 hover:bg-orange-700">
              <ExternalLink className="h-4 w-4" />
              ไปหน้าแจ้งซ่อม
            </Button>
          </Link>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* Status counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["open", "in_progress", "done", "cancelled"] as const).map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {STATUS_LABEL[s]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[s]}`} />
                <span className="text-2xl font-bold">
                  {data?.counts[s] ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low stock */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            อะไหล่ใกล้หมด ({data?.lowStock.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.lowStock.length ? (
            <p className="text-sm text-muted-foreground">ทุกรายการมีสต๊อกเพียงพอ</p>
          ) : (
            <div className="space-y-1.5">
              {data.lowStock.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/30"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    {p.code && (
                      <div className="text-xs text-muted-foreground">{p.code}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-bold text-amber-700 dark:text-amber-400">
                      เหลือ {p.stock_qty} {p.unit}
                    </div>
                    <div className="text-muted-foreground">ขั้นต่ำ {p.min_qty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            ใบงานล่าสุด ({data?.tickets.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.tickets.length ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีใบงาน</p>
          ) : (
            <div className="space-y-1.5">
              {data.tickets.map((t) => {
                const asset = (t as { assets?: { name: string; code: string | null } | null }).assets;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[t.status]}`} />
                        <span className="font-mono text-xs font-bold">{t.ticket_no}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {STATUS_LABEL[t.status]}
                        </Badge>
                        {t.priority === "high" && (
                          <Badge className="bg-rose-500 text-[10px] hover:bg-rose-600">
                            ด่วน
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {asset?.name ?? "ไม่ระบุเครื่อง"}
                        {asset?.code ? ` (${asset.code})` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                      {new Date(t.reported_at).toLocaleString("th-TH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
