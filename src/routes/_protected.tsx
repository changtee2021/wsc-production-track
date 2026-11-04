import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { isAdminSession, clearAdminSession } from "@/lib/auth/admin-session";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { EmployeeProfileProvider } from "@/components/EmployeeProfileProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ location }) => {
    if (typeof window !== "undefined" && !isAdminSession()) {
      throw redirect({
        to: "/admin",
        search: { redirect: location.href },
      });
    }
  },
  component: AdminLayout,
});

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/job-lookup": "ค้นหา Job ด่วน",
  "/trial-releases": "ออเดอร์เข้าไลน์",
  "/production-queue": "คิวผลิต",
  "/logs": "ประวัติงานผลิต",
  "/qc-reports": "รายงาน QC",
  "/qc-summary": "สรุป QC",
  "/control": "Control",
  "/storage": "พื้นที่จัดเก็บ",
  "/logs-update": "LogUpdate",
  "/maintenance-admin": "สรุปงานซ่อมบำรุง",
  "/supplies-admin": "จัดการสินทรัพย์ออฟฟิศ",
  "/supplies-dashboard": "แดชบอร์ดเบิก-สต๊อก",
  "/supplies-reports": "รายงานค่าเสื่อมสินทรัพย์",
  "/expenses-dashboard": "เบิกค่าใช้จ่าย (AI Scan)",
  "/expenses-reports": "รายงานค่าใช้จ่ายรายเดือน",
  "/wi": "Work Instructions",
  "/wi/library": "คลัง WI",
  "/wi/new": "สร้าง WI",
  "/wi/categories": "หมวดหมู่ WI",
  "/wi/review": "ตรวจ & อนุมัติ WI",
  "/wi/versions": "ประวัติเวอร์ชัน WI",
  "/wi/flow": "WI Flow chart",
  "/warehouse-dashboard": "คลังสินค้า Dashboard",
  "/warehouse/receipts": "รายการรับของ",
  "/warehouse/pallets": "สถานะ Pallet",
  "/warehouse/export": "โหลดตู้ส่งออก",
  "/warehouse/reports": "รายงานคลัง",
  "/warehouse/settings": "ตั้งค่าคลังสินค้า",
  "/manage": "จัดการพนักงาน",
  "/iso-29110": "ISO 29110",
};

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title =
    PAGE_TITLES[pathname] ?? (pathname.startsWith("/wi/") ? "Work Instructions" : "แอดมิน");

  return (
    <SidebarProvider>
      <EmployeeProfileProvider>
        <div className="flex min-h-screen w-full bg-gradient-to-br from-stone-100 via-amber-50/60 to-stone-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
          <AdminSidebar />
          <SidebarInset className="bg-white/85 ring-1 ring-black/5 backdrop-blur-xl md:!my-3 md:!mr-3 md:!ml-0 md:!rounded-[28px] md:!shadow-[0_20px_60px_-15px_rgba(0,0,0,0.28)] dark:bg-zinc-900/85 dark:ring-white/10">
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-white/70 px-4 backdrop-blur-xl md:rounded-t-[28px] dark:bg-zinc-900/70">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger />
                <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                  {title}
                </h1>
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    clearAdminSession();
                    navigate({ to: "/admin" });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </header>
            <main className="flex-1">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </EmployeeProfileProvider>
    </SidebarProvider>
  );
}
