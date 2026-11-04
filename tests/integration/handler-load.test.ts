import assert from "node:assert/strict";
import { describe, it } from "node:test";

const handlers = [
  "../../src/routes/api/public/production-intake.ts",
  "../../src/lib/features/scan.functions.ts",
  "../../src/lib/features/qc.functions.ts",
  "../../src/lib/features/packing.functions.ts",
];

describe("handler modules stay unloaded in this test runner", () => {
  for (const path of handlers) {
    it(`does not import ${path}`, async () => {
      await assert.rejects(import(path), /Cannot find package '@\//);
    });
  }
});
