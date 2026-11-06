import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productionPace } from "./production-pace.ts";

describe("production pace bands", () => {
  it("is green before normal, yellow through overtime, and red after", () => {
    assert.equal(productionPace(599, 600, 1200), "green");
    assert.equal(productionPace(600, 600, 1200), "yellow");
    assert.equal(productionPace(1200, 600, 1200), "yellow");
    assert.equal(productionPace(1201, 600, 1200), "red");
  });

  it("uses the overtime line alone when normal is missing", () => {
    assert.equal(productionPace(299, null, 300), "green");
    assert.equal(productionPace(300, null, 300), "yellow");
    assert.equal(productionPace(301, null, 300), "red");
    assert.equal(productionPace(100, null, null), null);
  });
});
