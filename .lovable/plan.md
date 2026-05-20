## 1) หน้า "รายละเอียดบันทึกการผลิต" (`/logs`)

**ปัญหาที่พบ**
- ใน `src/routes/_protected.logs.tsx` (บรรทัด 122-123) ใช้ `dateFrom.setHours(0,0,0,0)` และ `dateTo.setHours(23,59,59,999)` ซึ่ง **mutate ตัว Date ที่เก็บใน state ตรง ๆ** → ทำให้ Calendar เลือกผิดวัน / กรองได้ผลแปลก ๆ บางครั้งกรองจน "ไม่มีข้อมูล" แม้เลือกช่วงถูกต้อง
- ตอนนี้กรองแบบ live ทุกครั้งที่เลือกวัน → ระหว่างเลือก from ก่อน to เสร็จก็เกิดเงื่อนไข from > to ชั่วคราว, ทำให้รู้สึกว่า "เลือกช่วงแล้วไม่ขึ้นข้อมูล"

**สิ่งที่จะทำ**
- เปลี่ยนการ normalize เวลาเป็นแบบ immutable: สร้าง `new Date(dateFrom)` ใหม่ก่อน `setHours` (ไม่แก้ตัวใน state)
- เพิ่ม state คู่ "applied" `appliedFrom` / `appliedTo` แยกจากที่ผู้ใช้กำลังเลือก
- เพิ่มปุ่ม **"ค้นหา"** (icon Search) ในแถวช่วงวันที่ — กดแล้วถึงจะ apply ค่า from/to เข้ากับ filter
- ปุ่ม **"ล้าง"** เคลียร์ทั้งค่าเลือกและค่า applied
- ปุ่มลัด (วันนี้ / 7 วัน / 30 วัน) ให้ apply ทันที (set ทั้ง pending และ applied พร้อมกัน เพื่อพฤติกรรมเดิม)
- ใช้ `appliedFrom` / `appliedTo` ใน `useMemo filtered`

ไฟล์ที่แก้: `src/routes/_protected.logs.tsx`

---

## 2) หน้า "รายงาน QC" (`/qc-reports`) — ทำการ์ดให้หุบ/กางได้

**สิ่งที่จะทำ**
- ครอบทั้ง `<article>` ของแต่ละรายงานด้วย `Accordion` (`type="single"` + `collapsible`, **default หุบ**)
- ส่วน **AccordionTrigger** (โหมดหุบ) แสดงเฉพาะ:
  - วันเวลา (`created_at`)
  - `Job <job_id>` (ตัวหนา)
  - ชื่อผู้ตรวจ QC (`qc_employees.name` + `emp_code`)
  - Badge สถานะ "✓ ผ่าน" / "✗ ไม่ผ่าน" (จาก `overall_result`)
- ส่วน **AccordionContent** เก็บเนื้อหาเดิมทั้งหมด: checklist items (pass/fail พร้อมสื่อ), accordion "พนักงานที่ทำใน Job นี้", หมายเหตุภาพรวม, สื่อภาพรวม, ปุ่มแก้ไข/ลบ
- คงพฤติกรรม auto-open ของ failed item ไว้ (อยู่ในเนื้อหาด้านในอยู่แล้ว — เมื่อกางการ์ดถึงจะมีผล)

ไฟล์ที่แก้: `src/routes/_protected.qc-reports.tsx` (ช่วงบรรทัด 280-525)

---

## 3) บันทึก `system_logs`
INSERT 1 แถว — `category: bugfix`, สรุป "แก้บั๊กกรองช่วงวันที่ในประวัติงาน + เพิ่มปุ่มค้นหา และทำการ์ดรายงาน QC ให้หุบได้"

## ไฟล์ที่เปลี่ยน
- `src/routes/_protected.logs.tsx`
- `src/routes/_protected.qc-reports.tsx`
- `system_logs` INSERT
