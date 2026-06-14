import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Layers, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getWarehouseToken } from "@/lib/auth/warehouse-session";
import { useWarehouseEmployee } from "@/components/warehouse/warehouse-employee-context";
import { whListReceipts } from "@/lib/features/warehouse-receiving.functions";
import { whCreatePallet, whListPallets } from "@/lib/features/warehouse-pallet.functions";

export const Route = createFileRoute("/warehouse/palletizing")({
  head: () => ({ meta: [{ title: "จัด Pallet — คลังสินค้า" }] }),
  component: PalletizingPage,
});

function PalletizingPage() {
  const token = getWarehouseToken() ?? "";
  const navigate = useNavigate();
  const { empCode, empName } = useWarehouseEmployee();
  const [receiptId, setReceiptId] = useState("");
  const [bpl, setBpl] = useState(12);
  const [layers, setLayers] = useState(8);

  const listReceipts = useServerFn(whListReceipts);
  const listPallets = useServerFn(whListPallets);
  const createPallet = useServerFn(whCreatePallet);

  const { data: receipts = [] } = useQuery({
    queryKey: ["wh-receipts-confirmed"],
    queryFn: () => listReceipts({ data: { token, status: "confirmed" } }),
    enabled: !!token,
  });

  const { data: pallets = [], refetch } = useQuery({
    queryKey: ["wh-pallets-active"],
    queryFn: () => listPallets({ data: { token, status: "all", limit: 50 } }),
    enabled: !!token,
  });

  const onCreate = async () => {
    if (!receiptId || !empCode) {
      toast.error("เลือกใบรับของและรหัสพนักงาน");
      return;
    }
    try {
      const p = await createPallet({
        data: {
          token,
          receiptId,
          empCode,
          empName: empName || empCode,
          boxes_per_layer: bpl,
          layers,
        },
      });
      toast.success(`สร้าง ${p.pallet_no}`);
      refetch();
      navigate({ to: "/warehouse/pallet/$palletId/scan", params: { palletId: p.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  };

  const active = pallets.filter((p) => ["open", "counting", "incomplete"].includes(p.status));

  return (
    <div className="min-h-[100dvh] bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Link to="/warehouse/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            คลังสินค้า
          </Button>
        </Link>
        <h1 className="mt-1 text-lg font-bold">จัด Pallet</h1>
      </header>

      <div className="mx-auto max-w-md space-y-4 p-3 pb-28">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">สร้าง Pallet ใหม่</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>ใบรับของ (confirmed)</Label>
              <Select value={receiptId} onValueChange={setReceiptId}>
                <SelectTrigger className="h-14 text-base">
                  <SelectValue placeholder="— เลือกใบรับของ —" />
                </SelectTrigger>
                <SelectContent>
                  {receipts.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.receipt_no} · {r.item_code} · Lot {r.lot_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>กล่อง/ชั้น</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="h-12 text-base"
                  value={bpl}
                  onChange={(e) => setBpl(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>จำนวนชั้น</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="h-12 text-base"
                  value={layers}
                  onChange={(e) => setLayers(Number(e.target.value))}
                />
              </div>
            </div>
            <Badge variant="secondary" className="text-sm">
              ความจุ: {bpl * layers} กล่อง
            </Badge>
            <Button className="h-14 w-full text-base" onClick={onCreate}>
              <Layers className="mr-2 h-5 w-5" />
              สร้าง Pallet
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="font-semibold">Pallet ที่กำลังทำ</h2>
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">ยังไม่มี Pallet ที่เปิดอยู่</p>
          )}
          {active.map((p) => {
            const pct = Math.min(100, (p.counted_boxes / p.target_boxes) * 100);
            return (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.pallet_no}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.counted_boxes}/{p.target_boxes} กล่อง
                      </p>
                    </div>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <Link to="/warehouse/pallet/$palletId/scan" params={{ palletId: p.id }}>
                    <Button className="h-12 w-full text-base">
                      <ScanLine className="mr-2 h-5 w-5" />
                      สแกนนับ
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
