import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Users,
  HardDrive,
  Factory,
  Sparkles,
  BarChart3,
  Search,
  Package,
  Wrench,
  Boxes,
  SlidersHorizontal,
  Receipt,
  Layers,
  ListChecks,
  Activity,
  Timer,
  ShieldCheck,
  ScrollText,
  BookOpenCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { adminGetLatestSystemLog } from "@/lib/features/system-logs.functions";
import { adminOfficeBadgeCounts } from "@/lib/features/office-requests.functions";
import { adminExpenseBadgeCounts } from "@/lib/features/expenses-admin.functions";
import { getAdminToken } from "@/lib/auth/admin-session";
import { hasUnseen } from "@/lib/utils/log-seen";
import { AppVersion } from "@/components/AppVersion";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ title: string; url: string; icon: typeof LayoutDashboard; search?: Record<string, string> }>;
}> = [
  {
    label: "ภาพรวม",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "ค้นหา Job ด่วน", url: "/job-lookup", icon: Search },
    ],
  },
  {
    label: "การผลิต",
    items: [
      { title: "คิวผลิต (Curtain Flow)", url: "/production-queue", icon: Factory },
      { title: "แดชบอร์ดไลน์ผลิต", url: "/production-dashboard", icon: Activity },
      { title: "ประวัติงานผลิต", url: "/logs", icon: FileText },
      { title: "พรีวิว Excel ผลิต", url: "/production-excel", icon: ListChecks },
      { title: "เวลามาตรฐาน & ไฟแดง", url: "/production-standards", icon: Timer },
      { title: "ตั้งค่าการผลิต", url: "/production-setup", icon: Layers },
      { title: "WI คู่มือปฏิบัติงาน", url: "/wi", icon: BookOpenCheck },
    ],
  },
  {
    label: "QC",
    items: [
      { title: "รายงาน QC", url: "/qc-reports", icon: ClipboardCheck },
      { title: "สรุป QC", url: "/qc-summary", icon: BarChart3 },
    ],
  },
  {
    label: "แพ็คของ",
    items: [
      { title: "รายงานแพ็คของ", url: "/packing-reports", icon: Package },
      { title: "สรุปแพ็คของ", url: "/packing-summary", icon: BarChart3 },
    ],
  },
  {
    label: "ซ่อมบำรุง",
    items: [
      { title: "สรุปงานซ่อม", url: "/maintenance-admin", icon: Wrench },
      { title: "ทรัพย์สิน & อะไหล่", url: "/maintenance-master", icon: Package },
    ],
  },
  {
    label: "สต๊อกออฟฟิศ",
    items: [
      { title: "แดชบอร์ดเบิก-สต๊อก", url: "/supplies-dashboard", icon: LayoutDashboard },
      { title: "จัดการสินทรัพย์", url: "/supplies-admin", icon: Boxes },
      { title: "รายงานค่าเสื่อม", url: "/supplies-reports", icon: BarChart3 },
    ],
  },
  {
    label: "นับสต๊อก (WSC)",
    items: [
      { title: "คลังสินค้า", url: "/stock-count-inventory", icon: Boxes },
      { title: "รายงานนับสต๊อก", url: "/stock-count-reports", icon: ClipboardCheck },
    ],
  },
  {
    label: "ค่าใช้จ่าย",
    items: [
      { title: "เบิกค่าใช้จ่าย", url: "/expenses-dashboard", icon: Receipt },
      { title: "รายงานรายเดือน", url: "/expenses-reports", icon: BarChart3 },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { title: "พนักงาน", url: "/manage", icon: Users },
    ],
  },
  {
    label: "อัพเดต",
    items: [
      { title: "แบนเนอร์ & ประกาศ", url: "/control", icon: SlidersHorizontal },
      { title: "ความคิดเห็น", url: "/feedback-admin", icon: ListChecks },
      { title: "พื้นที่จัดเก็บ", url: "/storage", icon: HardDrive },
      { title: "ข้อกำหนดแอดมิน", url: "/admin-policy", icon: ShieldCheck },
      { title: "แก้ไขข้อกำหนด", url: "/manage-policies", icon: FileText },
      { title: "LogUpdate", url: "/logs-update", icon: Sparkles },
      { title: "Server Logs", url: "/server-logs", icon: ScrollText },
    ],
  },
];

export function AdminSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const getLatest = useServerFn(adminGetLatestSystemLog);
  const getBadge = useServerFn(adminOfficeBadgeCounts);
  const getExpBadge = useServerFn(adminExpenseBadgeCounts);
  const [hasNew, setHasNew] = useState(false);
  const [pendingReq, setPendingReq] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [pendingExp, setPendingExp] = useState(0);

  const check = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const [res, badge, exp] = await Promise.all([
        getLatest({ data: { token } }),
        getBadge({ data: { token } }),
        getExpBadge({ data: { token } }),
      ]);
      setHasNew(hasUnseen(res.latest?.created_at));
      setPendingReq(badge.pending);
      setLowStock(badge.low_stock);
      setPendingExp(exp.pending);
    } catch {
      // silent
    }
  }, [getLatest, getBadge, getExpBadge]);

  useEffect(() => {
    check();
    const onSeen = () => setHasNew(false);
    const onRefresh = () => check();
    window.addEventListener("wsc:logs-seen", onSeen);
    window.addEventListener("wsc:office-refresh", onRefresh);
    // Re-check every 60s in case new logs/requests arrive while admin is logged in
    const t = setInterval(check, 60_000);
    return () => {
      window.removeEventListener("wsc:logs-seen", onSeen);
      window.removeEventListener("wsc:office-refresh", onRefresh);
      clearInterval(t);
    };
  }, [check]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-1.5 text-sm font-bold tracking-tight text-sidebar-foreground"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Factory className="h-4 w-4" />
          </div>
          <span className="truncate group-data-[collapsible=icon]:hidden">
            WSC ProductionTrack
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = currentPath === item.url;
                  const showNewBadge = item.url === "/logs-update" && hasNew;
                  const isSupply = item.url === "/supplies-dashboard";
                  const supplyCount = isSupply ? pendingReq : 0;
                  const supplyDot = isSupply && (pendingReq > 0 || lowStock > 0);
                  const isExp = item.url === "/expenses-dashboard";
                  const expCount = isExp ? pendingExp : 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} search={item.search as never} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                          {showNewBadge && (
                            <span className="ml-auto inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white group-data-[collapsible=icon]:hidden">
                              NEW
                            </span>
                          )}
                          {showNewBadge && (
                            <span className="ml-auto hidden h-2 w-2 rounded-full bg-rose-500 group-data-[collapsible=icon]:inline-block" />
                          )}
                          {isSupply && supplyCount > 0 && (
                            <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white group-data-[collapsible=icon]:hidden">
                              {supplyCount > 99 ? "99+" : supplyCount}
                            </span>
                          )}
                          {isSupply && supplyDot && (
                            <span className="ml-auto hidden h-2 w-2 rounded-full bg-amber-500 group-data-[collapsible=icon]:inline-block" />
                          )}
                          {isExp && expCount > 0 && (
                            <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white group-data-[collapsible=icon]:hidden">
                              {expCount > 99 ? "99+" : expCount}
                            </span>
                          )}
                          {isExp && expCount > 0 && (
                            <span className="ml-auto hidden h-2 w-2 rounded-full bg-rose-500 group-data-[collapsible=icon]:inline-block" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-center px-2 py-2 group-data-[collapsible=icon]:hidden">
          <AppVersion className="text-sidebar-foreground/60" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
