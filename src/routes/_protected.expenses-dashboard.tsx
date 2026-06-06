// Admin inbox for AI-scanned expenses: approve / reject / mark paid / bulk.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, CheckCircle2, XCircle, Wallet, AlertTriangle, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  adminExpenseList, adminExpenseApprove, adminExpenseReject,
  adminExpenseMarkPaid, adminExpenseBulkApprove,
} from "@/lib/features/expenses-admin.functions";
import { officeListEmployees } from "@/lib/features/office-requests.functions";
import { requireToken, showError } from "@/lib/utils/admin-helpers";

export const Route = createFileRoute("/_protected/expenses-dashboard")({
  head: () => ({ meta: [{ title: "เบิกค่าใช้จ่าย — WSC ProductionTrack" }] }),
  component: Page,
});

type Row = {
  id: string; exp_no: string; status: string; bill_type: string;
  requester_name: string; merchant_name: string | null;
  receipt_no: string | null; receipt_date: string | null;
  subtotal: number; vat_amount: number; total_amount: number;
  image_paths: string[]; ai_confidence: number | null;
  duplicate_of: string | null; buyer_match_wsc: boolean;
  category_id: string | null; reject_reason: string | null;
  approver_name: string | null; created_at: string;
};
type Emp = { id: string; name: string; emp_code: string | null; active: boolean };

const BILL_LBL: Record<string, string> = {
  cash: "เงินสด", short_tax: "ใบกำกับย่อ", full_tax: "ใบกำกับเต็ม",
};

