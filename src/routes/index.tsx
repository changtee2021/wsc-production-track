import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Factory, ShieldCheck, ScanLine, ClipboardCheck, Package, MessageCircle } from "lucide-react";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ยินดีต้อนรับ — WSC ProductionTrack" },
      {
        name: "description",
        content:
          "ระบบติดตามการผลิตในโรงงาน บันทึกเวลาเริ่ม–เสร็จงานด้วย QR code อย่างรวดเร็ว",
      },
      { property: "og:title", content: "WSC ProductionTrack — ระบบติดตามการผลิต" },
      {
        property: "og:description",
        content:
          "บันทึกเวลาเริ่ม–เสร็จงานในสายการผลิตด้วย QR code พร้อมระบบ QC แบบ checklist บนมือถือ",
      },
      { property: "og:url", content: "https://wsc-production-track.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://wsc-production-track.lovable.app/" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate({ from: "/" });
  const goToScan = () => navigate({ to: "/scan", search: { job_id: "" } });

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
          const { data: pub } = supabase.storage
            .from("banners")
            .getPublicUrl(r.image_path);
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
          plugins={
            slides.length > 1
              ? [Autoplay({ delay: 5000, stopOnInteraction: false })]
              : []
          }
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
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-primary-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07] backdrop-blur-md ring-1 ring-white/20">
              <Factory className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight drop-shadow">
              WSC ProductionTrack
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://lin.ee/P94KTyM"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="เพิ่มเพื่อนทาง LINE — ดูยอดการผลิต/ประชาสัมพันธ์ภายใน"
            >
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 rounded-full bg-[#06C755] text-white ring-1 ring-white/30 hover:bg-[#05b34c] hover:text-white"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">LINE WSC</span>
              </Button>
            </a>
            <Link to="/qc" search={{ job_id: "" }}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 rounded-full bg-white/[0.07] text-primary-foreground backdrop-blur-md ring-1 ring-white/20 hover:bg-white/15 hover:text-primary-foreground"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">QC</span>
              </Button>
            </Link>
            <Link to="/admin">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 rounded-full bg-white/[0.07] text-primary-foreground backdrop-blur-md ring-1 ring-white/20 hover:bg-white/15 hover:text-primary-foreground"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">แอดมิน</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Dots + Slide to scan */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-5 pb-6">
          {slides.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => api?.scrollTo(i)}
                  aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current
                      ? "w-6 bg-white"
                      : "w-1.5 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          )}
          <div className="w-full max-w-md">
            <Button
              onClick={goToScan}
              className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-primary shadow-lg hover:bg-white/90"
            >
              <ScanLine className="mr-2 h-5 w-5" />
              สแกน
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
