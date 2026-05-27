import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { isAdminSession, clearAdminSession } from "@/lib/admin-session";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
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
  "/logs": "ประวัติงานผลิต",
  "/qc-reports": "รายงาน QC",
  "/qc-summary": "สรุป QC",
  "/manage": "จัดการข้อมูล",
  "/storage": "พื้นที่จัดเก็บ",
  "/logs-update": "LogUpdate",
  "/maintenance-admin": "สรุปงานซ่อมบำรุง",
};

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = PAGE_TITLES[pathname] ?? "แอดมิน";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AdminSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {title}
              </h1>
            </div>
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
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
