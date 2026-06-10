// Admin: รายงานการนับสต๊อก
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListBatches,
  adminListBatchLines,
  adminReopenBatch,
  type StockCountBatch,
  type StockCountRow,
} from "@/lib/stock-count.functions";
import { requireToken, showError } from "@/lib/admin-helpers";
import { getAdminCompany } from "@/lib/admin-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmployeeNameButton } from "@/components/EmployeeNameButton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, RefreshCw, FileText, RotateCcw, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_protected/stock-count-reports")({
  head: () => ({ meta: [{ title: "รายงานนับสต๊อก — Admin" }] }),
  component: StockReportsPage,
});

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

function StockReportsPage() {
  const listFn = useServerFn(adminListBatches);
  const linesFn = useServerFn(adminListBatchLines);
  const reopenFn = useServerFn(adminReopenBatch);

  const [batches, setBatches] = useState<StockCountBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"submitted" | "draft" | "all">("submitted");
  const [openBatch, setOpenBatch] = useState<StockCountBatch | null>(null);
  const [lines, setLines] = useState<StockCountRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = requireToken();
      const company = (getAdminCompany() ?? "wsc") as "wsc" | "wp";
      const rows = await listFn({
        data: { adminToken: token, company, status },
      });
      setBatches(rows as StockCountBatch[]);
    } catch (e) {
      showError(e, "โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [listFn, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (b: StockCountBatch) => {
    setOpenBatch(b);
    setLines([]);
    setLinesLoading(true);
    try {
      const token = requireToken();
      const rows = await linesFn({ data: { adminToken: token, batchId: b.id } });
      setLines(rows as StockCountRow[]);
    } catch (e) {
      showError(e, "โหลดรายละเอียดไม่สำเร็จ");
    } finally {
      setLinesLoading(false);
    }
  };

  const reopen = async (b: StockCountBatch) => {
    if (!confirm(`เปิด Batch #${b.batch_no} กลับเป็น draft?`)) return;
    try {
      const token = requireToken();
      await reopenFn({ data: { adminToken: token, batchId: b.id } });
      toast.success("เปิดกลับเป็น draft แล้ว");
      await load();
    } catch (e) {
      showError(e, "ดำเนินการไม่สำเร็จ");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <Toaster richColors position="top-center" />
      <div className="flex items-center gap-2">
        <ClipboardList className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">รายงานการนับสต๊อก</h1>
      </div>

      <div className="flex gap-2 items-center">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">ส่งแล้ว</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="all">ทั้งหมด</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Batch</th>
                  <th className="text-left p-2">ผู้นับ</th>
                  <th className="text-left p-2">เวลา</th>
                  <th className="text-right p-2">รวม</th>
                  <th className="text-right p-2">ตรง</th>
                  <th className="text-right p-2">ขาด</th>
                  <th className="text-right p-2">เกิน</th>
                  <th className="text-left p-2">สถานะ</th>
                  <th className="text-right p-2">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="text-center p-6 text-muted-foreground">
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                )}
                {batches.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 font-mono">#{b.batch_no}</td>
                    <td className="p-2">
                      {b.counted_by_name ? (
                        <EmployeeNameButton name={b.counted_by_name} emp_code={b.counted_by_emp_code ?? null} />
                      ) : "-"}
                      {b.counted_by_emp_code ? (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({b.counted_by_emp_code})
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2">{fmtDate(b.submitted_at ?? b.created_at)}</td>
                    <td className="p-2 text-right">{b.stats.total}</td>
                    <td className="p-2 text-right text-green-600">{b.stats.match}</td>
                    <td className="p-2 text-right text-red-600">{b.stats.short}</td>
                    <td className="p-2 text-right text-amber-600">{b.stats.over}</td>
                    <td className="p-2">
                      {b.status === "submitted" ? (
                        <Badge variant="default">ส่งแล้ว</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(b)}>
                        <FileText className="size-4" />
                      </Button>
                      {b.status === "submitted" && (
                        <Button size="sm" variant="ghost" onClick={() => reopen(b)}>
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!openBatch} onOpenChange={(o) => !o && setOpenBatch(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Batch #{openBatch?.batch_no} — {openBatch?.counted_by_name}
            </DialogTitle>
          </DialogHeader>
          {linesLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">รหัส</th>
                    <th className="text-left p-2">ชื่อ</th>
                    <th className="text-right p-2">นับได้</th>
                    <th className="text-right p-2">ในระบบ</th>
                    <th className="text-right p-2">ส่วนต่าง</th>
                    <th className="text-left p-2">สถานะ</th>
                    <th className="text-left p-2">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2 font-mono">{l.item_code}</td>
                      <td className="p-2">{l.item_name}</td>
                      <td className="p-2 text-right">{l.counted_qty}</td>
                      <td className="p-2 text-right">{l.system_qty}</td>
                      <td
                        className={`p-2 text-right font-semibold ${
                          l.variance < 0
                            ? "text-red-600"
                            : l.variance > 0
                              ? "text-amber-600"
                              : "text-green-600"
                        }`}
                      >
                        {l.variance > 0 ? "+" : ""}{l.variance}
                      </td>
                      <td className="p-2">
                        {l.status === "match" && <Badge variant="secondary">ตรง</Badge>}
                        {l.status === "short" && <Badge variant="destructive">ขาด</Badge>}
                        {l.status === "over" && <Badge variant="default">เกิน</Badge>}
                      </td>
                      <td className="p-2 text-muted-foreground">{l.note}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center p-4 text-muted-foreground">
                        ไม่มีรายการ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
