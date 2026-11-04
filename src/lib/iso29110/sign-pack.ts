export type ApproveSheet = {
  id: string;
  who: string;
  meaning: string;
  checks: string[];
  stillOpen: string[];
};

export const APPROVE_SHEETS: ApproveSheet[] = [
  {
    id: "head",
    who: "หัวหน้าฝ่ายผลิต",
    meaning: "ติ๊กแล้วเซ็นแปลว่ารับว่าเมนูตรงงานจริง และรับไปดูแลการใช้งาน",
    checks: [
      "หลังบ้านแอดมินเข้าได้เมื่อมีรหัส",
      "ดูภาพรวม ค้นหางาน และคิวผลิตได้",
      "มีทางสแกนงาน และหน้าทดลองให้ออฟฟิศส่งงานเข้าไลน์",
      "บันทึก QC และแพ็คของได้",
      "ซ่อม สต๊อกออฟฟิศ นับสต๊อก และค่าใช้จ่ายอยู่ในเมนู",
      "คลังวิธีทำงาน และหน้าพนักงานใช้ได้",
      "พนักงานแจ้งปัญหาที่เมนูความคิดเห็นได้",
      "หลังรับมอบ หัวหน้าดูแลการใช้งาน ฟรีแลนซ์เป็นคนแก้ระบบ",
      "CR-01 ยอมรับงานสแกนทดลองที่รวมเข้าระบบวันที่ 3 พ.ย. 2026",
      "CR-02 ยอมรับบันทึกอบรม WI และคู่มือตามโฟลว์ในชุดเดียวกัน",
    ],
    stillOpen: [
      "ติ๊กใบนี้ไม่ได้แปลว่าเทสบนพื้นโรงงานรันแล้ว",
      "ติ๊กใบนี้ไม่ได้แปลว่ามีใบสำรองข้อมูลแล้ว",
    ],
  },
  {
    id: "ceo",
    who: "CEO",
    meaning: "ติ๊กแล้วเซ็นแปลว่ารับขอบเขตระดับองค์กร",
    checks: [
      "ระบบนี้ทำให้ฝ่ายผลิตของ WSC ใช้เอง ไม่ได้ขายให้คนนอก",
      "CEO เป็นผู้สั่ง หัวหน้าฝ่ายผลิตเป็นผู้รับไปดูแล",
      "พนักงานผลิตเป็นผู้ใช้ ไม่ต้องเซ็นรับมอบ",
      "ของที่ส่งคือเว็บ https://wsc-production-track.vercel.app",
      "คลังสินค้าที่ซ่อนเมนูไว้อยู่นอกชุดนี้",
    ],
    stillOpen: ["ชั่วโมงทำงานยังไม่มีตัวเลข ใบนี้ไม่ได้รับรองจำนวนชั่วโมง"],
  },
  {
    id: "both",
    who: "CEO และหัวหน้าฝ่ายผลิต",
    meaning: "เซ็นคู่กันแปลว่ารับมอบระบบที่ฝ่ายผลิตใช้อยู่ โดยรู้ว่ายังมีรายการค้าง",
    checks: [
      "ระบบที่ https://wsc-production-track.vercel.app คือระบบที่ฝ่ายผลิตใช้",
      "เอกสารรุ่น 1.0 วันที่ 3 พฤศจิกายน 2026 คือชุดที่ให้อ่านก่อนเซ็น",
    ],
    stillOpen: [
      "ยังไม่รันสแกน QC และแพ็คบนพื้นโรงงาน",
      "ยังไม่มีใบสำรองรายครั้งและยังไม่ซ้อมกู้คืน",
      "ยังไม่มีรหัส commit ของเอกสารรุ่น 1.0",
      "เทสชิ้นส่วนมีแล้ว 16 ข้อ ยังไม่ทดสอบการเขียนลงฐานข้อมูล",
    ],
  },
];

export const CONSULTANT_DONE = [
  "จัดชุดเอกสารรุ่น 1.0 ในเมนู ISO 29110",
  "รัน npm test ผ่าน 16 ข้อ สำหรับกฎสแกน และกฎส่งรายงาน QC กับแพ็ค",
  "เปิดใบ CR-01 และ CR-02 ให้ติ๊ก ยังไม่ติ๊กแทนหัวหน้า",
  "เขียนรายงานตรวจ IA-29110-2026-1103 โดยไม่ปิดช่องที่ยังว่าง",
];

export const CONSULTANT_LEFT = [
  "กรอกชั่วโมงเมื่อมีบันทึกจริง",
  "รันสำรองข้อมูลแล้วซ้อมกู้คืน แล้วจดวันที่",
  "ผูกเอกสารรุ่น 1.0 กับ commit เมื่อได้รับคำสั่งให้ขึ้นคลัง",
  "ให้พนักงานรันสแกน QC และแพ็คบนพื้นโรงงาน แล้วจดผลตามจริง",
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildSignPackHtml(): string {
  const sheets = APPROVE_SHEETS.map(
    (sheet) => `<section class="sheet">
      <p class="kicker">WSC Production Track · ใบอนุมัติรุ่น 1.0 · 3 พฤศจิกายน 2026</p>
      <h1>${escapeHtml(sheet.who)}</h1>
      <p class="meaning">${escapeHtml(sheet.meaning)}</p>
      <ul>${sheet.checks.map((item) => `<li><span class="box"></span>${escapeHtml(item)}</li>`).join("")}</ul>
      <div class="open"><strong>เซ็นใบนี้แล้วยังไม่ปิด</strong><ul>${sheet.stillOpen.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="sign"><span>ชื่อ ____________________</span><span>วันที่ ______________</span><span>ลายเซ็น ____________________</span></div>
    </section>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>WSC ISO 29110 ใบอนุมัติ 1.0</title>
  <style>
    body { font-family: "Segoe UI", Tahoma, sans-serif; color: #1c1917; margin: 24px; }
    .sheet { break-after: page; page-break-after: always; max-width: 720px; }
    .kicker { font-size: 12px; letter-spacing: 0.04em; color: #57534e; }
    h1 { font-size: 28px; margin: 8px 0; }
    .meaning { font-size: 16px; }
    ul { padding-left: 0; list-style: none; }
    li { display: flex; gap: 10px; align-items: flex-start; margin: 8px 0; line-height: 1.45; }
    .box { width: 18px; height: 18px; border: 2px solid #1c1917; flex: 0 0 auto; margin-top: 2px; }
    .open { background: #fef3c7; padding: 12px 16px; border-radius: 12px; }
    .sign { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 28px; font-size: 16px; }
  </style>
</head>
<body>
${sheets}
</body>
</html>`;
}
