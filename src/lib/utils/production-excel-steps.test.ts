import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LINE_RELEASE_STEP_NAME,
  compareExcelSteps,
  lineReleaseStep,
  trialRunStep,
} from "./production-excel-steps.ts";

describe("production excel line release", () => {
  it("keeps the office send ahead of a floor step at the same time", () => {
    const send = lineReleaseStep("เนย", "2026-11-04T10:00:00.000Z");
    const cut = trialRunStep(
      {
        step: "เบิกไม้",
        employee_name: "สมชาย",
        started_at: "2026-11-04T10:00:00.000Z",
        finished_at: "2026-11-04T10:20:00.000Z",
      },
      null,
    );
    const ordered = [cut, send].sort(compareExcelSteps);
    assert.equal(send.step_name, LINE_RELEASE_STEP_NAME);
    assert.equal(send.employee_name, "เนย");
    assert.equal(send.started_at, send.finished_at);
    assert.equal(ordered[0]?.step_name, LINE_RELEASE_STEP_NAME);
    assert.equal(ordered[1]?.step_name, "เบิกไม้");
    assert.equal(ordered[1]?.actual_seconds, 1200);
  });
});
