import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { WscMark } from "@/components/WscMark";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  ScanLine,
  Package,
  Wrench,
  Boxes,
  SlidersHorizontal,
  Receipt,
  Layers,
  ListChecks,
  Activity,
  Timer,
  Send,
  ShieldCheck,
  ScrollText,
  BookOpenCheck,
  Library,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { adminGetLatestSystemLog } from "@/lib/features/system-logs.functions";
import { adminOfficeBadgeCounts } from "@/lib/features/office-requests.functions";
import { adminExpenseBadgeCounts } from "@/lib/features/expenses-admin.functions";
import { adminMonitorLiveStatus } from "@/lib/features/monitor.functions";
import { getAdminToken } from "@/lib/auth/admin-session";
import { hasUnseen } from "@/lib/utils/log-seen";
import { AppVersion } from "@/components/AppVersion";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{
    title: string;
    url: string;
    icon: typeof LayoutDashboard;
    search?: Record<string, string>;
    external?: boolean;
  }>;
}> = [
  {
    label: "ภาพรวม",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Monitor Live", url: "/production-dashboard", icon: Activity },
      { title: "ค้นหา Job ด่วน", url: "/job-lookup", icon: Search },
      { title: "โฟลว์สแกนโหมดสถานี", url: "/scan-flow", icon: ScanLine },
      { title: "แอปทดลองสแกน", url: "/scan-trial", icon: ScanLine },
    ],
  },
  {
    label: "การผลิต",
    items: [
      { title: "ออเดอร์เข้าไลน์", url: "/trial-releases", icon: Send },
      { title: "คิวผลิต (Curtain Flow)", url: "/production-queue", icon: Factory },
      { title: "ประวัติงานผลิต", url: "/logs", icon: FileText },
      { title: "พรีวิว Excel ผลิต", url: "/production-excel", icon: ListChecks },
      { title: "เวลามาตรฐาน & ไฟแดง", url: "/production-standards", icon: Timer },
      { title: "ตั้งค่าการผลิต", url: "/production-setup", icon: Layers },
    ],
  },
  {
    label: "Work Instructions",
    items: [
      { title: "ภาพรวม WI", url: "/wi", icon: BookOpenCheck },
      { title: "คลัง WI", url: "/wi/library", icon: Library },
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
  // Warehouse (WH) nav hidden for now — module not in active use.
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
    items: [{ title: "พนักงาน", url: "/manage", icon: Users }],
  },
  {
    label: "อัพเดต",
    items: [
      { title: "แบนเนอร์ & ประกาศ", url: "/control", icon: SlidersHorizontal },
      { title: "ความคิดเห็น", url: "/feedback-admin", icon: ListChecks },
      { title: "พื้นที่จัดเก็บ", url: "/storage", icon: HardDrive },
      { title: "ข้อกำหนดแอดมิน", url: "/admin-policy", icon: ShieldCheck },
      { title: "แก้ไขข้อกำหนด", url: "/manage-policies", icon: FileText },
      { title: "ISO 29110", url: "/iso-29110", icon: ClipboardCheck },
      { title: "LogUpdate", url: "/logs-update", icon: Sparkles },
      { title: "Server Logs", url: "/server-logs", icon: ScrollText },
    ],
  },
];

const FLAT_NAV_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.label })),
);

function scoreNavItem(query: string, title: string, url: string, group: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = title.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  if (url.toLowerCase().includes(q) || group.toLowerCase().includes(q)) return 40;
  // Loose subsequence match so typos / partial words still find the closest page.
  const compact = q.replace(/\s+/g, "");
  let i = 0;
  for (const ch of t) if (ch === compact[i]) i++;
  return i === compact.length ? 20 : 0;
}

