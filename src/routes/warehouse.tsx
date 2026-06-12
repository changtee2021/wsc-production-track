import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PackageOpen, Layers, ScanLine, Search, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { whIssueSession } from "@/lib/features/warehouse-settings.functions";
import {
  getWarehouseToken,
  setWarehouseToken,
  isWarehouseSession,
  clearWarehouseSession,
} from "@/lib/auth/warehouse-session";

export const Route = createFileRoute("/warehouse")({
  head: () => ({
    meta: [
      { title: "คลังสินค้า — WSC ProductionTrack" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WarehouseGate,
});

function WarehouseGate() {
  const [ready, setReady] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const issue = useServerFn(whIssueSession);

  useEffect(() => {
    if (isWarehouseSession()) setReady(true);
  }, []);

  const unlock = async () => {
    setLoading(true);
    try {
      const res = await issue({ data: { passcode: passcode || undefined } });
      setWarehouseToken(res.token);
      setReady(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เข้าไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6">
        <Toaster richColors position="top-center" />
        <h1 className="text-xl font-bold">คลังสินค้า</h1>
        <p className="text-sm text-muted-foreground">กรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
        <Input
          type="password"
          placeholder="รหัสผ่าน"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={unlock} disabled={loading} className="min-w-[140px]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "เข้าใช้งาน"}
        </Button>
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            กลับหน้าแรก
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4">
      <Toaster richColors position="top-center" />
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">คลังสินค้า</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearWarehouseSession();
              setReady(false);
            }}
          >
            ออก
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">เลือกงานที่ต้องการทำ</p>
        <div className="grid gap-3">
          <Link to="/warehouse/receiving">
            <Card className="cursor-pointer border-teal-200 bg-teal-50/50 hover:bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30">
              <CardContent className="flex items-center gap-4 p-4">
                <PackageOpen className="h-8 w-8 text-teal-600" />
                <div>
                  <p className="font-semibold">รับของเข้า</p>
                  <p className="text-xs text-muted-foreground">สแกนสินค้า + ลงทะเบียนกล่อง</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/warehouse/palletizing">
            <Card className="cursor-pointer border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30">
              <CardContent className="flex items-center gap-4 p-4">
                <Layers className="h-8 w-8 text-cyan-600" />
                <div>
                  <p className="font-semibold">จัด Pallet</p>
                  <p className="text-xs text-muted-foreground">สร้าง Pallet + สแกนนับ</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/warehouse/lookup">
            <Card className="cursor-pointer hover:bg-muted/50">
              <CardContent className="flex items-center gap-4 p-4">
                <Search className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-semibold">ค้นหากล่อง</p>
                  <p className="text-xs text-muted-foreground">สแกนตรวจสอบสถานะ (อ่านอย่างเดียว)</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
        <Link to="/">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับหน้าแรก
          </Button>
        </Link>
      </div>
    </div>
  );
}
