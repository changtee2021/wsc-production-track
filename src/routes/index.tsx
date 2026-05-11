import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  ArrowRight,
  Factory,
  ShieldCheck,
  ScanLine,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideToConfirm } from "@/components/SlideToConfirm";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/welcome-hero.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ยินดีต้อนรับ — WSC ProductionTrack" },
      {
        name: "description",
        content:
          "ระบบติดตามการผลิตในโรงงาน บันทึกเวลาเริ่ม–เสร็จงานด้วย QR code อย่างรวดเร็ว",
      },
    ],
  }),
  component: WelcomePage,
});

const STEPS = [
  {
    icon: ScanLine,
    title: "สแกน QR",
    desc: "สแกนรหัสงานบนใบสั่งผลิต",
  },
  {
    icon: UserCheck,
    title: "เลือกพนักงาน/ขั้นตอน",
    desc: "ระบุผู้ปฏิบัติงานและขั้นตอน",
  },
  {
    icon: CheckCircle2,
    title: "เลื่อนเพื่อยืนยัน",
    desc: "ยืนยันเริ่ม/เสร็จงานแบบเรียลไทม์",
  },
] as const;

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
      <AnnouncementBar />
      {/* ── Top: banner carousel ── */}
      <section className="relative flex-[2] w-full overflow-hidden bg-primary">
        <Carousel
          className="h-full w-full"
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
                <div className="relative h-[66.67dvh] w-full">
                  <img
                    src={src}
                    alt={`แบนเนอร์ ${i + 1}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-transparent to-background/95" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Floating header */}
        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-2 text-primary-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">
              <Factory className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight drop-shadow">
              WSC ProductionTrack
            </span>
          </div>
          <Link to="/admin">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 rounded-full bg-white/15 text-primary-foreground backdrop-blur-md ring-1 ring-white/20 hover:bg-white/25 hover:text-primary-foreground"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">แอดมิน</span>
            </Button>
          </Link>
        </header>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-1.5">
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
      </section>

      {/* ── Bottom: 3 steps + slide-to-start (1/3) ── */}
      <section className="relative flex h-1/3 w-full flex-col justify-between gap-3 px-5 pb-5 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="flex flex-col items-center rounded-2xl border bg-card p-2.5 text-center shadow-sm"
              >
                <div className="relative mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-md shadow-secondary/30">
                  <Icon className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <div className="text-[11px] font-semibold leading-tight">
                  {s.title}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground line-clamp-2">
                  {s.desc}
                </div>
              </div>
            );
          })}
        </div>

        <SlideToConfirm
          label="เริ่มงาน"
          icon={ArrowRight}
          onConfirm={goToScan}
          colorClass="bg-primary text-primary-foreground"
          thumbClass="bg-secondary text-secondary-foreground"
        />
      </section>
    </div>
  );
}
