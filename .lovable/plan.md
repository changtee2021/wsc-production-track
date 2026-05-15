## ปรับหน้าสแกน (`src/routes/scan.tsx`)

### 1. ล็อกปุ่ม "เริ่มงาน" หลังกดแล้ว
- เพิ่ม state `activeStart: { at: number } | null` (เก็บใน `localStorage` ผูกกับ `job_id + employee_id + step_id` เพื่อกันรีเฟรชแล้วหลุด)
- เมื่อกด "เริ่มงาน" สำเร็จ → set `activeStart` พร้อม timestamp
- ปุ่ม "เริ่มงาน" `disabled` เมื่อ `activeStart` ไม่เป็น null
- เมื่อกด "เสร็จงาน" สำเร็จ → เคลียร์ `activeStart` (กดเริ่มใหม่ได้)
- เปลี่ยน step / employee / job → เคลียร์ state เริ่มงานเดิมด้วย

### 2. เปลี่ยนไอคอนปุ่มยืนยันรหัสงาน (ปุ่ม `RotateCcw` ข้าง input job_id)
- เปลี่ยนจาก `RotateCcw` → `Check` (ติ๊กถูก) สำหรับเคสยืนยัน
- เคสรีเซ็ตเมื่อมี `job_id` แล้ว → คงไว้เป็น `RotateCcw` (เพราะคือล้างค่า)
- หมายเหตุ: ตามภาพที่ส่งมา ปุ่มที่ user หมายถึงคือปุ่มยืนยัน (ตอนยังไม่มี job_id) → ใช้ `Check`

### 3. นาฬิกาจับเวลาเมื่อเริ่มงาน
- หลังกดเริ่ม → แสดง card นาฬิกาด้านบนปุ่ม "เสร็จงาน"
- ใช้ `useEffect` + `setInterval(1000)` คำนวณเวลาที่ผ่านไปจาก `activeStart.at`
- แสดงรูปแบบ `mm:ss`
- สีเขียว (`text-success`) เมื่อ `elapsed < std_duration_minutes * 60`
- สีแดง (`text-destructive`) เมื่อเลยกำหนด พร้อมไอคอน `AlertTriangle`
- ถ้า step ไม่มี `std_duration_minutes` → แสดงเป็นสีเขียวตลอด

### Technical
- Persist key: `wsc:active-start:{job_id}:{step_id}:{employee_id}` เพื่อไม่ให้ล็อกข้ามงาน/ข้ามคน
- Interval cleanup ใน `useEffect` return
- ไอคอนใหม่ที่ต้อง import: `Check`, `Timer` (หรือใช้ `Clock` ที่มีอยู่แล้ว)

ไม่แตะ business logic / DB schema — เป็นการปรับ UI/UX อย่างเดียว
