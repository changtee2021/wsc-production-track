import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertReportSubmitValid,
  checklistOverall,
  getReportSubmitBlockReason,
} from "./report-media-validation.ts";

const checklist = [{ id: "a" }, { id: "b" }];

describe("QC and packing report rules", () => {
  it("blocks a report until every item is answered", () => {
    const reason = getReportSubmitBlockReason(checklist, { a: { is_passed: true } }, 1);
    assert.equal(reason, "ข้อ 2: ยังไม่ได้เลือกผ่าน/ไม่ผ่าน");
  });

  it("blocks a failed item that has no remark", () => {
    const reason = getReportSubmitBlockReason(
      checklist,
      { a: { is_passed: false, remark: "  " }, b: { is_passed: true } },
      1,
    );
    assert.equal(reason, "ข้อ 1: กรุณากรอกหมายเหตุเหตุผลที่ไม่ผ่าน");
  });

  it("blocks a report with no overall photo or video", () => {
    const reason = getReportSubmitBlockReason(
      checklist,
      { a: { is_passed: true }, b: { is_passed: true } },
      0,
    );
    assert.equal(reason, "ต้องแนบรูปหรือวิดีโอในหลักฐานรวมอย่างน้อย 1 รายการ");
  });

  it("accepts a complete report", () => {
    const reason = getReportSubmitBlockReason(
      checklist,
      { a: { is_passed: false, remark: "รางเบี้ยว" }, b: { is_passed: true } },
      1,
    );
    assert.equal(reason, null);
  });

  it("rejects the same gaps on the server check", () => {
    assert.throws(
      () => assertReportSubmitValid([{ is_passed: false, remark: "" }], [{ url: "x" }]),
      /ข้อ 1/,
    );
    assert.throws(() => assertReportSubmitValid([{ is_passed: true }], []), /หลักฐานรวม/);
  });

  it("scores all-pass, mixed, and empty checklists", () => {
    assert.deepEqual(checklistOverall([{ is_passed: true }, { is_passed: true }]), {
      overall: "pass",
      summary: "ผ่าน 2/2 ข้อ",
    });
    assert.deepEqual(checklistOverall([{ is_passed: true }, { is_passed: false }]), {
      overall: "fail",
      summary: "ผ่าน 1/2 ข้อ",
    });
    assert.deepEqual(checklistOverall([]), { overall: null, summary: null });
  });

  it("keeps an explicit overall result from the form", () => {
    assert.equal(checklistOverall([{ is_passed: false }], "pass").overall, "pass");
  });
});
