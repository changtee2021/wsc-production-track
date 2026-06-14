import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageOpen, Layers, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clearWarehouseSession } from "@/lib/auth/warehouse-session";
import {
  useWarehouseEmployee,
  WarehouseEmployeePicker,
} from "@/components/warehouse/warehouse-employee-context";

export const Route = createFileRoute("/warehouse/")({
  head: () => ({
    meta: [
      { title: "คลังสินค้า — WSC ProductionTrack" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WarehouseHub,
});

function WarehouseHub() {
  const { empCode } = useWarehouseEmployee();

  return (
    <div className="min-h-[100dvh] bg-background p-4">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">คลังสินค้า</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearWarehouseSession();
              window.location.assign("/warehouse");
            }}
          >
            ออก
          </Button>
        </div>

        <WarehouseEmployeePicker />

        <p className="text-sm text-muted-foreground">เลือกงานที่ต้องการทำ</p>
        {!empCode && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            เลือกพนักงานด้านบนก่อนกดเข้างาน — ถ้าไม่มีรายชื่อ ให้แอดมินเพิ่มใน Staff Directory →
            แผนก stock
          </p>
        )}
        <div className={`grid gap-3 ${!empCode ? "pointer-events-none opacity-50" : ""}`}>
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
