import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepsForCategory } from "./production-flow-steps.ts";

const STEPS = [
  "เก็บสี အရောင်စိုး",
  "เจาะถ่วงล่าง ကျောထွန်လန်း",
  "เจาะใบ ကျောဘန်",
  "เจาะราง ကျောလန်",
  "ตั้งงาน သန်းငန်",
  "ตัดเทปผ้า ပိတ်အပိုင်းအစဖြတ်ခြင်း",
  "ตัดใบมู่ลี่ไม้ ဖြတ်မူလိမန်း",
  "ตัดผ้า ပိတ်ဖြတ်ခြင်း",
  "ตัดราง သံလကိုဖြတ်ပါ။",
  "ตัดอลูมิเนียม အလူမီနီယမ်ဖြတ်ခြင်း",
  "เตรียมโซ่ ကြိုးပြင်ဆင်ခြင်း",
  "บังราง ဘန်လန်",
  "ประกอบใบม่านปรับแสง အလင်းရောင်ညှိကုလာကာတပ်ဆင်ခြင်း",
  "ประกอบม่านม้วน ကုลาကာတပ်ဆင်ခြင်း",
  "ประกอบมู่ลี่ไม้ ပကော်မူလီးမန်း",
  "ประกอบราง ပကော်လန်",
  "ประกอบอลูมิเนียม ပကော်အလူမီနင်",
  "เย็บเทปผ้า",
].map((step_name) => ({ step_name }));

function heads(category: string): string[] {
  return stepsForCategory(category, STEPS).map((step) => step.step_name.split(" ")[0]);
}

describe("steps for a product category", () => {
  it("keeps roller assembly off the wood flow", () => {
    const wood = heads("3.มู่ลี่ไม้ သစ်သားကာတင်");
    assert.equal(wood.includes("ประกอบมู่ลี่ไม้"), true);
    assert.equal(wood.includes("ประกอบม่านม้วน"), false);
    assert.equal(wood.includes("ประกอบอลูมิเนียม"), false);
    assert.equal(wood.includes("ตัดผ้า"), false);
  });

  it("keeps each product's own assembly step", () => {
    assert.deepEqual(heads("1.ม่านปรับแสง အလင်းရောင်ညှိကုလာကာတပ်ဆင်ခြင်း"), [
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
    ]);
    assert.ok(heads("2.ม่านม้วน ကုလားကာ").includes("ประกอบม่านม้วน"));
    assert.equal(heads("2.ม่านม้วน ကုလားကာ").includes("เก็บสี"), false);
    assert.ok(heads("4.มู่ลี่อลูมิเนียม อလူမီနီယံကုလားကာ").includes("ตัดอลูมิเนียม"));
    assert.equal(
      heads("4.มู่ลี่อลูมิเนียม အလူမီနီယံကုလားကာ").includes("ตัดใบมู่ลี่ไม้"),
      false,
    );
  });
});
