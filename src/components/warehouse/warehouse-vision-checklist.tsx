import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWarehouseToken } from "@/lib/auth/warehouse-session";
import { whListVisionItems } from "@/lib/features/warehouse-settings.functions";

export type VisionCheckState = Record<string, "pass" | "fail" | "">;

export function WarehouseVisionChecklist({
  checks,
  onChange,
}: {
  checks: VisionCheckState;
  onChange: (next: VisionCheckState) => void;
}) {
  const token = getWarehouseToken() ?? "";
  const listFn = useServerFn(whListVisionItems);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wh-vision-items"],
    queryFn: () => listFn({ data: { token } }),
    enabled: !!token,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">กำลังโหลดรายการเช็ควิส...</p>;
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        ไม่มีรายการเช็ควิส — แอดมินเพิ่มได้ที่ ตั้งค่าคลัง → เช็ควิส
      </p>
    );
  }

  const answered = items.filter((it) => checks[it.id] === "pass" || checks[it.id] === "fail").length;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ListChecks className="h-4 w-4 text-teal-600" />
        เช็ควิสรับของ
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {answered}/{items.length}
        </span>
      </h2>
      <div className="space-y-2">
        {items.map((it, idx) => {
          const st = checks[it.id] ?? "";
          return (
            <div key={it.id} className="rounded-xl border bg-card p-3">
              <p className="text-sm font-medium">
                {idx + 1}. {it.label}
                {it.required && <span className="ml-1 text-destructive">*</span>}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={st === "pass" ? "default" : "outline"}
                  className={st === "pass" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  onClick={() => onChange({ ...checks, [it.id]: "pass" })}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  ผ่าน
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={st === "fail" ? "destructive" : "outline"}
                  onClick={() => onChange({ ...checks, [it.id]: "fail" })}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  ไม่ผ่าน
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function visionChecksComplete(
  items: { id: string; required: boolean }[],
  checks: VisionCheckState,
  requireAll: boolean,
): boolean {
  for (const it of items) {
    const st = checks[it.id];
    if (!st) {
      if (it.required && requireAll) return false;
      continue;
    }
    if (st === "fail" && it.required) return false;
  }
  if (requireAll) {
    return items.every((it) => !it.required || checks[it.id] === "pass");
  }
  return true;
}
