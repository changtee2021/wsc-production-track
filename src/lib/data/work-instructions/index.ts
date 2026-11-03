import type { WorkInstruction, WiCategory, WiStep } from "./types";
import { pvcRoomDividerWi } from "./pvc-room-divider";
import { TRIAL_FLOWS, stepLabel, type TrialFlow } from "@/lib/scan-trial";

const LANE_COLORS = ["hsl(221 83% 53%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)"];
const AFTER_COLOR = "hsl(0 72% 51%)";

function trialWorkInstruction(flow: TrialFlow): WorkInstruction {
  const categories: WiCategory[] = flow.lanes.map((lane, index) => ({
    id: `lane-${index + 1}`,
    name: `สาย ${index + 1}`,
    description: lane.map((name) => stepLabel(name)).join(" → "),
    color: LANE_COLORS[index] ?? LANE_COLORS[0],
  }));
  categories.push({
    id: "after",
    name: "ต่อเนื่อง",
    description: flow.after.map((name) => stepLabel(name)).join(" → "),
    color: AFTER_COLOR,
  });

  const steps: WiStep[] = [];
  flow.lanes.forEach((lane, laneIndex) => {
    lane.forEach((name, stepIndex) => {
      steps.push({
        id: `${flow.id}-lane-${laneIndex + 1}-${stepIndex + 1}`,
        order: stepIndex + 1,
        categoryId: `lane-${laneIndex + 1}`,
        processName: stepLabel(name),
        actions: ["สายนี้ทำคู่ขนานกับสายอื่น จบสายตัวเองก่อนจึงไปขั้นตอนต่อเนื่อง"],
        department: "ฝ่ายผลิต",
        branchLabel: "ทำคู่ขนาน",
      });
    });
  });
  flow.after.forEach((name, stepIndex) => {
    steps.push({
      id: `${flow.id}-after-${stepIndex + 1}`,
      order: stepIndex + 1,
      categoryId: "after",
      processName: stepLabel(name),
      actions: ["ทำหลังจากทุกสายคู่ขนานเสร็จแล้ว"],
      department: "ฝ่ายผลิต",
    });
  });

  return {
    id: flow.id,
    title: `WI ${flow.label}`,
    productLine: flow.label,
    categories,
    steps,
  };
}

export const WORK_INSTRUCTIONS: WorkInstruction[] = [
  ...TRIAL_FLOWS.map(trialWorkInstruction),
  pvcRoomDividerWi,
];

export function getWorkInstruction(id: string): WorkInstruction | undefined {
  return WORK_INSTRUCTIONS.find((wi) => wi.id === id);
}

export type { WorkInstruction, WiStep, WiCategory } from "./types";
