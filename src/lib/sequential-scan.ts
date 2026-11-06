import { scanLaneDecision, type ScanLane } from "./scan-trial.ts";

/**
 * Floor step order.
 * true: production, QC, and packing use /scan-trial in step order.
 * Office badges still go to line intake.
 * false: production uses the original scan. QC stays on /qc. Packing stays on /packing.
 */
export const SEQUENTIAL_SCAN_ENABLED = false;

export type HomeScanTarget =
  | { to: "/scan-trial"; search: { job_id: ""; desk: "office" | "floor" } }
  | { to: "/scan"; search: { job_id: "" } }
  | { to: "/qc"; search: { job_id: "" } }
  | { to: "/packing"; search: { job_id: "" } };

/** Where the home Scan button goes after a badge is read. */
export function homeScanTarget(
  source: string,
  sequential = SEQUENTIAL_SCAN_ENABLED,
  office = false,
): HomeScanTarget {
  if (office || source === "office") {
    return { to: "/scan-trial", search: { job_id: "", desk: "office" } };
  }
  if (sequential) return { to: "/scan-trial", search: { job_id: "", desk: "floor" } };
  if (source === "qc") return { to: "/qc", search: { job_id: "" } };
  if (source === "packing") return { to: "/packing", search: { job_id: "" } };
  return { to: "/scan", search: { job_id: "" } };
}

/** While step order is off, every job stays on the original scan. */
export function floorScanLaneDecision(
  lane: ScanLane,
  released: boolean,
  sequential = SEQUENTIAL_SCAN_ENABLED,
): "open" | "blocked" {
  if (!sequential) return lane === "v1" ? "open" : "blocked";
  return scanLaneDecision(lane, released);
}
