import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPackingReportsCsv } from "./packing-export.ts";
import { buildQcReportsCsv } from "./qc-export.ts";

const base = {
  id: "r1",
  job_id: "JOB-1",
  created_at: "2026-11-03T00:00:00.000Z",
  note: null,
  summary: "ผ่าน 1/1 ข้อ",
  employees: null,
  steps: null,
  categories: { name: "ม่านม้วน" },
};

describe("QC and packing report export", () => {
  it("writes a QC pass and a motor pass", () => {
    const csv = buildQcReportsCsv([
      {
        ...base,
        overall_result: "pass",
        qc_employees: { name: "QC", emp_code: null },
        qc_report_items: [
          {
            item_order: 1,
            item_text_snapshot: "ราง",
            is_passed: true,
            result_tag: "motor",
            remark: null,
            media: [],
          },
        ],
      },
    ]);
    assert.match(csv, /ผ่าน \(มอเตอร์\)/);
    assert.match(csv, /JOB-1/);
  });

  it("writes a packing fail", () => {
    const csv = buildPackingReportsCsv([
      {
        ...base,
        overall_result: "fail",
        packing_employees: { name: "แพ็ค", emp_code: null },
        packing_report_items: [
          {
            item_order: 1,
            item_text_snapshot: "กล่อง",
            is_passed: false,
            remark: "ขาดเทป",
            media: [],
          },
        ],
      },
    ]);
    assert.match(csv, /ไม่ผ่าน/);
    assert.match(csv, /ขาดเทป/);
  });
});
