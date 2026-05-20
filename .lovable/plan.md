## เป้าหมาย
เพิ่มปุ่มที่ 3 "มอเตอร์" ถัดจากปุ่ม "ไม่ผ่าน" ในแต่ละข้อของเช็คลิสต์ QC
- กดแล้วถือว่า **ผ่าน** (is_passed = true) → นับรวมกับยอด "ผ่าน" ปกติ
- แต่จะมีป้ายกำกับ **"มอเตอร์"** แสดงในรายงาน/CSV เพื่อแยกประเภท
- ปุ่ม "ผ่าน" และ "ไม่ผ่าน" ทำงานเหมือนเดิมทุกอย่าง

---

## 1) เพิ่มคอลัมน์ใน `qc_report_items` (migration)
เพิ่มคอลัมน์ `result_tag text` (nullable) — เก็บค่า `'motor'` เมื่อกดปุ่มมอเตอร์, null สำหรับผ่าน/ไม่ผ่านปกติ
ออกแบบให้ขยายในอนาคตได้ (เช่นเพิ่ม tag อื่นๆ ภายหลัง)

## 2) หน้า QC — `src/routes/qc.tsx`
- ขยาย type `ItemState`: เพิ่ม `tag: "motor" | null`
- เพิ่ม handler `setItemTag(id, "motor")` — ตั้ง `is_passed = true` + `tag = "motor"` พร้อมกัน (และเคลียร์ remark ถ้าจำเป็น)
- ในส่วน checklist UI (รอบ ๆ บรรทัด 912–923):
  - เพิ่มปุ่มที่ 3 หลังปุ่ม "ไม่ผ่าน" — สีเหลือง/ส้ม (variant แยก) ไอคอน `Wrench` หรือ `Cog` พร้อมข้อความ **"มอเตอร์"**
  - เมื่อ active: แสดง state ปุ่มถูกเลือกเหมือนปุ่มอื่น และโชว์ badge เล็ก "มอเตอร์" ใต้ข้อ
  - กดปุ่ม "ผ่าน" หรือ "ไม่ผ่าน" → เคลียร์ tag กลับเป็น null
- ปรับ counter "ตรวจแล้ว x/y" + สรุปด้านล่าง: ยอด **ผ่าน** = ผ่านปกติ + มอเตอร์ (โชว์เพิ่ม "(มอเตอร์ N)" ในวงเล็บ)
- ปรับ payload ส่ง `qcSubmitReport`: ใส่ `tag` ของแต่ละ item
- ไม่ต้องบังคับ remark สำหรับมอเตอร์ (เพราะถือว่าผ่าน)

## 3) Server function — `src/lib/qc.functions.ts`
- เพิ่ม `tag: z.enum(["motor"]).nullable().optional()` ใน `reportItemInput` (zod)
- ใน insert mapping → ใส่ `result_tag: it.tag ?? null`

## 4) หน้ารายงาน — `src/routes/_protected.qc-reports.tsx`
- เพิ่ม `result_tag` ใน select query และ type `QcReportItem`
- ใน UI checklist (~บรรทัด 348–365):
  - ถ้า `result_tag === 'motor'` → แสดงป้าย/สีพิเศษ (เช่น badge สีส้ม "มอเตอร์") แทนเครื่องหมาย ✓ ปกติ
  - ยังคง `is_passed === true` (นับเป็นผ่านในสถิติ)

## 5) Quick Look — `src/routes/_protected.job-lookup.tsx` + `src/lib/admin.functions.ts`
- เพิ่ม `result_tag` ใน query ของ `adminFetchJobDetail` (qc_report_items)
- โชว์ป้าย "มอเตอร์" ในส่วนรายงาน QC เช่นเดียวกัน

## 6) CSV Export — `src/lib/qc-export.ts`
- เพิ่ม field `result_tag` ใน type + HEADERS
- คอลัมน์ใหม่ `item_tag` → เขียนค่า "มอเตอร์" หรือว่าง
- หรือเปลี่ยน `item_result` ให้แสดง "ผ่าน (มอเตอร์)" เมื่อเป็น motor

## 7) สรุป QC — `src/routes/_protected.qc-summary.tsx` (ถ้ามีกราฟ)
- ไม่แก้ logic ผ่าน/ไม่ผ่าน (มอเตอร์ยังนับเป็นผ่าน) แต่อาจเพิ่ม metric "มอเตอร์" แยกถ้ามีพื้นที่ — รอ confirm

## 8) บันทึก `system_logs`
INSERT 1 แถว: category `feature` — "เพิ่มปุ่มมอเตอร์ในเช็คลิสต์ QC (นับเป็นผ่าน + ติดป้ายมอเตอร์)"

---

## ไฟล์ที่จะเปลี่ยน
- Migration: `qc_report_items.result_tag`
- `src/routes/qc.tsx` (UI ปุ่ม + state + payload)
- `src/lib/qc.functions.ts` (zod + insert)
- `src/routes/_protected.qc-reports.tsx` (แสดงป้าย)
- `src/routes/_protected.job-lookup.tsx` + `src/lib/admin.functions.ts` (query + แสดงป้าย)
- `src/lib/qc-export.ts` (CSV column)
- `system_logs` INSERT

---

## คำถามก่อนเริ่ม
1. ป้าย "มอเตอร์" ให้ใช้สีอะไร? (แนะนำสีส้ม/เหลืองอำพันเพื่อแยกจาก เขียว=ผ่าน, แดง=ไม่ผ่าน)
2. ในสถิติสรุป (passCount) → นับมอเตอร์รวมในผ่านเลย แล้วโชว์ "(มอเตอร์ N)" ในวงเล็บ ใช่ไหม?
