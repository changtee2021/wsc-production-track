import { createFileRoute } from "@tanstack/react-router";
import { ScanTrialApp } from "@/components/ScanTrialApp";

export const Route = createFileRoute("/scan-trial")({
  head: () => ({
    meta: [{ title: "แอปทดลองสแกน — WSC ProductionTrack" }],
  }),
  component: ScanTrialPage,
});

function ScanTrialPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6">
      <h1 className="mb-1 text-center text-lg font-bold">แอปทดลองสแกน</h1>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        สแกนบัตรก่อน แล้วสแกน QR รหัสงาน 123 ม่านม้วน · 456 มู่ลี่ไม้ · 789 อลูมิเนียม · 111
        ม่านปรับแสง
      </p>
      <ScanTrialApp />
    </main>
  );
}
