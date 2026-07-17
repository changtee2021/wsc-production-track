import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Autoplay from "embla-carousel-autoplay";
import {
  Factory,
  ShieldCheck,
  ScanLine,
  ClipboardCheck,
  MessageCircle,
  Package,
  Wrench,
  ShoppingCart,
  Boxes,
  UserRound,
  LogOut,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/welcome-hero.png";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { AppVersion } from "@/components/AppVersion";
import { clientAppPublicPath } from "@/lib/app-public-url";
import { employeeLogin, employeeMe } from "@/lib/features/employee-auth.functions";
import {
  clearEmployeeSession,
  employeeHasDept,
  getEmployeeProfile,
  getEmployeeToken,
  setEmployeeSession,
  type EmployeeSessionProfile,
} from "@/lib/auth/employee-session";
import { applyDeptTokens } from "@/lib/auth/apply-dept-tokens";
import { EmployeeProfileDialog } from "@/components/EmployeeProfileDialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ยินดีต้อนรับ — WSC ProductionTrack" },
      {
        name: "description",
        content: "ระบบติดตามการผลิตในโรงงาน บันทึกเวลาเริ่ม–เสร็จงานด้วย QR code อย่างรวดเร็ว",
      },
      { property: "og:title", content: "WSC ProductionTrack — ระบบติดตามการผลิต" },
      {
        property: "og:description",
        content:
          "บันทึกเวลาเริ่ม–เสร็จงานในสายการผลิตด้วย QR code พร้อมระบบ QC แบบ checklist บนมือถือ",
      },
      { property: "og:url", content: clientAppPublicPath("/") },
    ],
    links: [{ rel: "canonical", href: clientAppPublicPath("/") }],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate({ from: "/" });
  const loginFn = useServerFn(employeeLogin);
  const meFn = useServerFn(employeeMe);

  const [banners, setBanners] = useState<string[]>([]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);

  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<EmployeeSessionProfile | null>(null);
  const [empCode, setEmpCode] = useState("");
  const [password, setPassword] = useState("000000");
  const [loginLoading, setLoginLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("home_banners")
        .select("image_path")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      const urls = (data ?? [])
        .map((r) => {
          const { data: pub } = supabase.storage.from("banners").getPublicUrl(r.image_path);
          return pub.publicUrl;
        })
        .filter(Boolean);
      setBanners(urls);
    })();
  }, []);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getEmployeeToken();
      const cached = getEmployeeProfile();
      if (!token) {
        if (!cancelled) {
          setProfile(null);
          setSessionReady(true);
        }
        return;
      }
      try {
        const me = await meFn({ data: { token } });
        if (cancelled) return;
        const next: EmployeeSessionProfile = {
          name: me.name,
          emp_code: me.emp_code,
          departments: me.departments,
          ids: me.ids,
        };
        setEmployeeSession(me.token, next);
        applyDeptTokens(me.deptTokens);
        setProfile(next);
      } catch {
        clearEmployeeSession();
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) {
          // If me failed but we had cache, still clear — session invalid.
          if (!getEmployeeToken() && cached) {
            /* already cleared */
          }
          setSessionReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meFn]);

  const slides = banners.length > 0 ? banners : [heroImage];
  const depts = profile?.departments ?? [];
  const showScan = employeeHasDept(depts, "production");
  const showQc = employeeHasDept(depts, "qc");
  const showPacking = employeeHasDept(depts, "packing");
  const showStock = employeeHasDept(depts, "stock");

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await loginFn({
        data: { empCode: empCode.trim(), password },
      });
      const next: EmployeeSessionProfile = {
        name: res.name,
        emp_code: res.emp_code,
        departments: res.departments,
        ids: res.ids,
      };
      setEmployeeSession(res.token, next);
      applyDeptTokens(res.deptTokens);
      setProfile(next);
      toast.success(`สวัสดี ${res.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoginLoading(false);
    }
  };

  const onLogout = () => {
    clearEmployeeSession();
    setProfile(null);
    setProfileOpen(false);
    toast.message("ออกจากระบบแล้ว");
  };

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <Toaster richColors position="top-center" />
      <h1 className="sr-only">WSC ProductionTrack — ระบบติดตามการผลิตในโรงงาน</h1>
      <AnnouncementBar />
      <section className="relative flex-1 w-full overflow-hidden bg-primary">
        <Carousel
          className="absolute inset-0 h-full w-full [&>div]:h-full"
          opts={{ loop: true, align: "start" }}
          plugins={slides.length > 1 ? [Autoplay({ delay: 5000, stopOnInteraction: false })] : []}
          setApi={setApi}
        >
          <CarouselContent className="ml-0 h-full">
            {slides.map((src, i) => (
              <CarouselItem key={i} className="relative h-full pl-0 basis-full">
                <div className="relative h-full w-full">
                  <img
                    src={src}
                    alt={`แบนเนอร์ ${i + 1}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-1/4 bg-gradient-to-t from-primary via-primary/70 to-transparent"
        />

        <header
          className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-3 pt-3 sm:px-5 sm:pt-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 items-center gap-2 text-primary-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07] backdrop-blur-md ring-1 ring-white/20">
              <Factory className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold tracking-tight drop-shadow sm:text-base">
                WSC ProductionTrack
              </span>
              <AppVersion className="text-white/70 drop-shadow" />
            </div>
          </div>
          <div className="flex max-w-[62%] flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2">
            {profile && (
              <>
                <Link to="/expense-scan" aria-label="เบิกค่าใช้จ่าย (AI สแกน)">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 rounded-full bg-emerald-600 px-2.5 text-white ring-1 ring-white/30 hover:bg-emerald-700 hover:text-white sm:px-3"
                  >
                    <ScanLine className="h-4 w-4" />
                    <span className="hidden sm:inline">สแกนบิล</span>
                  </Button>
                </Link>
                <Link to="/supplies-request" aria-label="เบิกอุปกรณ์ออฟฟิศ">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 rounded-full bg-indigo-600 px-2.5 text-white ring-1 ring-white/30 hover:bg-indigo-700 hover:text-white sm:px-3"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span className="hidden sm:inline">เบิกของ</span>
                  </Button>
                </Link>
                <Link to="/maintenance" aria-label="เจ้าหนูแจ้งซ่อม">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 rounded-full bg-orange-600 px-2.5 text-white ring-1 ring-white/30 hover:bg-orange-700 hover:text-white sm:px-3"
                  >
                    <Wrench className="h-4 w-4" />
                    <span className="hidden sm:inline">แจ้งซ่อม</span>
                  </Button>
                </Link>
              </>
            )}
            <a
              href="https://lin.ee/P94KTyM"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="เพิ่มเพื่อนทาง LINE — ดูยอดการผลิต/ประชาสัมพันธ์ภายใน"
            >
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 rounded-full bg-[#06C755] px-2.5 text-white ring-1 ring-white/30 hover:bg-[#05b34c] hover:text-white sm:px-3"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">LINE WSC</span>
              </Button>
            </a>
            <Link to="/admin">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 rounded-full bg-white/[0.07] px-2.5 text-primary-foreground backdrop-blur-md ring-1 ring-white/20 hover:bg-white/15 hover:text-primary-foreground sm:px-3"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">แอดมิน</span>
              </Button>
            </Link>
          </div>
        </header>

        <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[75dvh] flex-col items-center gap-3 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-6">
          {slides.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => api?.scrollTo(i)}
                  aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          )}
          <div className="w-full max-w-md space-y-2">
            {!sessionReady ? (
              <div className="flex h-16 items-center justify-center rounded-2xl bg-white/90">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : !profile ? (
              <form
                onSubmit={onLogin}
                className="space-y-2 rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur-md"
              >
                <p className="text-center text-sm font-semibold text-primary">
                  เข้าสู่ระบบพนักงาน
                </p>
                <Input
                  id="employee-code"
                  name="employee-code"
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="รหัสพนักงาน"
                  autoComplete="username"
                  className="h-11"
                  required
                />
                <Input
                  id="employee-password"
                  name="employee-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  autoComplete="current-password"
                  className="h-11"
                  required
                />
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="h-12 w-full rounded-xl text-base font-bold"
                >
                  {loginLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "เข้าสู่ระบบ"
                  )}
                </Button>
              </form>
            ) : (
              <>
                {showScan && (
                  <Button
                    onClick={() => navigate({ to: "/scan", search: { job_id: "" } })}
                    className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-primary shadow-lg hover:bg-white/90"
                  >
                    <ScanLine className="mr-2 h-5 w-5" />
                    สแกน
                  </Button>
                )}
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setProfileOpen(true)}
                    className="col-span-3 h-12 min-w-0 rounded-2xl bg-white text-primary shadow-md ring-1 ring-white/40 hover:bg-white/90"
                  >
                    <UserRound className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">โปรไฟล์ · {profile.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setLogoutConfirmOpen(true)}
                    aria-label="ออกจากระบบ"
                    className="h-12 rounded-2xl bg-white px-2 text-primary shadow-md ring-1 ring-white/40 hover:bg-white/90 hover:text-primary"
                  >
                    <LogOut className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">ออก</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  {showQc && (
                    <Link to="/qc" search={{ job_id: "" }} className="flex-1">
                      <Button
                        variant="ghost"
                        className="h-12 w-full rounded-2xl bg-white/[0.07] text-primary-foreground backdrop-blur-md ring-1 ring-white/20 hover:bg-white/15 hover:text-primary-foreground"
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        QC
                      </Button>
                    </Link>
                  )}
                  {showPacking && (
                    <Link to="/packing" search={{ job_id: "" }} className="flex-[2]">
                      <Button
                        variant="ghost"
                        aria-label="แพ็คของ"
                        className="h-12 w-full rounded-2xl bg-blue-600 text-white ring-1 ring-white/30 hover:bg-blue-700 hover:text-white"
                      >
                        <Package className="h-4 w-4 mr-1" />
                        แพ็คของ
                      </Button>
                    </Link>
                  )}
                  {showStock && (
                    <Link to="/stock-count" className="flex-1">
                      <Button
                        variant="ghost"
                        aria-label="นับสต๊อก"
                        className="h-12 w-full rounded-2xl bg-amber-600 text-white ring-1 ring-white/30 hover:bg-amber-700 hover:text-white"
                      >
                        <Boxes className="h-4 w-4 mr-1" />
                        นับสต๊อก
                      </Button>
                    </Link>
                  )}
                </div>
                {!showScan &&
                  !showQc &&
                  !showPacking &&
                  !showStock && (
                    <p className="rounded-xl bg-white/90 px-3 py-2 text-center text-sm text-muted-foreground">
                      บัญชีนี้ยังไม่มีแผนกงานบนหน้าแรก — ติดต่อแอดมิน/HR
                    </p>
                  )}
              </>
            )}
            <div className="flex justify-center gap-3 pt-1 text-xs text-white/70">
              <Link to="/terms" className="underline-offset-2 hover:text-white hover:underline">
                ข้อกำหนดการใช้งาน
              </Link>
            </div>
          </div>
        </div>
      </section>

      {profile && (
        <EmployeeProfileDialog
          mode="self"
          target={
            profileOpen ? { name: profile.name, emp_code: profile.emp_code } : null
          }
          onClose={() => setProfileOpen(false)}
        />
      )}
      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันออกจากระบบ?</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องกรอกรหัสพนักงานและรหัสผ่านใหม่เมื่อต้องการเข้าใช้งานครั้งถัดไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <AlertDialogCancel className="mt-0">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={onLogout}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              ออกจากระบบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
