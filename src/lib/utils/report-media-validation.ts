export interface ReportItemState {
  is_passed: boolean | null;
  remark?: string;
  media?: unknown[];
}

export function getReportSubmitBlockReason(
  checklist: { id: string }[],
  itemStates: Record<string, ReportItemState | undefined>,
  overallMediaCount: number,
): string | null {
  for (let idx = 0; idx < checklist.length; idx++) {
    const it = checklist[idx]!;
    const s = itemStates[it.id];
    if (s?.is_passed == null) {
      return `ข้อ ${idx + 1}: ยังไม่ได้เลือกผ่าน/ไม่ผ่าน`;
    }
    if (s.is_passed === false && !s.remark?.trim()) {
      return `ข้อ ${idx + 1}: กรุณากรอกหมายเหตุเหตุผลที่ไม่ผ่าน`;
    }
  }
  if (overallMediaCount < 1) {
    return "ต้องแนบรูปหรือวิดีโอในหลักฐานรวมอย่างน้อย 1 รายการ";
  }
  return null;
}

/** Server-side: throws if overall media or failed-item remarks are missing. */
export function assertReportSubmitValid(
  items: { is_passed: boolean; remark?: string | null }[],
  overallMedia: unknown[],
): void {
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx]!;
    if (it.is_passed === false && !it.remark?.trim()) {
      throw new Error(`ข้อ ${idx + 1}: กรุณากรอกหมายเหตุเหตุผลที่ไม่ผ่าน`);
    }
  }
  if (!overallMedia?.length) {
    throw new Error("ต้องแนบรูปหรือวิดีโอในหลักฐานรวมอย่างน้อย 1 รายการ");
  }
}
