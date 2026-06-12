import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerDialog } from "@/components/stock/BarcodeScannerDialog";
import { Toaster } from "@/components/ui/sonner";
import { getWarehouseToken } from "@/lib/auth/warehouse-session";
import { whLookupBox } from "@/lib/features/warehouse-receiving.functions";

export const Route = createFileRoute("/warehouse/lookup")({
  head: () => ({ meta: [{ title: "ค้นหากล่อง — คลังสินค้า" }] }),
  component: LookupPage,
});

function LookupPage() {
  const token = getWarehouseToken() ?? "";
  const [scanOpen, setScanOpen] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof whLookupBox>> | null>(null);
  const lookup = useServerFn(whLookupBox);

  const onScan = async (code: string) => {
    const res = await lookup({ data: { token, boxCode: code } });
    setResult(res);
  };

  const receipt = result?.box?.wh_receipts as {
    receipt_no: string;
    item_code: string;
    item_name: string;
    lot_no: string;
    status: string;
  } | null;

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
        <h1 className="text-xl font-bold">ค้นหากล่อง</h1>
        <Button className="w-full" size="lg" onClick={() => setScanOpen(true)}>
          <ScanLine className="mr-2 h-5 w-5" />
          สแกน Barcode
        </Button>

        {result === null ? null : !result.box ? (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              ไม่พบกล่องในระบบ
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{result.box.box_code}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>สถานะกล่อง</span>
                <Badge>{result.box.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span>ใบรับ</span>
                <span>{receipt?.receipt_no}</span>
              </div>
              <div className="flex justify-between">
                <span>สินค้า</span>
                <span>{receipt?.item_code}</span>
              </div>
              <div className="flex justify-between">
                <span>Lot</span>
                <span>{receipt?.lot_no}</span>
              </div>
              {result.pallet && (
                <div className="flex justify-between">
                  <span>Pallet</span>
                  <span>
                    {result.pallet.pallet_no} ({result.pallet.counted_boxes}/
                    {result.pallet.target_boxes})
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <BarcodeScannerDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScan} />
    </div>
  );
}
