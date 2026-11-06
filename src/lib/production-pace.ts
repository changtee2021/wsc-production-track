// Two time lines on a production step.
// fast_seconds in the database is the normal line. target_seconds is the overtime line.
// Green: strictly before normal. Yellow: from normal through the overtime line. Red: past overtime.

export type ProductionPace = "green" | "yellow" | "red";

export function productionPace(
  actualSeconds: number,
  normalSeconds: number | null | undefined,
  overtimeSeconds: number | null | undefined,
): ProductionPace | null {
  if (overtimeSeconds == null || overtimeSeconds <= 0) return null;
  if (actualSeconds > overtimeSeconds) return "red";
  const normal =
    normalSeconds != null && normalSeconds > 0 && normalSeconds <= overtimeSeconds
      ? normalSeconds
      : overtimeSeconds;
  if (actualSeconds < normal) return "green";
  return "yellow";
}

export const PACE_LABEL: Record<ProductionPace, string> = {
  green: "ก่อนเวลาปกติ",
  yellow: "เวลาปกติ",
  red: "เกินเวลา",
};

export function paceTone(pace: ProductionPace | null) {
  if (pace === "red") {
    return {
      text: "text-rose-600",
      bar: "bg-rose-500",
      card: "border-rose-300 bg-rose-50/50 dark:bg-rose-950/20",
      label: PACE_LABEL.red,
    };
  }
  if (pace === "yellow") {
    return {
      text: "text-amber-600",
      bar: "bg-amber-500",
      card: "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20",
      label: PACE_LABEL.yellow,
    };
  }
  if (pace === "green") {
    return {
      text: "text-emerald-600",
      bar: "bg-emerald-500",
      card: "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20",
      label: PACE_LABEL.green,
    };
  }
  return {
    text: "text-foreground",
    bar: "bg-muted-foreground",
    card: "border-border bg-background",
    label: "",
  };
}
