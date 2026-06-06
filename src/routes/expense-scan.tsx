// Public AI Receipt Scanner — upload → AI extract → review → submit.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Camera, ArrowLeft, Sparkles, Trash2, AlertTriangle, ImagePlus, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  issueExpenseSession, expenseUploadReceipt, expenseScanReceipt,
  expenseSubmit, expenseListEmployees, expenseListCategories, expenseCheckDuplicate,
} from "@/lib/expenses.functions";
import {
  getExpenseToken, setExpenseToken, isExpenseSession,
} from "@/lib/auth/expense-session";

export const Route = createFileRoute("/expense-scan")({
  head: () => ({ meta: [{ title: "AI สแกนใบเสร็จ — WSC ProductionTrack" }] }),
  component: Page,
});

type Emp = { id: string; name: string; emp_code: string | null; group: string };
type Cat = { id: string; name: string; keywords: string[]; sort_order: number };
type Uploaded = { path: string; previewUrl: string; mime: string };

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
  return <Form />;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function Form() {
  const navigate = useNavigate();
  const upload = useServerFn(expenseUploadReceipt);
  const scan = useServerFn(expenseScanReceipt);
  const submit = useServerFn(expenseSubmit);
  const listEmps = useServerFn(expenseListEmployees);
  const listCats = useServerFn(expenseListCategories);
  const checkDup = useServerFn(expenseCheckDuplicate);

  const [emps, setEmps] = useState<Emp[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [empId, setEmpId] = useState("");
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields (post-scan)
  const [billType, setBillType] = useState<"cash" | "short_tax" | "full_tax">("cash");
  const [merchant, setMerchant] = useState("");
  const [taxId, setTaxId] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [subtotal, setSubtotal] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState("");
  const [buyerMatchWsc, setBuyerMatchWsc] = useState(false);
  const [aiExtracted, setAiExtracted] = useState<unknown>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [dupes, setDupes] = useState<Array<{ exp_no: string; requester_name: string; total_amount: number }>>([]);

  useEffect(() => {
    const t = getExpenseToken()!;
    listEmps({ data: { token: t } }).then((r) => setEmps(r.rows as Emp[])).catch(() => {});
    listCats({ data: { token: t } }).then((r) => setCats(r.rows as Cat[])).catch(() => {});
  }, [listEmps, listCats]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!fs.length) return;
    if (files.length + fs.length > 3) {
      toast.error("อัปโหลดได้สูงสุด 3 รูป/ไฟล์");
      return;
    }
    setUploading(true);
    try {
      const t = getExpenseToken()!;
      for (const f of fs) {
        const b64 = await fileToBase64(f);
        const r = await upload({ data: { token: t, dataBase64: b64 } });
        setFiles((p) => [...p, r]);
      }
      toast.success("อัปโหลดเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (path: string) => setFiles((p) => p.filter((x) => x.path !== path));

  const runScan = async () => {
    if (!files.length) { toast.error("เพิ่มรูปใบเสร็จก่อน"); return; }
    setScanning(true);
    try {
      const t = getExpenseToken()!;
      const r = await scan({ data: { token: t, image_paths: files.map((f) => f.path) } });
      const s = r.scan;
      setBillType(s.bill_type);
      setMerchant(s.merchant_name ?? "");
      setTaxId(s.tax_id ?? "");
      setReceiptNo(s.receipt_no ?? "");
      setReceiptDate(s.receipt_date ?? "");
      setSubtotal(Number(s.subtotal) || 0);
      setVatAmount(Number(s.vat_amount) || 0);
      setTotalAmount(Number(s.total_amount) || 0);
      setBuyerMatchWsc(Boolean(s.buyer_match_wsc));
      setCategoryId(s.suggested_category_id ?? "");
      setAiExtracted(s);
      setAiConfidence(Number(s.confidence) || 0);
      if (s.notes) toast.message(s.notes);
      toast.success(`AI อ่านใบเสร็จเสร็จ (มั่นใจ ${Math.round((s.confidence || 0) * 100)}%)`);

      // dup check
      if (s.merchant_name && s.receipt_no && s.receipt_date) {
        const d = await checkDup({
          data: {
            token: t, merchant_name: s.merchant_name,
            receipt_no: s.receipt_no, receipt_date: s.receipt_date,
          },
        });
        setDupes(d.duplicates as never);
      } else {
        setDupes([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI สแกนไม่สำเร็จ");
    } finally {
      setScanning(false);
    }
  };

  const doSubmit = async () => {
    if (!empId) { toast.error("เลือกชื่อผู้เบิกก่อน"); return; }
    if (!files.length) { toast.error("เพิ่มรูปใบเสร็จก่อน"); return; }
    if (!totalAmount || totalAmount <= 0) { toast.error("ยอดรวมต้อง > 0"); return; }
    setSubmitting(true);
    try {
      const t = getExpenseToken()!;
      const r = await submit({
        data: {
          token: t,
          requester_employee_id: empId,
          bill_type: billType,
          merchant_name: merchant.trim() || undefined,
          tax_id: taxId.trim() || undefined,
          receipt_no: receiptNo.trim() || undefined,
          receipt_date: receiptDate || undefined,
          subtotal, vat_amount: vatAmount, total_amount: totalAmount,
          category_id: categoryId || null,
          note: note.trim() || undefined,
          image_paths: files.map((f) => f.path),
          buyer_match_wsc: buyerMatchWsc,
          ai_extracted: aiExtracted ?? undefined,
          ai_confidence: aiConfidence ?? undefined,
        },
      });
      toast.success(`บันทึก ${r.exp_no} เรียบร้อย`);
      navigate({ to: "/expense-mine", search: { emp: empId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 pb-24">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Link to="/"><Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-base font-bold">AI สแกนใบเสร็จ</h1>
        <Link to="/expense-mine" search={{ emp: empId }} className="ml-auto">
          <Button variant="ghost" size="sm" className="gap-1"><FileText className="h-4 w-4" />ประวัติ</Button>
        </Link>
      </header>

      <div className="mx-auto max-w-md space-y-3 p-3">
        {/* Step 1: requester */}
        <Card>
          <CardContent className="space-y-2 p-3">
            <Label>1. ชื่อผู้เบิก</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger>
              <SelectContent>
                {emps.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}{e.emp_code ? ` (${e.emp_code})` : ""} · {e.group === "office" ? "ออฟฟิศ" : "ผลิต"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2: upload */}
        <Card>
          <CardContent className="space-y-2 p-3">
            <Label>2. ถ่ายรูป/แนบใบเสร็จ (สูงสุด 3 ไฟล์, รวม ≤6MB/ไฟล์)</Label>
            <div className="flex gap-2">
              <label className="flex-1">
                <Input type="file" accept="image/*" capture="environment" multiple onChange={onPick} className="hidden" />
                <Button variant="default" className="w-full" disabled={uploading || files.length >= 3} asChild>
                  <span><Camera className="mr-1 h-4 w-4" />ถ่ายรูป</span>
                </Button>
              </label>
              <label className="flex-1">
                <Input type="file" accept="image/*,application/pdf" multiple onChange={onPick} className="hidden" />
                <Button variant="outline" className="w-full" disabled={uploading || files.length >= 3} asChild>
                  <span><ImagePlus className="mr-1 h-4 w-4" />เลือกไฟล์</span>
                </Button>
              </label>
            </div>
            {uploading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />กำลังอัปโหลด…</div>}
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {files.map((f) => (
                  <div key={f.path} className="relative">
                    {f.mime.startsWith("image/") ? (
                      <img src={f.previewUrl} alt="" className="h-24 w-full rounded border object-cover" />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                        PDF
                      </div>
                    )}
                    <Button size="icon" variant="destructive" className="absolute right-1 top-1 h-6 w-6"
                      onClick={() => removeFile(f.path)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={runScan} disabled={scanning || files.length === 0} className="w-full gap-1">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              อ่านใบเสร็จด้วย AI
            </Button>
          </CardContent>
        </Card>

        {/* Step 3: review */}
        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <Label>3. ตรวจ & แก้ไขข้อมูล</Label>
              {aiConfidence !== null && (
                <Badge variant={aiConfidence >= 0.8 ? "default" : "secondary"}>
                  AI {Math.round(aiConfidence * 100)}%
                </Badge>
              )}
            </div>

            {dupes.length > 0 && (
              <div className="flex items-start gap-2 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">พบใบเสร็จซ้ำในระบบ:</div>
                  {dupes.map((d) => (
                    <div key={d.exp_no}>· {d.exp_no} โดย {d.requester_name} ฿{Number(d.total_amount).toLocaleString()}</div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">ประเภทบิล</Label>
              <Select value={billType} onValueChange={(v) => setBillType(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">บิลเงินสด</SelectItem>
                  <SelectItem value="short_tax">ใบกำกับภาษีอย่างย่อ</SelectItem>
                  <SelectItem value="full_tax">ใบกำกับภาษีเต็มรูป</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Label className="text-xs">ชื่อร้าน</Label><Input value={merchant} onChange={(e) => setMerchant(e.target.value)} /></div>
              <div><Label className="text-xs">เลขผู้เสียภาษี</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
              <div><Label className="text-xs">เลขที่บิล</Label><Input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} /></div>
              <div><Label className="text-xs">วันที่บิล</Label><Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /></div>
              <div>
                <Label className="text-xs">หมวด</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">ก่อน VAT</Label><Input type="number" step="0.01" value={subtotal} onChange={(e) => setSubtotal(Number(e.target.value) || 0)} /></div>
              <div><Label className="text-xs">VAT</Label><Input type="number" step="0.01" value={vatAmount} onChange={(e) => setVatAmount(Number(e.target.value) || 0)} /></div>
              <div className="col-span-2">
                <Label className="text-xs">ยอดรวมที่จ่ายจริง (บาท) *</Label>
                <Input type="number" step="0.01" value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                  className="text-lg font-bold" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input type="checkbox" id="wsc" checked={buyerMatchWsc} onChange={(e) => setBuyerMatchWsc(e.target.checked)} />
              <label htmlFor="wsc">ผู้ซื้อเป็น WSC / วิสุทธิ์ศิลป์</label>
            </div>

            <Textarea rows={2} placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} />
          </CardContent>
        </Card>

        <Button className="w-full h-12 text-base" disabled={submitting || !empId || !files.length || !totalAmount} onClick={doSubmit}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          ส่งคำขอเบิก
        </Button>
      </div>
    </main>
  );
}
