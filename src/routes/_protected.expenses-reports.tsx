// Monthly expense report with KPI, breakdowns, depreciation, CSV/print export.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { adminExpenseMonthlyReport } from "@/lib/expenses-admin.functions";
import { requireToken, showError } from "@/lib/admin-helpers";

export const Route = createFileRoute("/_protected/expenses-reports")({
  head: () => ({ meta: [{ title: "รายงานค่าใช้จ่ายรายเดือน — WSC" }] }),
  component: Page,
});

const BILL_LBL: Record<string, string> = {
  cash: "เงินสด", short_tax: "ใบกำกับย่อ", full_tax: "ใบกำกับเต็ม",
};

type Report = Awaited<ReturnType<typeof adminExpenseMonthlyReport>>;

function Page() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const run = useServerFn(adminExpenseMonthlyReport);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await run({ data: { token: requireToken(), year, month } });
      setData(r as Report);
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [year, month]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["exp_no", "status", "requester", "merchant", "bill_type", "receipt_no", "receipt_date", "subtotal", "vat", "total"],
      ...data.rows.map((r) => [
        r.exp_no, r.status, r.requester_name, r.merchant_name ?? "",
        r.bill_type, r.receipt_no ?? "", r.receipt_date ?? "",
        String(r.subtotal), String(r.vat_amount), String(r.total_amount),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `expenses-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 print:p-0">
      <Toaster richColors position="top-center" />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4].map((n) => {
              const y = now.getFullYear() - n;
              return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>เดือน {m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={!data}><Download className="mr-1 h-4 w-4" />CSV</Button>
        <Button variant="outline" onClick={() => window.print()} disabled={!data}><Printer className="mr-1 h-4 w-4" />พิมพ์</Button>
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <h2 className="text-lg font-bold">รายงานค่าใช้จ่าย {data.period.month}/{data.period.year}</h2>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label="ค่าใช้จ่ายรวม (อนุมัติ+จ่ายแล้ว)" value={`฿${data.totals.total_expense.toLocaleString()}`} />
            <Kpi label="VAT รวม" value={`฿${data.totals.vat.toLocaleString()}`} />
            <Kpi label="ค่าเสื่อม/เดือน" value={`฿${data.totals.depreciation_monthly.toLocaleString()}`} />
            <Kpi label="รวมทั้งสิ้น" value={`฿${data.totals.grand_total.toLocaleString()}`} tone="primary" />
          </div>

          <Card><CardContent className="space-y-2 p-3">
            <h3 className="font-semibold">สรุปตามสถานะ</h3>
            <Table><TableHeader><TableRow>
              <TableHead>สถานะ</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">ยอด (฿)</TableHead>
            </TableRow></TableHeader><TableBody>
              {Object.entries(data.by_status).map(([k, v]) => (
                <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right">{v.total.toLocaleString()}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>

          <Card><CardContent className="space-y-2 p-3">
            <h3 className="font-semibold">สรุปตามหมวด</h3>
            <Table><TableHeader><TableRow>
              <TableHead>หมวด</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">ยอด (฿)</TableHead>
            </TableRow></TableHeader><TableBody>
              {data.by_category.map((c) => (
                <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right">{c.count}</TableCell><TableCell className="text-right">{c.total.toLocaleString()}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>

          <Card><CardContent className="space-y-2 p-3">
            <h3 className="font-semibold">สรุปตามประเภทบิล</h3>
            <Table><TableHeader><TableRow>
              <TableHead>ประเภท</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">VAT</TableHead><TableHead className="text-right">ยอด</TableHead>
            </TableRow></TableHeader><TableBody>
              {Object.entries(data.by_bill_type).map(([k, v]) => (
                <TableRow key={k}><TableCell>{BILL_LBL[k] ?? k}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right">{v.vat.toLocaleString()}</TableCell><TableCell className="text-right">{v.total.toLocaleString()}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>

          <Card><CardContent className="space-y-2 p-3">
            <h3 className="font-semibold">สรุปตามผู้เบิก</h3>
            <Table><TableHeader><TableRow>
              <TableHead>ผู้เบิก</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">ยอด (฿)</TableHead>
            </TableRow></TableHeader><TableBody>
              {data.by_requester.map((c) => (
                <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right">{c.count}</TableCell><TableCell className="text-right">{c.total.toLocaleString()}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>

          <Card><CardContent className="space-y-2 p-3">
            <h3 className="font-semibold">ค่าเสื่อมราคา (Straight-line, รายเดือน)</h3>
            <Table><TableHeader><TableRow>
              <TableHead>รหัส</TableHead><TableHead>สินทรัพย์</TableHead>
              <TableHead className="text-right">ราคาซื้อ</TableHead>
              <TableHead className="text-right">ค่าเสื่อม/เดือน</TableHead>
              <TableHead className="text-right">สะสม</TableHead>
              <TableHead className="text-right">มูลค่าคงเหลือ</TableHead>
            </TableRow></TableHeader><TableBody>
              {data.depreciation_rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.purchase_price.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.monthly.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.accumulated.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.book_value.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </main>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "primary" }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone === "primary" ? "text-primary" : ""}`}>{value}</div>
    </CardContent></Card>
  );
}
