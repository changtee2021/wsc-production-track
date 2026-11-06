import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectFreshJobCodes, freshJobCodes, intakeReviewNote, readJobCode } from "./intake-codes.ts";

describe("intake codes", () => {
  it("reads a job id from a link or a plain code", () => {
    assert.equal(readJobCode("SO2607360"), "SO2607360");
    assert.equal(readJobCode("https://example.test/scan?job_id=abc"), "abc");
  });

  it("drops duplicates inside one photo and codes already on the list", () => {
    const result = freshJobCodes(["A", "A", "B", "C"], new Set(["B"]));
    assert.deepEqual(result.fresh, ["A", "C"]);
    assert.equal(result.skipped, 2);
  });

  it("drops a code the line already has and keeps a failed lookup off the list", async () => {
    const result = await collectFreshJobCodes(["A", "B", "C"], new Set(), async (code) => {
      if (code === "B") return true;
      if (code === "C") throw new Error("down");
      return false;
    });
    assert.deepEqual(result.fresh, ["A"]);
    assert.equal(result.skipped, 1);
    assert.equal(result.failed, 1);
  });

  it("says a photo of only duplicates was skipped", () => {
    assert.equal(
      intakeReviewNote({ found: 2, fresh: 0, skipped: 2, failed: 0 }),
      "ข้าม 2 ใบที่สแกนแล้ว",
    );
    assert.equal(intakeReviewNote({ found: 0, fresh: 0, skipped: 0, failed: 0 }), "ไม่พบ QR ในรูปนี้");
  });
});
