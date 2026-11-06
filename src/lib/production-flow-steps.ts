// Which shop-floor steps belong on each product flow.
// The standards screen used to list every step under every category.
// Names are the Thai head of rows in `steps` (Burmese may follow).
import { flowForProductName, type TrialFlowId } from "./scan-trial.ts";

const FLOW_STEP_PREFIXES: Record<TrialFlowId, readonly string[]> = {
  shade: [
    "ตั้งงาน",
    "ตัดผ้า",
    "ตัดเทปผ้า",
    "เย็บเทปผ้า",
    "ประกอบใบม่านปรับแสง",
    "ตัดราง",
    "เจาะถ่วงล่าง",
    "ประกอบราง",
    "บังราง",
    "เตรียมโซ่",
  ],
  roller: [
    "ตั้งงาน",
    "ตัดผ้า",
    "ตัดเทปผ้า",
    "เย็บเทปผ้า",
    "ตัดราง",
    "เจาะถ่วงล่าง",
    "ประกอบราง",
    "บังราง",
    "เตรียมโซ่",
    "ประกอบม่านม้วน",
  ],
  wood: [
    "ตั้งงาน",
    "ตัดใบมู่ลี่ไม้",
    "เก็บสี",
    "เจาะใบ",
    "เจาะถ่วงล่าง",
    "ตัดเทปผ้า",
    "เตรียมโซ่",
    "ตัดราง",
    "เจาะราง",
    "ประกอบราง",
    "บังราง",
    "ประกอบมู่ลี่ไม้",
  ],
  aluminum: [
    "ตั้งงาน",
    "ตัดอลูมิเนียม",
    "เจาะถ่วงล่าง",
    "ตัดราง",
    "ประกอบราง",
    "บังราง",
    "เตรียมโซ่",
    "ประกอบอลูมิเนียม",
  ],
};

export function thaiStepHead(stepName: string): string {
  const head = stepName.match(/^[\u0E00-\u0E7F0-9/().\s-]+/)?.[0] ?? stepName;
  return head.trim();
}

function prefixIndex(stepName: string, flowId: TrialFlowId): number {
  const head = thaiStepHead(stepName);
  const prefixes = [...FLOW_STEP_PREFIXES[flowId]].sort((a, b) => b.length - a.length);
  const hit = prefixes.find((prefix) => head === prefix || head.startsWith(prefix));
  if (!hit) return -1;
  return FLOW_STEP_PREFIXES[flowId].indexOf(hit);
}

export function stepsForCategory<T extends { step_name: string }>(
  categoryName: string,
  steps: T[],
): T[] {
  const flow = flowForProductName(categoryName);
  if (!flow) return steps;
  return steps
    .filter((step) => prefixIndex(step.step_name, flow.id) >= 0)
    .sort(
      (a, b) =>
        prefixIndex(a.step_name, flow.id) - prefixIndex(b.step_name, flow.id) ||
        a.step_name.localeCompare(b.step_name, "th"),
    );
}
