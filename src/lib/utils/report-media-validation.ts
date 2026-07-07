export interface ReportItemState {
  is_passed: boolean | null;
  remark?: string;
  media: unknown[];
}

export function getReportSubmitBlockReason(
  checklist: { id: string }[],
  itemStates: Record<string, ReportItemState | undefined>,
): string | null {
  for (let idx = 0; idx < checklist.length; idx++) {
    const it = checklist[idx]!;
    const s = itemStates[it.id];
    if (s?.is_passed == null) {
      return `ข้อ ${idx + 1}: ยังไม่ได้เลือกผ่าน/ไม่ผ่าน`;
    }
    if (!s.media?.length) {
      return `ข้อ ${idx + 1}: ต้องแนบรูปหรือวิดีโออย่างน้อย 1 รายการ`;
    }
    if (s.is_passed === false && !s.remark?.trim()) {
      return `ข้อ ${idx + 1}: กรุณากรอกหมายเหตุเหตุผลที่ไม่ผ่าน`;
    }
  }
  return null;
}

/** Server-side: throws if report items fail media/remark rules. */
export function assertReportItemsValid(
  items: { is_passed: boolean; remark?: string | null; media: unknown[] }[],
): void {
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx]!;
    if (!it.media?.length) {
      throw new Error(`ข้อ ${idx + 1}: ต้องแนบรูปหรือวิดีโออย่างน้อย 1 รายการ`);
    }
    if (it.is_passed === false && !it.remark?.trim()) {
      throw new Error(`ข้อ ${idx + 1}: กรุณากรอกหมายเหตุเหตุผลที่ไม่ผ่าน`);
    }
  }
}