function Page() {
  const list = useServerFn(adminExpenseList);
  const listEmps = useServerFn(officeListEmployees);

  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "paid" | "all">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [cats, setCats] = useState<Record<string, string>>({});
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const t = requireToken();
      const [r, e] = await Promise.all([
        list({ data: { token: t, status, limit: 200 } }),
        listEmps({ data: { token: t } }),
      ]);
      setRows(r.rows as Row[]);
      setUrlMap(r.urlMap);
      setCats(r.categories);
      setEmps(e.rows as Emp[]);
      setSelected(new Set());
    } catch (err) { showError(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [status]);

  const toggle = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const doBulk = async () => {
    if (!approverId) { toast.error("เลือกผู้อนุมัติก่อน"); return; }
    if (selected.size === 0) { toast.error("เลือกรายการก่อน"); return; }
    try {
      const t = requireToken();
      const r = await useBulkApprove({
        data: { token: t, ids: Array.from(selected), approver_employee_id: approverId },
      });
      toast.success(`อนุมัติ ${r.ok} รายการ${r.fail ? ` (ล้มเหลว ${r.fail})` : ""}`);
      refresh();
    } catch (e) { showError(e); }
  };
  const useBulkApprove = useServerFn(adminExpenseBulkApprove);

  const totals = rows.reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-4">
      <Toaster richColors position="top-center" />
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={status} onValueChange={(v) => setStatus(v as never)}>
          <TabsList>
            <TabsTrigger value="pending">รออนุมัติ</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
            <TabsTrigger value="paid">จ่ายแล้ว</TabsTrigger>
            <TabsTrigger value="rejected">ไม่อนุมัติ</TabsTrigger>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto text-sm">
          รวม <b>{rows.length}</b> รายการ · <b>฿{totals.toLocaleString()}</b>
        </div>
      </div>

      {status === "pending" && (
        <Card><CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="min-w-[200px] flex-1">
            <Select value={approverId} onValueChange={setApproverId}>
              <SelectTrigger><SelectValue placeholder="ผู้อนุมัติ (พนักงานออฟฟิศ)" /></SelectTrigger>
              <SelectContent>
                {emps.filter((e) => e.active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}{e.emp_code ? ` (${e.emp_code})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={doBulk} disabled={!approverId || selected.size === 0}>
            <CheckCircle2 className="mr-1 h-4 w-4" />อนุมัติที่เลือก ({selected.size})
          </Button>
        </CardContent></Card>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">— ไม่มีรายการ —</p>
      ) : rows.map((r) => (
        <ExpenseCard
          key={r.id} row={r} cats={cats} emps={emps}
          urlMap={urlMap} approverId={approverId}
          selected={selected.has(r.id)} onToggle={() => toggle(r.id)}
          onDone={refresh} onPreview={setPreview}
        />
      ))}

      {preview && (
        <Dialog open onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-3xl p-0">
            <img src={preview} alt="receipt" className="max-h-[80vh] w-full object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}

function ExpenseCard({
  row, cats, emps, urlMap, approverId, selected, onToggle, onDone, onPreview,
}: {
  row: Row;
  cats: Record<string, string>;
  emps: Emp[];
  urlMap: Record<string, string>;
  approverId: string;
  selected: boolean;
  onToggle: () => void;
  onDone: () => void;
  onPreview: (url: string) => void;
}) {
  const approve = useServerFn(adminExpenseApprove);
  const reject = useServerFn(adminExpenseReject);
  const markPaid = useServerFn(adminExpenseMarkPaid);
  const [busy, setBusy] = useState(false);
  const [paidDialog, setPaidDialog] = useState(false);
  const [paidBy, setPaidBy] = useState("");

  const doApprove = async () => {
    if (!approverId) { toast.error("เลือกผู้อนุมัติก่อน"); return; }
    setBusy(true);
    try {
      await approve({ data: { token: requireToken(), id: row.id, approver_employee_id: approverId } });
      toast.success(`อนุมัติ ${row.exp_no}`); onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  const doReject = async () => {
    const reason = prompt(`เหตุผลที่ไม่อนุมัติ ${row.exp_no}:`);
    if (!reason || !reason.trim()) return;
    setBusy(true);
    try {
      await reject({
        data: {
          token: requireToken(), id: row.id,
          approver_employee_id: approverId || undefined, reason: reason.trim(),
        },
      });
      toast.success("ปฏิเสธแล้ว"); onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  const doMarkPaid = async () => {
    if (!paidBy.trim()) { toast.error("ระบุผู้จ่าย"); return; }
    setBusy(true);
    try {
      await markPaid({ data: { token: requireToken(), id: row.id, paid_by: paidBy.trim() } });
      toast.success("บันทึกการจ่าย"); setPaidDialog(false); onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };

  const conf = row.ai_confidence ?? null;

  return (
    <Card className={row.duplicate_of ? "border-rose-300" : undefined}>
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {row.status === "pending" && (
            <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4" />
          )}
          <Badge variant="outline" className="font-mono">{row.exp_no}</Badge>
          <Badge>{BILL_LBL[row.bill_type] ?? row.bill_type}</Badge>
          {row.duplicate_of && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />ซ้ำ</Badge>
          )}
          {row.buyer_match_wsc && <Badge variant="secondary">WSC</Badge>}
          {conf !== null && (
            <Badge variant={conf >= 0.8 ? "default" : "secondary"}>AI {Math.round(conf * 100)}%</Badge>
          )}
          {row.category_id && cats[row.category_id] && (
            <Badge variant="outline">{cats[row.category_id]}</Badge>
          )}
          <span className="ml-auto text-lg font-bold">฿{Number(row.total_amount).toLocaleString()}</span>
        </div>

        <div className="flex gap-3">
          <div className="flex gap-1">
            {(row.image_paths ?? []).slice(0, 3).map((p) => {
              const url = urlMap[p];
              return url ? (
                <button key={p} onClick={() => onPreview(url)} className="block">
                  <img src={url} alt="" className="h-16 w-16 rounded border object-cover" />
                </button>
              ) : (
                <div key={p} className="flex h-16 w-16 items-center justify-center rounded border bg-muted">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold truncate">{row.merchant_name || "—"}</div>
            <div className="text-xs text-muted-foreground">
              เลขที่ {row.receipt_no || "—"} · {row.receipt_date || "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              ผู้เบิก: <b>{row.requester_name}</b> · {new Date(row.created_at).toLocaleString("th-TH")}
            </div>
            <div className="text-xs text-muted-foreground">
              ก่อน VAT ฿{Number(row.subtotal).toLocaleString()} + VAT ฿{Number(row.vat_amount).toLocaleString()}
            </div>
            {row.reject_reason && <div className="text-xs text-rose-600">เหตุผล: {row.reject_reason}</div>}
            {row.approver_name && <div className="text-xs">โดย: {row.approver_name}</div>}
          </div>
        </div>

        {row.status === "pending" && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={doReject}>
              <XCircle className="mr-1 h-4 w-4" />ไม่อนุมัติ
            </Button>
            <Button size="sm" disabled={busy || !approverId} onClick={doApprove}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              อนุมัติ
            </Button>
          </div>
        )}
        {row.status === "approved" && (
          <div className="flex justify-end">
            <Button size="sm" variant="default" disabled={busy} onClick={() => setPaidDialog(true)}>
              <Wallet className="mr-1 h-4 w-4" />ระบุว่าจ่ายแล้ว
            </Button>
          </div>
        )}

        {paidDialog && (
          <Dialog open onOpenChange={setPaidDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>บันทึกการจ่าย: {row.exp_no}</DialogTitle></DialogHeader>
              <Input placeholder="ชื่อผู้จ่าย / วิธีจ่าย" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaidDialog(false)}>ยกเลิก</Button>
                <Button onClick={doMarkPaid} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
