import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ScanLine, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerDialog } from "@/components/stock/BarcodeScannerDialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getWarehouseToken } from "@/lib/auth/warehouse-session";
import { useWarehouseEmployee } from "@/components/warehouse/warehouse-employee-context";
import {
  whGetPallet,
  whScanPalletBox,
  whClosePallet,
  whStartPalletCounting,
} from "@/lib/features/warehouse-pallet.functions";

export const Route = createFileRoute("/warehouse/pallet/$palletId/scan")({
  head: () => ({ meta: [{ title: "สแกนนับ Pallet — คลังสินค้า" }] }),
  component: PalletScanPage,
});

function PalletScanPage() {
  const { palletId } = Route.useParams();
  const token = getWarehouseToken() ?? "";
  const { empCode } = useWarehouseEmployee();
  const [scanOpen, setScanOpen] = useState(false);
  const [lastBox, setLastBox] = useState("");
  const [alert, setAlert] = useState("");

  const getPallet = useServerFn(whGetPallet);
  const scanBox = useServerFn(whScanPalletBox);
  const closePallet = useServerFn(whClosePallet);
  const startCounting = useServerFn(whStartPalletCounting);

  const { data: pallet, refetch } = useQuery({
    queryKey: ["wh-pallet", palletId],
    queryFn: async () => {
      const p = await getPallet({ data: { token, palletId } });
      if (p.status === "open") {
        await startCounting({ data: { token, palletId } });
        return getPallet({ data: { token, palletId } });
      }
      return p;
    },
    enabled: !!token && !!palletId,
  });

  const pct = pallet ? Math.min(100, (pallet.counted_boxes / pallet.target_boxes) * 100) : 0;

  const onScan = async (code: string) => {
    if (!empCode) {
      toast.error("กรอกรหัสพนักงานก่อนสแกน");
      return;
    }
    setLastBox(code);
    try {
      const res = await scanBox({
        data: { token, palletId, boxCode: code, empCode },
      });
      if (res.ok) {
        setAlert(res.message || "OK");
        toast.success(`นับแล้ว ${res.counted_boxes}/${res.target_boxes}`);
        if (res.almost_full) toast.warning(res.message);
      } else {
        setAlert(res.message);
        toast.error(res.message);
      }
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  };

  const onClose = async () => {
    try {
      await closePallet({
        data: { token, palletId, reasonCode: "SHORT", note: "" },
      });
      toast.success("ปิด Pallet แล้ว");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  };

  if (!pallet) {
    return <div className="flex min-h-[100dvh] items-center justify-center p-4">กำลังโหลด…</div>;
  }

  const receipt = pallet.wh_receipts as {
    receipt_no: string;
    item_code: string;
    lot_no: string;
  } | null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Toaster richColors position="top-center" />
      <div className="border-b p-4">
        <Link to="/warehouse/palletizing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            จัด Pallet
          </Button>
        </Link>
        <h1 className="mt-2 text-lg font-bold">{pallet.pallet_no}</h1>
        <p className="text-sm text-muted-foreground">
          {receipt?.item_code} · Lot {receipt?.lot_no}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge>{pallet.status}</Badge>
          <span className="text-2xl font-bold tabular-nums">
            {pallet.counted_boxes}/{pallet.target_boxes}
          </span>
        </div>
        <Progress value={pct} className="mt-2 h-3" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        {pallet.status === "complete" ? (
          <CheckCircle2 className="h-16 w-16 text-green-600" />
        ) : (
          <>
            <Button
              size="lg"
              className="h-20 w-full max-w-sm rounded-2xl text-lg"
              onClick={() => setScanOpen(true)}
              disabled={pallet.status === "loaded"}
            >
              <ScanLine className="mr-2 h-6 w-6" />
              สแกนนับกล่อง
            </Button>
            {lastBox && <p className="text-sm text-muted-foreground">ล่าสุด: {lastBox}</p>}
            {alert && (
              <p className="flex items-center gap-1 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                {alert}
              </p>
            )}
            {pallet.status !== "complete" && pallet.status !== "loaded" && (
              <Button variant="outline" onClick={onClose}>
                ปิด Pallet
              </Button>
            )}
          </>
        )}
      </div>

      <BarcodeScannerDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScan} />
    </div>
  );
}
