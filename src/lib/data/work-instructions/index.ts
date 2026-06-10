import type { WorkInstruction } from "./types";
import { pvcRoomDividerWi } from "./pvc-room-divider";

export const WORK_INSTRUCTIONS: WorkInstruction[] = [pvcRoomDividerWi];

export function getWorkInstruction(id: string): WorkInstruction | undefined {
  return WORK_INSTRUCTIONS.find((wi) => wi.id === id);
}

export type { WorkInstruction, WiStep, WiCategory } from "./types";
