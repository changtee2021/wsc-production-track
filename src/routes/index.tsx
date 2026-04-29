import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { QrCode, ShieldCheck, Factory, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProductionTrack — Manufacturing Job Tracking" },
      {
        name: "description",
        content:
          "Mobile-first production tracking for manufacturing teams. Scan job QR codes, log start and finish times, and monitor output in real time.",
      },
      { property: "og:title", content: "ProductionTrack" },
      {
        property: "og:description",
        content: "Scan, log, and track manufacturing jobs from the floor.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <Link to="/admin">
          <Button variant="secondary" size="sm" className="gap-1">
            <ShieldCheck className="h-4 w-4" />
            Admin
          </Button>
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <section
          className="rounded-2xl px-6 py-12 text-primary-foreground shadow-[var(--shadow-card)]"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Factory className="h-4 w-4" />
            <span>Manufacturing Floor</span>
          </div>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Track every job, every step.
          </h1>
          <p className="mt-3 max-w-xl text-base opacity-90">
            Workers scan a QR code on the job sheet, pick their name and step,
            and tap Start or Finish. Admins see live production stats.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/scan" search={{ job_id: "DEMO123" }}>
              <Button size="lg" variant="secondary" className="gap-2">
                <QrCode className="h-5 w-5" />
                Try the scan page
              </Button>
            </Link>
            <Link to="/admin">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              >
                Admin dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<QrCode className="h-6 w-6" />}
            title="QR-driven"
            text="Print job sheets with /scan?job_id=… links. Workers never type."
          />
          <FeatureCard
            icon={<Factory className="h-6 w-6" />}
            title="Mobile-first"
            text="Big buttons and icons, optimised for phones on the floor."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Admin insights"
            text="Daily and monthly charts, plus CSV / Excel export."
          />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
