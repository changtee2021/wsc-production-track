import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { floorScanLaneDecision, homeScanTarget } from "./sequential-scan.ts";

describe("sequential scan switch", () => {
  it("sends production to the original scan and keeps QC and packing on their own pages", () => {
    assert.equal(homeScanTarget("production", false).to, "/scan");
    assert.equal(homeScanTarget("qc", false).to, "/qc");
    assert.equal(homeScanTarget("packing", false).to, "/packing");
  });

  it("sends an office badge to line intake even while step order is off", () => {
    assert.equal(homeScanTarget("office", false).to, "/scan-trial");
    assert.equal(homeScanTarget("office", false).search.desk, "office");
    assert.equal(homeScanTarget("production", false, true).to, "/scan-trial");
  });

  it("sends every badge back to step order when the switch is on", () => {
    assert.equal(homeScanTarget("production", true).to, "/scan-trial");
    assert.equal(homeScanTarget("qc", true).to, "/scan-trial");
    assert.equal(homeScanTarget("packing", true).to, "/scan-trial");
  });

  it("lets a released job use the original scan while step order is off", () => {
    assert.equal(floorScanLaneDecision("v1", true, false), "open");
    assert.equal(floorScanLaneDecision("v2", true, false), "blocked");
  });

  it("locks a released job to step order when the switch is on", () => {
    assert.equal(floorScanLaneDecision("v1", true, true), "blocked");
    assert.equal(floorScanLaneDecision("v2", true, true), "open");
  });
});
