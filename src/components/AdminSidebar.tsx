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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { adminGetLatestSystemLog } from "@/lib/system-logs.functions";
import { getAdminToken } from "@/lib/admin-session";
import { hasUnseen } from "@/lib/log-seen";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ title: string; url: string; icon: typeof LayoutDashboard }>;
}> = [
  {
    label: "ภาพรวม",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "ค้นหา Job ด่วน", url: "/job-lookup", icon: Search },
      { title: "ประวัติงานผลิต", url: "/logs", icon: FileText },
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
      { title: "จัดการสินทรัพย์", url: "/supplies-admin", icon: Boxes },
      { title: "รายงานค่าเสื่อม", url: "/supplies-reports", icon: BarChart3 },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { title: "จัดการข้อมูล", url: "/manage", icon: Users },
      { title: "พื้นที่จัดเก็บ", url: "/storage", icon: HardDrive },
    ],
  },
  {
    label: "อัพเดต",
    items: [
      { title: "LogUpdate", url: "/logs-update", icon: Sparkles },
    ],
  },
];

export function AdminSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const getLatest = useServerFn(adminGetLatestSystemLog);
  const [hasNew, setHasNew] = useState(false);

  const check = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const res = await getLatest({ data: { token } });
      setHasNew(hasUnseen(res.latest?.created_at));
    } catch {
      // silent
    }
  }, [getLatest]);

  useEffect(() => {
    check();
    const onSeen = () => setHasNew(false);
    window.addEventListener("wsc:logs-seen", onSeen);
    // Re-check every 60s in case new logs arrive while admin is logged in
    const t = setInterval(check, 60_000);
    return () => {
      window.removeEventListener("wsc:logs-seen", onSeen);
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
                  const showBadge = item.url === "/logs-update" && hasNew;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                          {showBadge && (
                            <span className="ml-auto inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white group-data-[collapsible=icon]:hidden">
                              NEW
                            </span>
                          )}
                          {showBadge && (
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
    </Sidebar>
  );
}
