import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowLeft, ScanLine, CheckCircle2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const [boxCode, setBoxCode] = useState("");
  const [lastBox, setLastBox] = useState("");
  const [alert, setAlert] = useState("");
  const boxRef = useRef<HTMLInputElement>(null);

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
  const canScan = pallet && pallet.status !== "complete" && pallet.status !== "loaded";

  const onScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!empCode) {
      toast.error("เลือกพนักงานก่อนสแกน");
      return;
    }
    setLastBox(trimmed);
    setBoxCode("");
    try {
      const res = await scanBox({
        data: { token, palletId, boxCode: trimmed, empCode },
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
    <div className="flex min-h-[100dvh] flex-col bg-background pb-28">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 border-b bg-background/95 p-3 backdrop-blur">
        <Link to="/warehouse/palletizing">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            จัด Pallet
          </Button>
        </Link>
        <h1 className="mt-1 text-lg font-bold">{pallet.pallet_no}</h1>
        <p className="text-sm text-muted-foreground">
          {receipt?.item_code} · Lot {receipt?.lot_no}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Badge>{pallet.status}</Badge>
          <span className="text-2xl font-bold tabular-nums">
            {pallet.counted_boxes}/{pallet.target_boxes}
          </span>
        </div>
        <Progress value={pct} className="mt-2 h-3" />
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 p-3">
        {pallet.status === "complete" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <p className="font-semibold text-green-700">นับครบแล้ว</p>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3 p-4">
                <Button
                  size="lg"
                  className="h-20 w-full rounded-2xl text-lg"
                  onClick={() => setScanOpen(true)}
                  disabled={!canScan}
                >
                  <ScanLine className="mr-2 h-6 w-6" />
                  สแกนนับกล่อง
                </Button>

                <div className="flex gap-2">
                  <Input
                    ref={boxRef}
                    value={boxCode}
                    onChange={(e) => setBoxCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onScan(boxCode);
                      }
                    }}
                    placeholder="หรือพิมพ์รหัสกล่อง"
                    className="h-12 flex-1 text-base"
                    disabled={!canScan}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-12 w-12 shrink-0"
                    onClick={() => onScan(boxCode)}
                    disabled={!canScan}
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {lastBox && (
              <p className="text-center text-sm text-muted-foreground">ล่าสุด: {lastBox}</p>
            )}
            {alert && (
              <p className="flex items-center justify-center gap-1 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                {alert}
              </p>
            )}
          </>
        )}
      </div>

      {canScan && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-md flex-col gap-2">
            <Button className="h-14 w-full text-base" onClick={() => setScanOpen(true)}>
              <ScanLine className="mr-2 h-5 w-5" />
              สแกนนับกล่อง
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={onClose}>
              ปิด Pallet
            </Button>
          </div>
        </div>
      )}

      <BarcodeScannerDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScan} />
    </div>
  );
}
