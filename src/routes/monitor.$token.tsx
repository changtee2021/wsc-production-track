// Public read-only monitor: anyone holding the secret link can watch (no login).
import { createFileRoute } from "@tanstack/react-router";
import { MonitorBoard } from "@/components/monitor/MonitorBoard";

export const Route = createFileRoute("/monitor/$token")({
  head: () => ({
    meta: [
      { title: "Monitor Real-Time — WSC ProductionTrack" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicMonitor,
});

function PublicMonitor() {
  const { token } = Route.useParams();
  return (
    <main className="min-h-[100dvh] bg-muted/30">
      <MonitorBoard share={token} />
    </main>
  );
}
