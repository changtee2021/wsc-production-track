// Public "ยื่นเบิกอุปกรณ์ออฟฟิศ" — employee picks items, submits a pending request.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Search, ArrowLeft, Package, Plus, Minus, ShoppingCart, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  issueOfficeSession, officeListAssets, officeListCategories,
} from "@/lib/features/office-assets.functions";
import { officeSubmitRequest, officeListEmployees } from "@/lib/features/office-requests.functions";
import {
  getOfficeToken, setOfficeToken, isOfficeSession,
} from "@/lib/auth/office-session";

export const Route = createFileRoute("/supplies-request")({
  head: () => ({
    meta: [
      { title: "เบิกอุปกรณ์ออฟฟิศ — WSC ProductionTrack" },
      { name: "description", content: "ยื่นคำขอเบิกอุปกรณ์ออฟฟิศและโรงงาน" },
    ],
  }),
  component: SuppliesRequestPage,
});

type Asset = {
  id: string; code: string; name: string;
  category_id: string | null; category_name: string | null;
  image_url: string | null; brand: string | null; model: string | null;
  stock_qty: number; min_qty: number; unit: string;
  purchase_price: number | null; active: boolean;
};
type Emp = { id: string; name: string; emp_code: string | null; avatar_url: string | null; active: boolean };

function SuppliesRequestPage() {
  const issue = useServerFn(issueOfficeSession);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isOfficeSession()) { setReady(true); return; }
    issue({ data: {} })
      .then((r) => { setOfficeToken(r.token); setReady(true); })
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
  return <RequestForm />;
}

function RequestForm() {
  const navigate = useNavigate();
  const listEmps = useServerFn(officeListEmployees);
  const list = useServerFn(officeListAssets);
  const listCats = useServerFn(officeListCategories);
  const submit = useServerFn(officeSubmitRequest);

  const [rows, setRows] = useState<Asset[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [empId, setEmpId] = useState<string>("");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    const token = getOfficeToken() ?? "";
    setLoading(true);
    Promise.all([
      list({ data: { token, includeInactive: false } }),
      listCats({ data: { token } }),
    ])
      .then(([a, c]) => {
        setRows(a.rows as unknown as Asset[]);
        setCats(c.rows as { id: string; name: string }[]);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [list, listCats]);

  useEffect(() => {
    (async () => {
      try {
        const token = getOfficeToken() ?? "";
        const res = await listEmps({ data: { token } });
        setEmps(res.rows as Emp[]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "โหลดพนักงานไม่สำเร็จ");
      }
    })();
  }, [listEmps]);


  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat !== "all" && (r.category_id ?? "__none__") !== cat) return false;
      if (!qq) return true;
      return (
        r.name.toLowerCase().includes(qq) ||
        r.code.toLowerCase().includes(qq) ||
        (r.brand ?? "").toLowerCase().includes(qq) ||
        (r.model ?? "").toLowerCase().includes(qq)
      );
    });
  }, [rows, q, cat]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => {
        const a = rows.find((r) => r.id === id);
        return { id, qty, asset: a };
      })
      .filter((x) => x.asset);
  }, [cart, rows]);

  const totalValue = useMemo(() => {
    return cartItems.reduce(
      (s, x) => s + x.qty * Number(x.asset?.purchase_price ?? 0), 0,
    );
  }, [cartItems]);

  const addQty = (id: string, max: number, delta: number) => {
    setCart((c) => {
      const cur = c[id] ?? 0;
      const next = Math.max(0, Math.min(max, cur + delta));
      const copy = { ...c };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (!empId) { toast.error("กรุณาเลือกพนักงาน"); return; }
    if (cartItems.length === 0) { toast.error("ยังไม่มีรายการในตะกร้า"); return; }
    setSubmitting(true);
    try {
      const r = await submit({
        data: {
          token: getOfficeToken() ?? "",
          requester_employee_id: empId,
          items: cartItems.map((c) => ({ asset_id: c.id, qty: c.qty })),
          note: note.trim() || undefined,
        },
      });
      toast.success(`ส่งคำขอแล้ว · ${r.req_no}`);
      setCart({}); setNote("");
      setTimeout(() => navigate({ to: "/" }), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งคำขอไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <Link to="/"><Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <h1 className="text-base font-semibold">เบิกอุปกรณ์ออฟฟิศ</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-3">
        <Card>
          <CardContent className="p-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">ผู้ขอเบิก *</label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="— เลือกพนักงาน —" /></SelectTrigger>
              <SelectContent>
                {emps.filter((e) => e.active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}{e.emp_code ? ` (${e.emp_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex gap-2">
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวด</SelectItem>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัส/ยี่ห้อ" className="pl-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">— ไม่พบรายการ —</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => {
              const inCart = cart[a.id] ?? 0;
              const out = (a.stock_qty ?? 0) <= 0;
              const low = !out && (a.stock_qty ?? 0) <= (a.min_qty ?? 0);
              return (
                <Card
                  key={a.id}
                  className={
                    out
                      ? "opacity-70 border-rose-300 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"
                      : low
                        ? "border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                        : ""
                  }
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.name} className="h-14 w-14 shrink-0 rounded border object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate">{a.name}</span>
                        {out ? (
                          <Badge variant="destructive">หมด</Badge>
                        ) : low ? (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">ใกล้หมด</Badge>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <span className="font-mono">{a.code}</span>
                        {a.category_name && ` · ${a.category_name}`}
                        {` · คงเหลือ ${a.stock_qty} ${a.unit}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="icon" variant="outline" disabled={inCart <= 0}
                        onClick={() => addQty(a.id, a.stock_qty, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{inCart}</span>
                      <Button size="icon" variant="outline" disabled={out || inCart >= a.stock_qty}
                        onClick={() => addQty(a.id, a.stock_qty, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {cartItems.length > 0 && (
          <Card className="border-primary/40">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-semibold">ตะกร้า ({cartItems.length} รายการ)</span>
                <span className="ml-auto text-sm">รวม ฿{totalValue.toLocaleString()}</span>
              </div>
              <div className="space-y-1">
                {cartItems.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{c.asset?.name}</span>
                    <span className="text-muted-foreground">× {c.qty}</span>
                    <Button size="icon" variant="ghost" onClick={() => addQty(c.id, c.asset!.stock_qty, -c.qty)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" />
            </CardContent>
          </Card>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button
            disabled={submitting || cartItems.length === 0 || !empId}
            className="h-12 w-full text-base font-bold"
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ยื่นขอเบิก {cartItems.length > 0 && `(${cartItems.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

