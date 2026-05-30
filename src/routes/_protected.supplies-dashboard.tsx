// Admin dashboard for office supplies: pending requests, low stock, spend.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Package, CheckCircle2, XCircle, Plus, AlertTriangle, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  adminListOfficeRequests, adminApproveOfficeRequest, adminRejectOfficeRequest,
  adminOfficeRestock, adminOfficeStockDashboard, officeListEmployees,
} from "@/lib/office-requests.functions";
import { requireToken, showError } from "@/lib/admin-helpers";

export const Route = createFileRoute("/_protected/supplies-dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ดสต๊อกออฟฟิศ — WSC ProductionTrack" }] }),
  component: DashboardPage,
});

type Emp = { id: string; name: string; emp_code: string | null; active: boolean };
type ReqItem = { id: string; asset_id: string; asset_name_snapshot: string; unit_price_snapshot: number; qty: number };
type Req = {
  id: string; req_no: string; requester_name: string; status: string;
  note: string | null; approver_name: string | null;
  created_at: string; total_value: number; items: ReqItem[];
};
type Low = { id: string; code: string; name: string; stock_qty: number; min_qty: number; unit: string; image_url: string | null };

function DashboardPage() {
  const dash = useServerFn(adminOfficeStockDashboard);
  const listReq = useServerFn(adminListOfficeRequests);
  const listEmps = useServerFn(officeListEmployees);

  const [summary, setSummary] = useState<{
    pending_count: number; low_stock_count: number;
    month_spend: number; total_spend: number;
    low_stock: Low[]; top_consumed: { id: string; name: string; code: string; qty: number }[];
  } | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockFor, setRestockFor] = useState<Low | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const t = requireToken();
      const [s, r, e] = await Promise.all([
        dash({ data: { token: t } }),
        listReq({ data: { token: t, status: "pending", limit: 100 } }),
        listEmps({ data: { token: t } }),
      ]);
      setSummary(s);
      setRequests(r.rows as unknown as Req[]);
      setEmps(e.rows as Emp[]);
      window.dispatchEvent(new Event("wsc:office-refresh"));
    } catch (err) { showError(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  if (loading || !summary) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const outOfStock = summary.low_stock.filter((a) => a.stock_qty <= 0).length;
  const nearLow = summary.low_stock.length - outOfStock;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <Toaster richColors position="top-center" />

      {/* Alert banners */}
      {(summary.pending_count > 0 || summary.low_stock_count > 0) && (
        <div className="space-y-2">
          {summary.pending_count > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              <Package className="h-4 w-4 shrink-0" />
              <span>
                มี <b>{summary.pending_count}</b> คำขอเบิกรออนุมัติ — เลื่อนลงเพื่อดูรายการ
              </span>
            </div>
          )}
          {summary.low_stock_count > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {outOfStock > 0 && <><b>{outOfStock}</b> รายการ <b>หมดสต๊อก</b> · </>}
                {nearLow > 0 && <><b>{nearLow}</b> รายการ <b>ใกล้หมด</b> · </>}
                ต้องสั่งซื้อเพิ่ม
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="คำขอรออนุมัติ" value={summary.pending_count} icon={<Package className="h-4 w-4" />} tone={summary.pending_count > 0 ? "primary" : undefined} />
        <StatCard label="ของใกล้หมด" value={summary.low_stock_count} icon={<AlertTriangle className="h-4 w-4" />} tone={summary.low_stock_count > 0 ? "warn" : undefined} />
        <StatCard label={`ค่าใช้จ่ายเดือนนี้`} value={`฿${summary.month_spend.toLocaleString()}`} icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="ค่าใช้จ่ายสะสม" value={`฿${summary.total_spend.toLocaleString()}`} icon={<TrendingDown className="h-4 w-4" />} />
      </div>

      {/* Pending requests */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold">คำขอรออนุมัติ ({requests.length})</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">— ไม่มีคำขอรออนุมัติ —</p>
        ) : requests.map((r) => (
          <RequestCard key={r.id} req={r} emps={emps} onDone={refresh} />
        ))}
      </section>

      {/* Low stock */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold">สต๊อกใกล้หมด ({summary.low_stock.length})</h2>
        {summary.low_stock.length === 0 ? (
          <p className="text-sm text-muted-foreground">— สต๊อกเพียงพอ —</p>
        ) : (
          <div className="space-y-1.5">
            {summary.low_stock.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  {a.image_url ? (
                    <img src={a.image_url} alt="" className="h-10 w-10 rounded border object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted"><Package className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{a.code}</span> · เหลือ <b className="text-rose-600">{a.stock_qty}</b> / ขั้นต่ำ {a.min_qty} {a.unit}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setRestockFor(a)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />เติม
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Top consumed */}
      {summary.top_consumed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">รายการที่ถูกเบิกบ่อย</h2>
          <Card><CardContent className="p-3 space-y-1">
            {summary.top_consumed.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-right text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-muted-foreground">{t.qty} ครั้ง</span>
              </div>
            ))}
          </CardContent></Card>
        </section>
      )}

      {restockFor && (
        <RestockDialog asset={restockFor} onClose={() => { setRestockFor(null); refresh(); }} />
      )}
    </main>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone?: "primary" | "warn" }) {
  const color = tone === "primary" ? "text-primary" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <Card><CardContent className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </CardContent></Card>
  );
}

function RequestCard({ req, emps, onDone }: { req: Req; emps: Emp[]; onDone: () => void }) {
  const approve = useServerFn(adminApproveOfficeRequest);
  const reject = useServerFn(adminRejectOfficeRequest);
  const [approverId, setApproverId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const doApprove = async () => {
    if (!approverId) { toast.error("เลือกผู้อนุมัติก่อน"); return; }
    setBusy(true);
    try {
      await approve({ data: { token: requireToken(), id: req.id, approver_employee_id: approverId } });
      toast.success(`อนุมัติ ${req.req_no} แล้ว`);
      onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  const doReject = async () => {
    const reason = prompt(`เหตุผลที่ปฏิเสธ ${req.req_no}:`) ?? "";
    setBusy(true);
    try {
      await reject({ data: { token: requireToken(), id: req.id, approver_employee_id: approverId || undefined, reason: reason || undefined } });
      toast.success("ปฏิเสธคำขอแล้ว");
      onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">{req.req_no}</Badge>
          <span className="font-semibold">{req.requester_name}</span>
          <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString("th-TH")}</span>
          <span className="ml-auto text-sm font-semibold">฿{req.total_value.toLocaleString()}</span>
        </div>
        <div className="space-y-0.5 rounded border border-border bg-muted/30 p-2 text-sm">
          {req.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <span className="flex-1 truncate">{it.asset_name_snapshot}</span>
              <span className="text-muted-foreground">× {it.qty}</span>
              <span className="w-20 text-right text-muted-foreground">฿{(Number(it.unit_price_snapshot) * it.qty).toLocaleString()}</span>
            </div>
          ))}
        </div>
        {req.note && <div className="text-xs text-muted-foreground">หมายเหตุ: {req.note}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] flex-1">
            <Select value={approverId} onValueChange={setApproverId}>
              <SelectTrigger><SelectValue placeholder="ผู้อนุมัติ (พนักงานออฟฟิศ)" /></SelectTrigger>
              <SelectContent>
                {emps.filter((e) => e.active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}{e.emp_code ? ` (${e.emp_code})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={doReject}>
            <XCircle className="mr-1 h-4 w-4" />ปฏิเสธ
          </Button>
          <Button size="sm" disabled={busy || !approverId} onClick={doApprove}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            อนุมัติ & ตัดสต๊อก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RestockDialog({ asset, onClose }: { asset: Low; onClose: () => void }) {
  const restock = useServerFn(adminOfficeRestock);
  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (qty < 1) return;
    setBusy(true);
    try {
      await restock({ data: { token: requireToken(), asset_id: asset.id, qty, note: note.trim() || undefined } });
      toast.success(`เติม ${qty} ${asset.unit} แล้ว`);
      onClose();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>เติมสต๊อก: {asset.name}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">คงเหลือปัจจุบัน: {asset.stock_qty} {asset.unit}</div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">จำนวนที่เติม ({asset.unit})</label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={busy} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
