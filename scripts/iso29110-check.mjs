import { findPackIssues } from "../src/lib/iso29110/pack.ts";
import { ISO_ITEMS } from "../src/lib/iso29110/checklist.ts";

const issues = findPackIssues();
const ids = ISO_ITEMS.map((item) => item.id);
const dupes = ids.filter((id, index) => ids.indexOf(id) !== index);
if (dupes.length) issues.push(`รหัสเช็คลิสซ้ำ: ${dupes.join(", ")}`);

const counts = { have: 0, partial: 0, missing: 0 };
for (const item of ISO_ITEMS) counts[item.status] += 1;
if (counts.have + counts.partial + counts.missing !== ISO_ITEMS.length) {
  issues.push("ผลรวมสถานะไม่ครบ");
}
if (ISO_ITEMS.filter((item) => item.status === "missing").some((item) => item.id !== "SI.4.2")) {
  issues.push("มีข้อที่ยังไม่มีนอกจาก SI.4.2");
}
const unitTest = ISO_ITEMS.find((item) => item.id === "SI.4.2");
if (unitTest?.status !== "have") {
  issues.push("SI.4.2 ต้องเป็นมีแล้วเมื่อ npm test ครอบกฎสแกนและรายงาน");
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log(`iso29110 pack consistent ${ISO_ITEMS.length} items have=${counts.have} partial=${counts.partial} missing=${counts.missing}`);
