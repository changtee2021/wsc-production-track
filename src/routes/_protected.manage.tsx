import { createFileRoute } from "@tanstack/react-router";
import { AllStaffPanel } from "@/components/AllStaffPanel";

export const Route = createFileRoute("/_protected/manage")({
  head: () => ({ meta: [{ title: "จัดการพนักงาน — WSC ProductionTrack" }] }),
  component: ManageStaffPage,
});

function ManageStaffPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการพนักงาน</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          เพิ่ม แก้ไข และกำหนดแผนกพนักงานทั้งหมดใน WSC Production Track
        </p>
      </div>
      <AllStaffPanel />
    </main>
  );
}