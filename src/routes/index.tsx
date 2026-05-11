import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Factory, ShieldCheck, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideToConfirm } from "@/components/SlideToConfirm";
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

function WelcomePage() {
  const navigate = useNavigate({ from: "/" });
  const goToScan = () => navigate({ to: "/scan", search: { job_id: "" } });

  return (
    <div className="relative min-h-screen overflow-hidden bg-primary">
      {/* Background image */}
      <img
        src={heroImage}
        alt="พนักงานกำลังประกอบงานในสายการผลิต"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Blue gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/55 to-primary/95" />
      <div className="absolute inset-0 bg-gradient-to-tr from-secondary/40 via-transparent to-transparent" />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2 text-primary-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">
            <Factory className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight">WSC ProductionTrack</span>
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

      {/* Content */}
      <main className="relative z-10 flex min-h-[calc(100vh-72px)] flex-col px-6 pb-10 pt-16">
        <div className="flex-1 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur-md ring-1 ring-white/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
            </span>
            ระบบพร้อมใช้งาน
          </div>

          <h1 className="mt-6 text-5xl font-bold leading-tight text-primary-foreground">
            ยินดีต้อนรับ
            <span className="mt-1 block bg-gradient-to-r from-white to-secondary-foreground/90 bg-clip-text text-transparent">
              สู่สายการผลิต
            </span>
          </h1>

          <p className="mt-4 max-w-sm text-base leading-relaxed text-primary-foreground/85">
            สแกน QR code เพื่อบันทึกเวลาเริ่มและเสร็จงาน
            ติดตามประสิทธิภาพได้แบบเรียลไทม์
          </p>

          {/* Highlight card */}
          <div className="mt-8 rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl shadow-2xl shadow-primary/40">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-lg shadow-secondary/40">
                <ScanLine className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-semibold text-primary-foreground">
                  เริ่มต้นง่ายๆ ใน 3 ขั้นตอน
                </div>
                <div className="mt-1 text-xs leading-relaxed text-primary-foreground/80">
                  สแกน QR → เลือกพนักงาน/ขั้นตอน → เลื่อนเพื่อยืนยัน
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide to enter */}
        <div className="mt-8 space-y-3">
          <SlideToConfirm
            label="เริ่มงาน"
            icon={ArrowRight}
            onConfirm={goToScan}
            colorClass="bg-white/15 text-primary-foreground backdrop-blur-xl ring-1 ring-white/30"
            thumbClass="bg-secondary text-secondary-foreground"
          />
          <p className="text-center text-xs text-primary-foreground/70">
            เลื่อนปุ่มไปทางขวาเพื่อเข้าหน้าสแกน
          </p>
        </div>
      </main>
    </div>
  );
}
