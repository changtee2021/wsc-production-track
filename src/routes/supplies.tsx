// Public "สต๊อกอุปกรณ์ออฟฟิศ" page — view-only catalogue for employees.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, ArrowLeft, Boxes, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  issueOfficeSession, officeListAssets, officeListCategories,
} from "@/lib/office-assets.functions";
import {
  getOfficeToken, setOfficeToken, isOfficeSession,
} from "@/lib/office-session";

export const Route = createFileRoute("/supplies")({
  head: () => ({
    meta: [
      { title: "สต๊อกอุปกรณ์ออฟฟิศ — WSC ProductionTrack" },
      { name: "description", content: "ค้นหารายการสินทรัพย์ออฟฟิศและโรงงาน" },
    ],
  }),
  component: SuppliesPage,
});

type Asset = {
  id: string; code: string; name: string;
  category_id: string | null; category_name: string | null;
  brand: string | null; model: string | null; serial_no: string | null;
  location: string | null; assignee: string | null;
  image_url: string | null; note: string | null;
  status: string; purchase_date: string | null;
  warranty_until: string | null;
};

function SuppliesPage() {
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
  return <SuppliesBrowse />;
}

const STATUS_LABEL: Record<string, string> = {
  in_use: "ใช้งานอยู่", repair: "ซ่อม", retired: "ปลดระวาง", lost: "สูญหาย",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_use: "default", repair: "secondary", retired: "outline", lost: "destructive",
};

function SuppliesBrowse() {
  const list = useServerFn(officeListAssets);
  const listCats = useServerFn(officeListCategories);
  const [rows, setRows] = useState<Asset[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getOfficeToken() ?? "";
    Promise.all([
      list({ data: { token } }),
      listCats({ data: { token } }),
    ])
      .then(([a, c]) => {
        setRows(a.rows as unknown as Asset[]);
        setCats(c.rows.map((r) => ({ id: r.id, name: r.name })));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [list, listCats]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat !== "all" && r.category_id !== cat) return false;
      if (!qq) return true;
      return (
        r.name.toLowerCase().includes(qq) ||
        r.code.toLowerCase().includes(qq) ||
        (r.brand ?? "").toLowerCase().includes(qq) ||
        (r.model ?? "").toLowerCase().includes(qq) ||
        (r.serial_no ?? "").toLowerCase().includes(qq) ||
        (r.location ?? "").toLowerCase().includes(qq) ||
        (r.assignee ?? "").toLowerCase().includes(qq)
      );
    });
  }, [rows, q, cat]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3">
          <Link to="/">
            <Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold sm:text-lg">สต๊อกอุปกรณ์ออฟฟิศ</h1>
            <p className="text-xs text-muted-foreground">รายการสินทรัพย์ออฟฟิศและโรงงาน</p>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-3 pb-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ / รหัส / ยี่ห้อ / Serial / สถานที่ / ผู้รับผิดชอบ"
              className="pl-8"
            />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="ทุกหมวด" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหมวด</SelectItem>
              {cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Boxes className="mx-auto mb-2 h-8 w-8 opacity-50" />
            — ไม่พบรายการ —
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{filtered.length} รายการ</p>
            {filtered.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-start gap-3 p-3">
                  {a.image_url ? (
                    <img
                      src={a.image_url}
                      alt={a.name}
                      loading="lazy"
                      className="h-20 w-20 shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                      <Package className="h-7 w-7" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{a.code}</span>
                      <span className="font-semibold leading-tight">{a.name}</span>
                      <Badge variant={STATUS_VARIANT[a.status] ?? "outline"} className="text-[10px]">
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.category_name ?? "— ไม่ระบุหมวด —"}
                      {a.brand && ` · ${a.brand}`}{a.model && ` ${a.model}`}
                    </div>
                    {(a.location || a.assignee) && (
                      <div className="mt-0.5 text-xs">
                        {a.location && <span>📍 {a.location}</span>}
                        {a.assignee && <span className="ml-2">👤 {a.assignee}</span>}
                      </div>
                    )}
                    {a.serial_no && (
                      <div className="text-xs text-muted-foreground">S/N: {a.serial_no}</div>
                    )}
                    {a.note && (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.note}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
