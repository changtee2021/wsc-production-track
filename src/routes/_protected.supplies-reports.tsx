// Admin report — สรุปค่าเสื่อมสินทรัพย์ออฟฟิศ (B1)
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Download, TrendingDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { adminOfficeSummary } from "@/lib/office-assets.functions";
import { requireToken, showError } from "@/lib/admin-helpers";

export const Route = createFileRoute("/_protected/supplies-reports")({
  head: () => ({ meta: [{ title: "รายงานค่าเสื่อมสินทรัพย์ — WSC ProductionTrack" }] }),
  component: SuppliesReportsPage,
});

type Summary = Awaited<ReturnType<typeof adminOfficeSummary>>;

const fmt = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function SuppliesReportsPage() {
  const fetchSummary = useServerFn(adminOfficeSummary);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary({ data: { token: requireToken() } })
      .then(setData)
      .catch((e) => showError(e))
      .finally(() => setLoading(false));
  }, [fetchSummary]);

  const exportCsv = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push("ประเภท,ชื่อ,จำนวน,ราคาทุน,ค่าเสื่อมสะสม,มูลค่าคงเหลือ");
    lines.push(`รวมทั้งหมด,—,${data.total.count},${data.total.cost},${data.total.accumulated},${data.total.book}`);
    lines.push("");
    lines.push("=== สรุปตามหมวด ===");
    for (const c of data.byCategory) {
      lines.push(`หมวด,"${c.category_name}",${c.count},${c.cost},${c.accumulated},${c.book}`);
    }
    lines.push("");
    lines.push("=== สรุปตามปี (ปีที่ซื้อ) ===");
    for (const y of data.byYear) {
      lines.push(`ปี,${y.year},${y.count},${y.cost},${y.accumulated},${y.book}`);
    }
    if (data.fullyDepreciatedList.length) {
      lines.push("");
      lines.push("=== หมดอายุค่าเสื่อม ===");
      lines.push("รหัส,ชื่อ,หมวด,วันที่ซื้อ,ราคาทุน,มูลค่าคงเหลือ");
      for (const a of data.fullyDepreciatedList) {
        lines.push(`${a.code},"${a.name}","${a.category_name ?? ""}",${a.purchase_date ?? ""},${a.purchase_price},${a.book_value}`);
      }
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `office-assets-depreciation-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลดแล้ว");
  };

  if (loading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <Toaster richColors position="top-center" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!data) return null;

  const maxCost = Math.max(1, ...data.byCategory.map((c) => c.cost));

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">รายงานค่าเสื่อมสินทรัพย์</h1>
          <p className="text-sm text-muted-foreground">
            คำนวณแบบเส้นตรง (Straight-line) จากข้อมูลปัจจุบัน
          </p>
        </div>
        <Button onClick={exportCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
      </div>

      {/* Totals */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="จำนวนสินทรัพย์" value={String(data.total.count)} />
        <StatCard label="ราคาทุนรวม" value={fmt(data.total.cost)} />
        <StatCard label="ค่าเสื่อมสะสม" value={fmt(data.total.accumulated)} tone="warn" />
        <StatCard label="มูลค่าคงเหลือ" value={fmt(data.total.book)} tone="good" />
      </div>

      {/* By category */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">สรุปตามหมวด</CardTitle></CardHeader>
        <CardContent>
          {data.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">— ยังไม่มีข้อมูล —</p>
          ) : (
            <div className="space-y-3">
              {data.byCategory.map((c) => (
                <div key={c.category_name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{c.category_name} <span className="text-xs text-muted-foreground">({c.count})</span></span>
                    <span className="text-xs text-muted-foreground">
                      ทุน {fmt(c.cost)} · คงเหลือ <b className="text-foreground">{fmt(c.book)}</b>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${(c.cost / maxCost) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* By year */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">สรุปตามปีที่ซื้อ</CardTitle></CardHeader>
        <CardContent>
          {data.byYear.length === 0 ? (
            <p className="text-sm text-muted-foreground">— ยังไม่มีข้อมูล —</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2">ปี</th>
                    <th className="py-1 pr-2 text-right">จำนวน</th>
                    <th className="py-1 pr-2 text-right">ราคาทุน</th>
                    <th className="py-1 pr-2 text-right">ค่าเสื่อมสะสม</th>
                    <th className="py-1 text-right">มูลค่าคงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byYear.map((y) => (
                    <tr key={y.year} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 font-mono">{y.year}</td>
                      <td className="py-1.5 pr-2 text-right">{y.count}</td>
                      <td className="py-1.5 pr-2 text-right">{fmt(y.cost)}</td>
                      <td className="py-1.5 pr-2 text-right text-amber-600">{fmt(y.accumulated)}</td>
                      <td className="py-1.5 text-right font-semibold">{fmt(y.book)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fully depreciated */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4" />หมดอายุค่าเสื่อมแล้ว ({data.fullyDepreciatedList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.fullyDepreciatedList.length === 0 ? (
            <p className="text-sm text-muted-foreground">— ไม่มี —</p>
          ) : (
            <div className="space-y-1">
              {data.fullyDepreciatedList.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate"><span className="font-mono text-xs text-muted-foreground">{a.code}</span> {a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.category_name ?? "—"} · ซื้อ {a.purchase_date ?? "—"} · ทุน {fmt(a.purchase_price)}
                    </div>
                  </div>
                  <Badge variant="secondary">คงเหลือ {fmt(a.book_value)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color =
    tone === "good" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
