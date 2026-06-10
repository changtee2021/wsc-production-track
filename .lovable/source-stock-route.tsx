import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardCheck,
  Trash2,
  ListChecks,
  ScanLine,
  Plus,
  Send,
  Pencil,
  X,
  Check,
  Lock,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarcodeScannerDialog } from "@/components/stock/BarcodeScannerDialog";
import {
  issueStockSession,
  getOrCreateDraftBatch,
  addCountLine,
  updateCountLine,
  deleteCountLine,
  listBatchLines,
  submitBatch,
  listMyBatches,
  type StockCountRow,
  type StockCountBatch,
} from "@/lib/stock-count.functions";
import {
  isStockSession,
  setStockToken,
  getStockToken,
} from "@/lib/stock-session";
import { getCompany, getWorkerCode, getEmployeeName, getEmployeeId } from "@/lib/tenant";

export const Route = createFileRoute("/stock-count")({
  head: () => ({
    meta: [
      { title: "ตรวจนับสต๊อก — ProductionTrack" },
      { name: "description", content: "สแกน SKU และส่งรายการนับสต๊อกเป็นชุด" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StockCountGate,
});

function fmtNum(n: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 4 }).format(n);
}
function fmtDateTime(s: string) {
  try {
    return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(s),
    );
  } catch {
    return s;
  }
}

function StockCountGate() {
  const navigate = useNavigate({ from: "/stock-count" });
  const issueFn = useServerFn(issueStockSession);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getWorkerCode()) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (isStockSession()) {
      setReady(true);
      return;
    }
    issueFn({ data: { company: getCompany() } })
      .then((res) => {
        setStockToken(res.token);
        setReady(true);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ"));
  }, [issueFn, navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Toaster richColors position="top-center" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <StockCountWorkbench />;
}

function StockCountWorkbench() {
  const qc = useQueryClient();
  const token = getStockToken() ?? "";
  const empCode = getWorkerCode() ?? "";
  const empName = getEmployeeName() ?? empCode;

  // ===== draft batch =====
  const draftFn = useServerFn(getOrCreateDraftBatch);
  const { data: batch } = useQuery({
    queryKey: ["stock-draft-batch", empCode],
    queryFn: () =>
      draftFn({ data: { token, empCode, empName } }) as Promise<{
        id: string;
        batch_no: number;
      }>,
    enabled: !!empCode,
  });
  const batchId = batch?.id ?? "";

  const linesFn = useServerFn(listBatchLines);
  const { data: lines = [] } = useQuery({
    queryKey: ["stock-batch-lines", batchId],
    queryFn: () => linesFn({ data: { token, batchId } }) as Promise<StockCountRow[]>,
    enabled: !!batchId,
  });

  // ===== add form =====
  const [sku, setSku] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [note, setNote] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const addFn = useServerFn(addCountLine);
  const addMut = useMutation({
    mutationFn: (vars: { sku: string; countedQty: number; note: string }) =>
      addFn({ data: { token, batchId, ...vars } }),
    onSuccess: (row) => {
      toast.success(`เพิ่มแล้ว: ${(row as StockCountRow).item_code}`);
      setSku("");
      setCountedQty("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["stock-batch-lines", batchId] });
      skuRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLine = () => {
    if (!batchId) return;
    const code = sku.trim();
    if (!code) {
      skuRef.current?.focus();
      return toast.error("กรุณาสแกนหรือพิมพ์ SKU");
    }
    const qty = Number(countedQty);
    if (countedQty === "" || Number.isNaN(qty) || qty < 0)
      return toast.error("กรุณากรอกจำนวนที่นับได้ให้ถูกต้อง");
    addMut.mutate({ sku: code, countedQty: qty, note });
  };

  // ===== edit / delete =====
  const [editId, setEditId] = useState<string>("");
  const [editQty, setEditQty] = useState("");
  const [editNote, setEditNote] = useState("");

  const updateFn = useServerFn(updateCountLine);
  const updateMut = useMutation({
    mutationFn: (vars: { id: string; countedQty: number; note: string }) =>
      updateFn({ data: { token, ...vars } }),
    onSuccess: () => {
      toast.success("แก้ไขแล้ว");
      setEditId("");
      qc.invalidateQueries({ queryKey: ["stock-batch-lines", batchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteCountLine);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { token, id } }),
    onSuccess: () => {
      toast.success("ลบรายการแล้ว");
      qc.invalidateQueries({ queryKey: ["stock-batch-lines", batchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (r: StockCountRow) => {
    setEditId(r.id);
    setEditQty(String(r.counted_qty));
    setEditNote(r.note);
  };
  const saveEdit = () => {
    const q = Number(editQty);
    if (editQty === "" || Number.isNaN(q) || q < 0) return toast.error("จำนวนไม่ถูกต้อง");
    updateMut.mutate({ id: editId, countedQty: q, note: editNote });
  };

  // ===== submit =====
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const submitFn = useServerFn(submitBatch);
  const submitMut = useMutation({
    mutationFn: () => submitFn({ data: { token, batchId, note: "" } }),
    onSuccess: () => {
      toast.success("ส่งรายการเรียบร้อย — ชุดนี้ถูกล็อกแล้ว");
      setConfirmSubmit(false);
      qc.invalidateQueries({ queryKey: ["stock-draft-batch", empCode] });
      qc.invalidateQueries({ queryKey: ["stock-batch-lines"] });
      qc.invalidateQueries({ queryKey: ["stock-my-batches", empCode] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmSubmit(false);
    },
  });

  // ===== history =====
  const batchesFn = useServerFn(listMyBatches);
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["stock-my-batches", empCode],
    queryFn: () => batchesFn({ data: { token, empCode } }) as Promise<StockCountBatch[]>,
    enabled: !!empCode,
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Link to="/home">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> หน้าหลัก
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold">ตรวจนับสต๊อก</span>
        </div>
        <span className="text-xs text-muted-foreground truncate max-w-[40%]">{empName}</span>
      </header>

      <div className="mx-auto max-w-md space-y-4 p-3 pb-28">
        {/* scan box */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" />
                SKU สินค้า
              </span>
              {batch?.batch_no != null && (
                <span className="text-sm font-normal text-muted-foreground">
                  ชุด #{batch.batch_no}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              size="lg"
              className="h-14 w-full text-base"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="h-5 w-5" />
              <span className="ml-2">สแกน QR / บาร์โค้ด</span>
            </Button>

            <div className="flex gap-2">
              <Input
                ref={skuRef}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (countedQty === "") qtyRef.current?.focus();
                    else addLine();
                  }
                }}
                placeholder="หรือพิมพ์ SKU เช่น A123"
                className="h-12 flex-1 text-base"
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 w-12 shrink-0"
                onClick={() => {
                  if (!sku.trim()) {
                    skuRef.current?.focus();
                    return toast.error("กรุณาสแกนหรือพิมพ์ SKU");
                  }
                  qtyRef.current?.focus();
                }}
                aria-label="ยืนยัน SKU"
              >
                <Check className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>จำนวนที่นับได้</Label>
              <Input
                ref={qtyRef}
                type="number"
                inputMode="decimal"
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLine();
                  }
                }}
                placeholder="0"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label>หมายเหตุ</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="(ไม่บังคับ)"
                className="h-12 text-base"
              />
            </div>

            <Button
              onClick={addLine}
              disabled={addMut.isPending || !batchId}
              size="lg"
              className="h-12 w-full text-base"
            >
              <Plus className="h-5 w-5" />
              <span className="ml-2">เพิ่มเข้ารายการ</span>
            </Button>
          </CardContent>
        </Card>

        {/* current batch lines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <ListChecks className="h-4 w-4 text-primary" />
              รายการในชุดนี้
              <Badge variant="secondary" className="ml-1">{lines.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lines.map((r) => {
              const editing = editId === r.id;
              return (
                <div key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{r.item_code}</p>
                      <p className="truncate font-medium text-foreground">{r.item_name}</p>
                    </div>
                    {!editing && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">นับได้</p>
                        <p className="text-lg font-bold leading-none text-foreground">
                          {fmtNum(r.counted_qty)}
                        </p>
                      </div>
                    )}
                  </div>

                  {editing ? (
                    <div className="mt-3 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">จำนวนที่นับได้</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="h-11 text-base"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">หมายเหตุ</Label>
                        <Input
                          className="h-11 text-base"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="(ไม่บังคับ)"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="h-11 flex-1"
                          onClick={saveEdit}
                          disabled={updateMut.isPending}
                        >
                          <Check className="h-4 w-4" />
                          <span className="ml-1">บันทึก</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 flex-1"
                          onClick={() => setEditId("")}
                        >
                          <X className="h-4 w-4" />
                          <span className="ml-1">ยกเลิก</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm text-muted-foreground">
                        {r.note || "—"}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMut.mutate(r.id)}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {lines.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                ยังไม่มีรายการ — เริ่มสแกน SKU เพื่อเพิ่ม
              </p>
            )}
          </CardContent>
        </Card>

        {/* history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ประวัติชุดที่ส่งแล้ว</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {batches.map((b) => (
              <SubmittedBatchRow key={b.id} batch={b} />
            ))}
            {!batchesLoading && batches.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">ยังไม่มีชุดที่ส่ง</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="text-sm text-muted-foreground">{lines.length} รายการ</span>
          <Button
            className="h-12 flex-1 text-base"
            onClick={() => setConfirmSubmit(true)}
            disabled={submitMut.isPending || lines.length === 0}
          >
            <Send className="h-5 w-5" />
            <span className="ml-2">ส่งรายการ</span>
          </Button>
        </div>
      </div>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(code) => {
          setSku(code);
          setTimeout(() => qtyRef.current?.focus(), 50);
        }}
      />

      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันส่งรายการ?</AlertDialogTitle>
            <AlertDialogDescription>
              เมื่อส่งแล้วชุดนี้จะถูกล็อก ไม่สามารถแก้ไขได้ ({lines.length} รายการ)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => submitMut.mutate()}>ยืนยันส่ง</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubmittedBatchRow({ batch }: { batch: StockCountBatch }) {
  const [open, setOpen] = useState(false);
  const token = getStockToken() ?? "";
  const linesFn = useServerFn(listBatchLines);
  const { data: lines = [] } = useQuery({
    queryKey: ["stock-batch-lines", batch.id],
    queryFn: () => linesFn({ data: { token, batchId: batch.id } }) as Promise<StockCountRow[]>,
    enabled: open,
  });

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-medium">ชุด #{batch.batch_no}</span>
        <Badge variant="outline" className="ml-1 gap-1">
          <Lock className="h-3 w-3" /> ส่งแล้ว
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {fmtDateTime(batch.submitted_at ?? batch.created_at)}
        </span>
      </button>
      {open && (
        <div className="space-y-1 border-t p-2 text-sm">
          {lines.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded px-2 py-1"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{r.item_code}</p>
                <p className="truncate">{r.item_name}</p>
              </div>
              <span className="shrink-0 font-medium">{fmtNum(r.counted_qty)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
