import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Check, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarcodeScannerDialog } from "@/components/stock/BarcodeScannerDialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getWarehouseToken } from "@/lib/auth/warehouse-session";
import {
  whCreateReceipt,
  whAddBox,
  whBulkGenerateBoxes,
  whConfirmReceipt,
} from "@/lib/features/warehouse-receiving.functions";

export const Route = createFileRoute("/warehouse/receiving")({
  head: () => ({ meta: [{ title: "รับของเข้า — คลังสินค้า" }] }),
  component: ReceivingPage,
});

function ReceivingPage() {
  const token = getWarehouseToken() ?? "";
  const [empCode, setEmpCode] = useState("");
  const [empName, setEmpName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [expected, setExpected] = useState(96);
  const [barcodeMode, setBarcodeMode] = useState<"system" | "supplier" | "ask_each_receipt">(
    "system",
  );
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [received, setReceived] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const createFn = useServerFn(whCreateReceipt);
  const addBoxFn = useServerFn(whAddBox);
  const bulkFn = useServerFn(whBulkGenerateBoxes);
  const confirmFn = useServerFn(whConfirmReceipt);

  const startReceipt = async () => {
    if (!empCode || !itemCode) {
      toast.error("กรอกรหัสพนักงานและรหัสสินค้า");
      return;
    }
    setBusy(true);
    try {
      const r = await createFn({
        data: {
          token,
          empCode,
          empName: empName || empCode,
          po_number: poNumber,
          item_code: itemCode,
          item_name: itemName,
          lot_no: lotNo,
          expected_boxes: expected,
          barcode_mode: barcodeMode,
        },
      });
      setReceiptId(r.id);
      setReceived(0);
      toast.success(`สร้างใบรับ ${r.receipt_no}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const onBoxScanned = async (code: string) => {
    if (!receiptId) return;
    setBusy(true);
    try {
      const res = await addBoxFn({
        data: { token, receiptId, empCode: empCode || "—", boxCode: code },
      });
      setReceived(res.received_boxes);
      toast.success(`+1 → ${res.received_boxes}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const generateAll = async () => {
    if (!receiptId) return;
    const n = expected - received;
    if (n <= 0) return;
    setBusy(true);
    try {
      const res = await bulkFn({
        data: { token, receiptId, empCode: empCode || "—", count: n },
      });
      setReceived(res.received_boxes);
      toast.success(`สร้างกล่อง ${n} ใบ`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!receiptId) return;
    setBusy(true);
    try {
      await confirmFn({ data: { token, receiptId } });
      toast.success("ยืนยันรับของแล้ว");
      setReceiptId(null);
      setReceived(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background p-4">
      <Toaster richColors position="top-center" />
      <div className="mx-auto max-w-md space-y-4">
        <Link to="/warehouse">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            คลังสินค้า
          </Button>
        </Link>
        <h1 className="text-xl font-bold">รับของเข้า</h1>

        {!receiptId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สร้างใบรับของ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>รหัสพนักงาน</Label>
                  <Input value={empCode} onChange={(e) => setEmpCode(e.target.value)} />
                </div>
                <div>
                  <Label>ชื่อ</Label>
                  <Input value={empName} onChange={(e) => setEmpName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>PO No.</Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              </div>
              <div>
                <Label>รหัสสินค้า</Label>
                <Input value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
              </div>
              <div>
                <Label>ชื่อสินค้า</Label>
                <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
              </div>
              <div>
                <Label>Lot No.</Label>
                <Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} />
              </div>
              <div>
                <Label>จำนวนกล่องที่คาดรับ</Label>
                <Input
                  type="number"
                  value={expected}
                  onChange={(e) => setExpected(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>โหมด Barcode</Label>
                <Select
                  value={barcodeMode}
                  onValueChange={(v) => setBarcodeMode(v as typeof barcodeMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">ระบบสร้างให้</SelectItem>
                    <SelectItem value="supplier">สแกนจากซัพพลายเออร์</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={startReceipt} disabled={busy}>
                <Plus className="mr-2 h-4 w-4" />
                เริ่มรับของ
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                กำลังรับของ
                <Badge>
                  {received}/{expected}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {barcodeMode === "supplier" ? (
                <Button className="w-full" onClick={() => setScanOpen(true)} disabled={busy}>
                  <ScanLine className="mr-2 h-4 w-4" />
                  สแกนกล่อง
                </Button>
              ) : (
                <Button className="w-full" variant="secondary" onClick={generateAll} disabled={busy}>
                  สร้าง Barcode ทั้งหมด ({expected - received} กล่อง)
                </Button>
              )}
              <Button className="w-full" onClick={confirm} disabled={busy || received === 0}>
                <Check className="mr-2 h-4 w-4" />
                ยืนยันรับของ
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <BarcodeScannerDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onBoxScanned} />
    </div>
  );
}