export function AdminSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { state: sidebarState, setOpen, isMobile, setOpenMobile } = useSidebar();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const results = useMemo(
    () =>
      FLAT_NAV_ITEMS.map((item) => ({
        item,
        score: scoreNavItem(query, item.title, item.url, item.group),
      }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    [query],
  );

  const focusSearch = useCallback(() => {
    if (!isMobile && sidebarState === "collapsed") {
      setOpen(true);
      setTimeout(() => searchRef.current?.focus(), 220);
      return;
    }
    searchRef.current?.focus();
  }, [isMobile, sidebarState, setOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSearch]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [searchOpen]);

  const goTo = (item: (typeof FLAT_NAV_ITEMS)[number]) => {
    setQuery("");
    setCursor(0);
    setSearchOpen(false);
    searchRef.current?.blur();
    if (isMobile) setOpenMobile(false);
    if (item.external) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    navigate({ to: item.url, search: item.search as never });
  };
  const getLatest = useServerFn(adminGetLatestSystemLog);
  const getBadge = useServerFn(adminOfficeBadgeCounts);
  const getExpBadge = useServerFn(adminExpenseBadgeCounts);
  const [hasNew, setHasNew] = useState(false);
  const [pendingReq, setPendingReq] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [pendingExp, setPendingExp] = useState(0);
  // null = not loaded yet (no dot). >0 = someone is working (green), 0 = nobody (red).
  const [liveWorking, setLiveWorking] = useState<number | null>(null);
  const getLive = useServerFn(adminMonitorLiveStatus);

  const check = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const [res, badge, exp, live] = await Promise.all([
        getLatest({ data: { token } }),
        getBadge({ data: { token } }),
        getExpBadge({ data: { token } }),
        getLive({ data: { token } }),
      ]);
      setLiveWorking(live.working);
      setHasNew(hasUnseen(res.latest?.created_at));
      setPendingReq(badge.pending);
      setLowStock(badge.low_stock);
      setPendingExp(exp.pending);
    } catch {
      // silent
    }
  }, [getLatest, getBadge, getExpBadge, getLive]);

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
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="[&>[data-sidebar=sidebar]]:bg-transparent"
    >
      <SidebarHeader className="gap-3 px-3 pb-1 pt-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-1 text-base font-semibold tracking-tight text-sidebar-foreground"
        >
          <WscMark className="h-9 w-9 shrink-0 object-contain" />
          <span className="truncate group-data-[collapsible=icon]:hidden">WSC ProductionTrack</span>
        </Link>

        <button
          type="button"
          onClick={focusSearch}
          aria-label="ค้นหาหน้า"
          title="ค้นหาหน้า"
          className="hidden h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/5 group-data-[collapsible=icon]:flex dark:hover:bg-white/10"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div ref={searchBoxRef} className="relative group-data-[collapsible=icon]:hidden">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            role="combobox"
            aria-expanded={searchOpen && query.trim().length > 0}
            aria-controls="admin-nav-search-results"
            aria-label="ค้นหาหน้า"
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const hit = results[cursor] ?? results[0];
                if (hit) goTo(hit.item);
              } else if (e.key === "Escape") {
                setQuery("");
                setSearchOpen(false);
                searchRef.current?.blur();
              }
            }}
            placeholder="ค้นหาหน้า..."
            className="h-11 w-full rounded-full border border-black/5 bg-white/90 pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/30 focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchOpen && query.trim() && (
            <div
              id="admin-nav-search-results"
              role="listbox"
              className="absolute inset-x-0 top-12 z-50 max-h-80 overflow-y-auto rounded-2xl border border-black/5 bg-popover p-1 shadow-xl dark:border-white/10"
            >
              {results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">ไม่พบหน้าที่ตรงกัน</p>
              ) : (
                results.map(({ item }, i) => (
                  <button
                    key={item.url}
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => goTo(item)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-popover-foreground ${
                      i === cursor ? "bg-muted" : ""
                    }`}
                  >
                    <item.icon
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <span className="flex-1 truncate">{item.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{item.group}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 hover:[&::-webkit-scrollbar-thumb]:bg-black/25 dark:[&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-[11px] font-medium text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    !item.external &&
                    (currentPath === item.url ||
                      (item.url === "/wi/library" &&
                        currentPath.startsWith("/wi/") &&
                        currentPath !== "/wi"));
                  const showNewBadge = item.url === "/logs-update" && hasNew;
                  const isSupply = item.url === "/supplies-dashboard";
                  const supplyCount = isSupply ? pendingReq : 0;
                  const supplyDot = isSupply && (pendingReq > 0 || lowStock > 0);
                  const isExp = item.url === "/expenses-dashboard";
                  const expCount = isExp ? pendingExp : 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="h-10 rounded-xl px-3 text-[13px] text-sidebar-foreground/80 hover:bg-black/[0.04] data-[active=true]:bg-white data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.12)] dark:hover:bg-white/5 dark:data-[active=true]:bg-white/10"
                      >
                        {item.external ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3"
                          >
                            <item.icon className="h-4 w-4" strokeWidth={1.75} />
                            <span className="flex-1">{item.title}</span>
                          </a>
                        ) : (
                          <Link
                            to={item.url}
                            search={item.search as never}
                            className="flex items-center gap-3"
                          >
                            <item.icon className="h-4 w-4" strokeWidth={1.75} />
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
                            {item.url === "/production-dashboard" && liveWorking !== null && (
                              <span
                                role="status"
                                aria-label={liveWorking > 0 ? "มีคนกำลังทำงาน" : "ไม่มีใครทำงาน"}
                                title={
                                  liveWorking > 0
                                    ? `มีคนกำลังทำงาน ${liveWorking} งาน`
                                    : "ไม่มีใครทำงานเลย"
                                }
                                className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full ${
                                  liveWorking > 0 ? "animate-pulse bg-emerald-500" : "bg-red-500"
                                }`}
                              />
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
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center justify-center rounded-2xl border border-black/5 bg-white/80 px-3 py-2.5 shadow-sm group-data-[collapsible=icon]:hidden dark:border-white/10 dark:bg-white/5">
          <AppVersion className="text-sidebar-foreground/60" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
