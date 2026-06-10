import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, FileText, GitBranch, Users } from "lucide-react";
import type { WorkInstruction, WiStep } from "@/lib/data/work-instructions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  wi: WorkInstruction;
};

function StepCard({
  step,
  color,
  onSelect,
}: {
  step: WiStep;
  color: string;
  onSelect: (step: WiStep) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(step)}
      className="group flex shrink-0 flex-col text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ width: "min(220px, 72vw)" }}
    >
      <Card className="h-full border-2 shadow-sm transition-shadow group-hover:shadow-md">
        <CardHeader className="space-y-2 p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {step.order}
            </span>
            {step.branchLabel && (
              <Badge variant="outline" className="text-[10px] font-normal">
                <GitBranch className="mr-1 h-3 w-3" />
                {step.branchLabel}
              </Badge>
            )}
          </div>
          <CardTitle className="text-sm font-semibold leading-snug">
            {step.processName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            {step.department}
          </p>
          <p className="line-clamp-2 text-xs text-foreground/80">
            {step.actions[0]}
          </p>
          <span className="inline-flex items-center text-[11px] font-medium text-primary">
            ดูรายละเอียด
            <ChevronRight className="h-3 w-3" />
          </span>
        </CardContent>
      </Card>
    </button>
  );
}

export function WiFlowChart({ wi }: Props) {
  const [selected, setSelected] = useState<WiStep | null>(null);

  const lanes = useMemo(() => {
    return wi.categories.map((cat) => ({
      ...cat,
      steps: wi.steps
        .filter((s) => s.categoryId === cat.id)
        .sort((a, b) => a.order - b.order),
    }));
  }, [wi]);

  return (
    <div className="space-y-8">
      {lanes.map((lane, laneIdx) => (
        <section key={lane.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: lane.color }}
            />
            <div>
              <h2 className="text-base font-bold text-foreground">{lane.name}</h2>
              {lane.description && (
                <p className="text-sm text-muted-foreground">{lane.description}</p>
              )}
            </div>
            <Badge variant="secondary" className="ml-auto">
              {lane.steps.length} ขั้นตอน
            </Badge>
          </div>

          <div className="relative overflow-x-auto pb-2">
            <div className="flex min-w-max items-stretch gap-2 px-1 py-2">
              {lane.steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-2">
                  <StepCard
                    step={step}
                    color={lane.color}
                    onSelect={setSelected}
                  />
                  {i < lane.steps.length - 1 && (
                    <ArrowRight
                      className="h-5 w-5 shrink-0 text-muted-foreground/60"
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {lane.id === "assembly" && (
            <p className="rounded-lg border border-dashed border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
              <GitBranch className="mr-1 inline h-3.5 w-3.5" />
              หลังขั้น CNC แยก 2 เส้นทาง: <strong>เส้นทาง A — EURO</strong> (ขั้น 5–6)
              หรือ <strong>เส้นทาง B — ลูกล้อ</strong> (ขั้น 7–8) แล้วรวมที่ขั้นทำความสะอาด
            </p>
          )}

          {laneIdx < lanes.length - 1 && (
            <div className="flex justify-center py-1">
              <ChevronRight className="h-6 w-6 rotate-90 text-muted-foreground/40" />
            </div>
          )}
        </section>
      ))}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-start gap-2 pr-6 text-left">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{
                      backgroundColor:
                        wi.categories.find((c) => c.id === selected.categoryId)
                          ?.color ?? "hsl(var(--primary))",
                    }}
                  >
                    {selected.order}
                  </span>
                  <span>{selected.processName}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    <Users className="mr-1 h-3 w-3" />
                    {selected.department}
                  </Badge>
                  {selected.branchLabel && (
                    <Badge variant="outline">{selected.branchLabel}</Badge>
                  )}
                </div>

                <div>
                  <p className="mb-2 font-semibold text-foreground">การกระทำ</p>
                  <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                    {selected.actions.map((a) => (
                      <li key={a} className="leading-relaxed">
                        {a}
                      </li>
                    ))}
                  </ol>
                </div>

                {selected.documents && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="mb-1 flex items-center gap-1 font-semibold text-foreground">
                      <FileText className="h-4 w-4" />
                      เอกสารอ้างอิง
                    </p>
                    <p className="text-muted-foreground">{selected.documents}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  ทุกขั้นตอน: บันทึกเวลาเริ่ม → ปฏิบัติงาน → บันทึกภาพถ่าย/วีดีโอจบ JOB
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** แถบสรุป flow แนวนอนทั้งกระบวนการ (overview) */
export function WiOverviewStrip({ wi }: Props) {
  const sorted = [...wi.steps].sort((a, b) => a.order - b.order);
  const catMap = new Map(wi.categories.map((c) => [c.id, c]));

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-3">
      <div className="flex min-w-max items-center gap-1">
        {sorted.map((step, i) => {
          const cat = catMap.get(step.categoryId);
          return (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex max-w-[100px] flex-col items-center rounded-lg px-2 py-1.5 text-center",
                )}
                style={{ borderBottom: `3px solid ${cat?.color ?? "#ccc"}` }}
              >
                <span className="text-[10px] font-bold text-muted-foreground">
                  {step.order}
                </span>
                <span className="line-clamp-2 text-[10px] leading-tight text-foreground">
                  {step.processName}
                </span>
              </div>
              {i < sorted.length - 1 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
