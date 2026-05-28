// Control center — home page banners + announcements management.
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { BannersPanel } from "@/components/BannersPanel";
import { AnnouncementsPanel } from "@/components/AnnouncementsPanel";

export const Route = createFileRoute("/_protected/control")({
  head: () => ({ meta: [{ title: "Control — WSC ProductionTrack" }] }),
  component: ControlPage,
});

function ControlPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <Toaster richColors position="top-center" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Control</h1>
        <p className="text-sm text-muted-foreground">
          จัดการแบนเนอร์หน้าแรกและประกาศต่างๆ
        </p>
      </div>
      <BannersPanel />
      <AnnouncementsPanel />
    </main>
  );
}
