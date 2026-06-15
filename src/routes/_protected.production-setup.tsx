import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Toaster } from "@/components/ui/sonner";
import { CategoriesPanel, StepsPanel } from "@/components/production-setup-panels";
import { QcChecklistsPanel } from "@/components/QcChecklistsPanel";
import { PackingChecklistsPanel } from "@/components/PackingChecklistsPanel";

export const Route = createFileRoute("/_protected/production-setup")({
  head: () => ({ meta: [{ title: "ตั้งค่าการผลิต — WSC ProductionTrack" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  component: ProductionSetup,
});

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="group/collapsible rounded-2xl border border-border bg-card shadow-sm"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3 text-left font-semibold hover:bg-muted/40">
        <span className="text-base">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border">
        <div className="p-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProductionSetup() {
  const { tab } = Route.useSearch();
  const sections: { id: string; title: string; node: React.ReactNode }[] = [
    { id: "cat", title: "หมวดหมู่งานม่าน", node: <CategoriesPanel /> },
    { id: "step", title: "ขั้นตอนการผลิต", node: <StepsPanel /> },
    { id: "qc-check", title: "เช็คลิสต์ QC", node: <QcChecklistsPanel /> },
    { id: "pack-check", title: "เช็คลิสต์แพ็คของ", node: <PackingChecklistsPanel /> },
  ];
  const openId = tab && sections.some((s) => s.id === tab) ? tab : "cat";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">ตั้งค่าการผลิต</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        จัดการหมวดหมู่งานม่าน ขั้นตอนการผลิต และเช็คลิสต์ QC / แพ็คของ (คลิกหัวข้อเพื่อเปิด/ปิด)
      </p>
      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={s.id} id={`section-${s.id}`}>
            <Section title={s.title} defaultOpen={s.id === openId}>
              {s.node}
            </Section>
            {i < sections.length - 1 && (
              <div className="mx-2 my-3 border-t border-dashed border-border/60" />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
