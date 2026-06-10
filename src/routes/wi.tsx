import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { ArrowLeft, BookOpenCheck, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WiFlowChart, WiOverviewStrip } from "@/components/wi/WiFlowChart";
import {
  WORK_INSTRUCTIONS,
  getWorkInstruction,
} from "@/lib/data/work-instructions";

export const Route = createFileRoute("/wi")({
  validateSearch: zodValidator(
    z.object({
      id: fallback(z.string(), "pvc-room-divider").default("pvc-room-divider"),
    }),
  ),
  head: () => ({
    meta: [
      { title: "Work Instruction (WI) — WSC ProductionTrack" },
      {
        name: "description",
        content: "คู่มือปฏิบัติงาน (WI) แสดง flow chart กระบวนการผลิตแยกหมวดหมู่",
      },
    ],
  }),
  component: WiPage,
});

function WiPage() {
  const { id } = Route.useSearch();
  const navigate = Route.useNavigate();

  const wi = useMemo(() => getWorkInstruction(id) ?? WORK_INSTRUCTIONS[0], [id]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              หน้าแรก
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            Work Instruction (WI)
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <BookOpenCheck className="h-5 w-5" />
              <span className="text-sm font-medium">คู่มือปฏิบัติงาน</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{wi.title}</h1>
            <p className="text-sm text-muted-foreground">
              สายผลิต: {wi.productLine} · {wi.steps.length} ขั้นตอน ·{" "}
              {wi.categories.length} หมวดหมู่
            </p>
          </div>

          {WORK_INSTRUCTIONS.length > 1 && (
            <Select
              value={wi.id}
              onValueChange={(v) => navigate({ search: { id: v } })}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="เลือก WI" />
              </SelectTrigger>
              <SelectContent>
                {WORK_INSTRUCTIONS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <WiOverviewStrip wi={wi} />

        <WiFlowChart wi={wi} />

        <div className="flex flex-wrap gap-2 border-t pt-6">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              กลับหน้าแรก
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/scan" search={{ job_id: "" }}>
              <Factory className="mr-1 h-4 w-4" />
              สแกนงานผลิต
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
