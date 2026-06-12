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
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getWarehouseToken } from "@/lib/auth/warehouse-session";
import { whListReceipts } from "@/lib/features/warehouse-receiving.functions";
import { whCreatePallet, whListPallets } from "@/lib/features/warehouse-pallet.functions";

export const Route = createFileRoute("/warehouse/palletizing")({
  head: () => ({ meta: [{ title: "จัด Pallet — คลังสินค้า" }] }),
  component: PalletizingPage,
});

function PalletizingPage() {
  const token = getWarehouseToken() ?? "";
  const navigate = useNavigate();
  const [empCode, setEmpCode] = useState("");
  const [empName, setEmpName] = useState("");
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
    <div className="min-h-[100dvh] bg-background p-4">
      <Toaster richColors position="top-center" />
      <div className="mx-auto max-w-md space-y-4">
        <Link to="/warehouse">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            คลังสินค้า
          </Button>
        </Link>
        <h1 className="text-xl font-bold">จัด Pallet</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">สร้าง Pallet ใหม่</CardTitle>
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
              <Label>ใบรับของ (confirmed)</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={receiptId}
                onChange={(e) => setReceiptId(e.target.value)}
              >
                <option value="">— เลือก —</option>
                {receipts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.receipt_no} · {r.item_code} · Lot {r.lot_no}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>กล่อง/ชั้น</Label>
                <Input type="number" value={bpl} onChange={(e) => setBpl(Number(e.target.value))} />
              </div>
              <div>
                <Label>จำนวนชั้น</Label>
                <Input
                  type="number"
                  value={layers}
                  onChange={(e) => setLayers(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">ความจุ: {bpl * layers} กล่อง</p>
            <Button className="w-full" onClick={onCreate}>
              <Layers className="mr-2 h-4 w-4" />
              สร้าง Pallet
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h2 className="font-semibold">Pallet ที่กำลังทำ</h2>
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">ยังไม่มี Pallet ที่เปิดอยู่</p>
          )}
          {active.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{p.pallet_no}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.counted_boxes}/{p.target_boxes} · {p.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.status}</Badge>
                  <Link to="/warehouse/pallet/$palletId/scan" params={{ palletId: p.id }}>
                    <Button size="sm">
                      <ScanLine className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
