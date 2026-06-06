// Worker history page — list expenses by employee.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2, ArrowLeft, Camera, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  issueExpenseSession, expenseListMine, expenseListEmployees, expenseSignReceiptUrls,
} from "@/lib/expenses.functions";
import { getExpenseToken, setExpenseToken, isExpenseSession } from "@/lib/auth/expense-session";

export const Route = createFileRoute("/expense-mine")({
  validateSearch: z.object({ emp: z.string().optional() }),
  head: () => ({ meta: [{ title: "ประวัติเบิกของฉัน — WSC ProductionTrack" }] }),
  component: Page,
});

type Row = {
  id: string; exp_no: string; status: string;
  merchant_name: string | null; total_amount: number; receipt_date: string | null;
  bill_type: string; image_paths: string[]; created_at: string;
  reject_reason: string | null; requester_name: string;
};
type Emp = { id: string; name: string; emp_code: string | null; group: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "รออนุมัติ", cls: "bg-amber-500" },
  approved: { label: "อนุมัติแล้ว", cls: "bg-emerald-600" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-rose-600" },
  paid: { label: "จ่ายแล้ว", cls: "bg-blue-600" },
};

function Page() {
  const issue = useServerFn(issueExpenseSession);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isExpenseSession()) { setReady(true); return; }
    issue({ data: {} })
      .then((r) => { setExpenseToken(r.token); setReady(true); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "เข้าระบบไม่สำเร็จ"));
  }, [issue]);
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Toaster richColors position="top-center" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Inner />;
}

function Inner() {
  const search = Route.useSearch();
  const listEmps = useServerFn(expenseListEmployees);
  const listMine = useServerFn(expenseListMine);
  const signUrls = useServerFn(expenseSignReceiptUrls);

  const [emps, setEmps] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState(search.emp ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = getExpenseToken()!;
    listEmps({ data: { token: t } }).then((r) => setEmps(r.rows as Emp[])).catch(() => {});
  }, [listEmps]);

  useEffect(() => {
    if (!empId) { setRows([]); return; }
    (async () => {
      setLoading(true);
      try {
        const t = getExpenseToken()!;
        const r = await listMine({ data: { token: t, requester_employee_id: empId, limit: 50 } });
        setRows(r.rows as Row[]);
        const allPaths = Array.from(new Set((r.rows as Row[]).flatMap((x) => x.image_paths ?? [])));
        if (allPaths.length) {
          const u = await signUrls({ data: { token: t, paths: allPaths } });
          setUrls(u.urlMap);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      } finally { setLoading(false); }
    })();
  }, [empId, listMine, signUrls]);

  return (
    <main className="min-h-screen bg-muted/30 pb-10">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Link to="/"><Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-base font-bold">ประวัติเบิกของฉัน</h1>
        <Link to="/expense-scan" className="ml-auto">
          <Button size="sm" className="gap-1"><Camera className="h-4 w-4" />เบิกใหม่</Button>
        </Link>
      </header>

      <div className="mx-auto max-w-md space-y-3 p-3">
        <Card><CardContent className="p-3">
          <Select value={empId} onValueChange={setEmpId}>
            <SelectTrigger><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger>
            <SelectContent>
              {emps.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}{e.emp_code ? ` (${e.emp_code})` : ""}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardContent></Card>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !empId ? (
          <p className="text-center text-sm text-muted-foreground">เลือกพนักงานเพื่อดูประวัติ</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">— ยังไม่มีรายการ —</p>
        ) : rows.map((r) => {
          const s = STATUS[r.status] ?? { label: r.status, cls: "bg-muted" };
          const img = r.image_paths?.[0] ? urls[r.image_paths[0]] : null;
          return (
            <Card key={r.id}>
              <CardContent className="flex gap-3 p-3">
                {img ? (
                  <img src={img} alt="" className="h-20 w-16 rounded border object-cover" />
                ) : (
                  <div className="flex h-20 w-16 items-center justify-center rounded border bg-muted">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{r.exp_no}</Badge>
                    <Badge className={`${s.cls} text-white hover:${s.cls}`}>{s.label}</Badge>
                  </div>
                  <div className="text-sm font-semibold truncate">{r.merchant_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.receipt_date || new Date(r.created_at).toLocaleDateString("th-TH")}
                  </div>
                  {r.reject_reason && (
                    <div className="text-xs text-rose-600">เหตุผล: {r.reject_reason}</div>
                  )}
                </div>
                <div className="text-right text-sm font-bold">฿{Number(r.total_amount).toLocaleString()}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
