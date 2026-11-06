import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  BookOpenCheck,
  ShieldCheck,
  ScanLine,
  MessageSquarePlus,
  Wrench,
  ShoppingCart,
  Boxes,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { HomeEntryDialog } from "@/components/HomeEntryDialog";
import { clientAppPublicPath } from "@/lib/app-public-url";
import { WscMark } from "@/components/WscMark";
import type { HomeActor } from "@/lib/home-actor";
import { SEQUENTIAL_SCAN_ENABLED, homeScanTarget } from "@/lib/sequential-scan";
import { saveStoredStockEmployee } from "@/lib/stock-employee-persistence";

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
  const [entry, setEntry] = useState<{ label: string; go: (actor: HomeActor) => void } | null>(null);

  function ask(label: string, go: (actor: HomeActor) => void) {
    setEntry({ label, go });
  }

  function entered(actor: HomeActor) {
    const go = entry?.go;
    setEntry(null);
    go?.(actor);
  }

  const [banners, setBanners] = useState<string[]>([]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);

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

  const slides = banners.length > 0 ? banners : [heroImage];

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <h1 className="sr-only">WSC ProductionTrack — ระบบติดตามการผลิตในโรงงาน</h1>
      <AnnouncementBar />
      {/* ── Fullscreen banner carousel (tap to start) ── */}
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

        {/* Bottom fade overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-1/4 bg-gradient-to-t from-primary via-primary/70 to-transparent"
        />

        {/* Floating header */}
        <header
          className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:items-center sm:px-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 items-center gap-2 text-primary-foreground">
            <WscMark tone="white" className="h-9 w-9 shrink-0 object-contain" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-bold tracking-tight drop-shadow">
                WSC ProductionTrack
              </span>
              <AppVersion className="text-white/70 drop-shadow" />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="เบิกค่าใช้จ่าย (AI สแกน)"
                onClick={() => ask("สแกนบิล", () => navigate({ to: "/expense-scan" }))}
                className="h-11 w-11 gap-1 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3 bg-emerald-600 text-white ring-1 ring-white/30 hover:bg-emerald-700 hover:text-white"
              >
                <ScanLine className="h-4 w-4" />
                <span className="hidden sm:inline">สแกนบิล</span>
              </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="เบิกอุปกรณ์ออฟฟิศ"
                onClick={() => ask("เบิกของ", () => navigate({ to: "/supplies-request" }))}
                className="h-11 w-11 gap-1 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3 bg-indigo-600 text-white ring-1 ring-white/30 hover:bg-indigo-700 hover:text-white"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">เบิกของ</span>
              </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="เจ้าหนูแจ้งซ่อม"
                onClick={() => ask("แจ้งซ่อม", () => navigate({ to: "/maintenance" }))}
                className="h-11 w-11 gap-1 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3 bg-orange-600 text-white ring-1 ring-white/30 hover:bg-orange-700 hover:text-white"
              >
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">แจ้งซ่อม</span>
              </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="ส่งความคิดเห็น/แจ้งปัญหา"
                onClick={() => ask("แจ้งปัญหา", () => navigate({ to: "/feedback" }))}
                className="h-11 w-11 gap-1 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3 bg-sky-600 text-white ring-1 ring-white/30 hover:bg-sky-700 hover:text-white"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span className="hidden sm:inline">แจ้งปัญหา</span>
              </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="ดูคู่มือ WI"
                onClick={() => ask("คู่มือ WI", () => navigate({ to: "/manual", search: { category: "" } }))}
                className="h-11 w-11 gap-1 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3 bg-violet-600 text-white ring-1 ring-white/30 hover:bg-violet-700 hover:text-white"
              >
                <BookOpenCheck className="h-4 w-4" />
                <span className="hidden sm:inline">คู่มือ WI</span>
              </Button>
            <Link to="/admin">
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 gap-1 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3 bg-white/[0.07] text-primary-foreground backdrop-blur-md ring-1 ring-white/20 hover:bg-white/15 hover:text-primary-foreground"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">แอดมิน</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Dots + Slide to scan */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-5">
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
            <Button
              type="button"
              onClick={() =>
                ask("สแกน", (actor) =>
                  navigate(
                    homeScanTarget(actor.source, SEQUENTIAL_SCAN_ENABLED, actor.office === true),
                  ),
                )
              }
              className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-primary shadow-lg hover:bg-white/90"
            >
              <ScanLine className="mr-2 h-5 w-5" />
              สแกน
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                  type="button"
                  variant="ghost"
                  aria-label="คลังสินค้า"
                  onClick={() =>
                    ask("คลัง", (actor) => {
                      if (actor.source === "warehouse") {
                        saveStoredStockEmployee({ id: actor.id, code: actor.empCode, name: actor.name });
                      }
                      void navigate({ to: "/warehouse" });
                    })
                  }
                  className="h-12 w-full rounded-2xl bg-teal-600 text-white ring-1 ring-white/30 hover:bg-teal-700 hover:text-white"
                >
                  <Warehouse className="mr-1 h-4 w-4" />
                  คลัง
                </Button>
              <Button
                  type="button"
                  variant="ghost"
                  aria-label="นับสต๊อก"
                  onClick={() =>
                    ask("นับสต๊อก", (actor) => {
                      if (actor.source === "stock") {
                        saveStoredStockEmployee({ id: actor.id, code: actor.empCode, name: actor.name });
                      }
                      void navigate({ to: "/stock-count" });
                    })
                  }
                  className="h-12 w-full rounded-2xl bg-amber-600 text-white ring-1 ring-white/30 hover:bg-amber-700 hover:text-white"
                >
                  <Boxes className="mr-1 h-4 w-4" />
                  นับสต๊อก
                </Button>
            </div>
            <div className="flex justify-center gap-3 pt-1 text-xs text-white/70">
              <button
                type="button"
                onClick={() => ask("แจ้งปัญหา", () => navigate({ to: "/feedback" }))}
                className="underline-offset-2 hover:text-white hover:underline"
              >
                ส่งความคิดเห็น
              </button>
              <span>·</span>
              <Link to="/terms" className="underline-offset-2 hover:text-white hover:underline">
                ข้อกำหนดการใช้งาน
              </Link>
            </div>
          </div>
        </div>
      </section>
      <HomeEntryDialog
        label={entry?.label ?? ""}
        open={entry !== null}
        onOpenChange={(open) => {
          if (!open) setEntry(null);
        }}
        onEntered={entered}
      />
    </div>
  );
}
