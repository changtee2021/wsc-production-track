## เป้าหมาย
ปรับปุ่ม "สรุป Excel" ให้เปิด dialog ตั้งค่าก่อน export ผู้ใช้เลือกได้ว่าจะเอาข้อมูลส่วนไหน, กรองพนักงานคนไหน/หลายคน, ขั้นตอนไหน/หลายขั้นตอน, หมวดหมู่ และระบุช่วงเวลาเอง (from–to)

## UI ใหม่ (Dialog "ตั้งค่าการส่งออก")

เปิดด้วยปุ่ม `สรุป Excel` (แทนการ export ทันที) ภายใน dialog มี:

1. **ช่วงเวลา** — radio 3 แบบ
   - ใช้ช่วงปัจจุบันบนหน้า Dashboard (วัน/เดือนที่เลือกอยู่)
   - ระบุช่วงเอง: input `เริ่ม` และ `สิ้นสุด` (date)
   - ทั้งหมด (ไม่จำกัดช่วง)

2. **พนักงาน** — multi-select (checkbox list + ปุ่ม เลือกทั้งหมด/ล้าง)

3. **ขั้นตอน** — multi-select แบบเดียวกัน

4. **หมวดหมู่** — multi-select แบบเดียวกัน

5. **ชีตที่ต้องการ** — checkbox list (ติ๊กเลือกได้)
   - Info (เปิดไว้เสมอ)
   - Ranking
   - MoM
   - Sessions
   - Over_Standard
   - By_Step
   - By_Category
   - Logs (raw)

ปุ่มท้าย dialog: `ยกเลิก` / `ส่งออก Excel`

## Logic ที่จะแก้ใน `src/routes/_protected.dashboard.tsx`

- เพิ่ม state: `exportOpen`, `exportRange` (`current` | `custom` | `all`), `exportFrom`, `exportTo`, `exportEmpIds: Set<string>`, `exportStepIds: Set<string>`, `exportCatIds: Set<string>`, `exportSheets: Set<string>`
- ค่า default: range = current, multi-select = ทั้งหมด, sheets = ทุกชีต
- รีแฟกเตอร์ `exportSummaryXLSX` ให้รับ "scope config" แทนการอ่าน state ตรงๆ:
  - กรอง `logs` ตามช่วงเวลา + พนักงาน + ขั้นตอน + หมวดหมู่ ที่เลือกใน dialog (ไม่ผูกกับฟิลเตอร์บนหน้า dashboard)
  - คำนวณ sessions, ranking, MoM, by-step, by-category ใหม่จาก subset นั้น
  - เพิ่มชีต **Logs** (raw): job_id, employee, category, step, action, created_at
  - สร้างเฉพาะชีตที่ผู้ใช้ติ๊ก
  - Info sheet สรุปเงื่อนไขที่เลือกทั้งหมด
- MoM ในโหมด custom range: เปรียบเทียบ "ช่วงที่เลือก" vs "ช่วงก่อนหน้าเท่ากัน" (ไม่ใช่เดือนปัจจุบัน vs เดือนก่อน) เพื่อให้ตรงกับ scope ที่ผู้ใช้กำหนด

## ไฟล์ที่แก้
- `src/routes/_protected.dashboard.tsx` (ไฟล์เดียว) — เพิ่ม dialog + รีแฟกเตอร์ฟังก์ชัน export

## ไม่กระทบ
- ไม่แตะ schema/RLS/edge function
- ฟิลเตอร์/กราฟบนหน้า Dashboard ทำงานเหมือนเดิม dialog เป็นอิสระจากฟิลเตอร์หน้าจอ
