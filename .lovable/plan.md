## ปัญหาที่พบ

1. **ปุ่มเยอะเกินไป** — มี `CSV ทั้งหมด`, `สรุป CSV`, `สรุป Excel` ผู้ใช้อยากเหลือแค่ Excel
2. **ข้อมูลไม่ครบใน Excel** — สาเหตุหลักคือ:
   - หน้า Dashboard ดึง `production_logs` แค่ `.limit(1000)` แต่ในฐานข้อมูลมี **6,679 records** → log เก่าๆ หายไปทั้งหมด ทำให้ ranking, MoM, over-standard ขาดข้อมูล
   - `Ranking` sheet นับเฉพาะพนักงานที่มี action `finish` ในช่วงที่เลือก พนักงานที่ทำงานแต่ยังไม่กด finish หรือไม่ได้ทำงานในช่วงนั้น → หายไปจากรายงาน
   - Excel ไม่มี sheet log ดิบสำหรับตรวจสอบ

## สิ่งที่จะทำ

### 1. ลบปุ่ม CSV ออก (`src/routes/_protected.dashboard.tsx`)
- ลบปุ่ม `CSV ทั้งหมด` และ `สรุป CSV` ออกจาก toolbar
- ลบฟังก์ชัน `exportFullCSV()` และ `exportSummaryCSV()`
- ลบ import `Download`, `downloadFile` ที่ไม่ได้ใช้แล้ว
- เหลือเฉพาะปุ่ม `สรุป Excel` (ใช้ไอคอน FileSpreadsheet ตามเดิม)

### 2. แก้ข้อมูลไม่ครบ
- **ดึง logs ครบทุกแถว** ด้วยการ paginate (วนดึงทีละ 1000 rows ด้วย `.range(from, to)`) จนกว่าจะหมด แทนการใช้ `.limit(1000)` เดิม
- เพิ่ม state แสดง "กำลังโหลดข้อมูล…" ระหว่างดึง

### 3. ปรับ Excel ให้ครอบคลุม
- **Sheet `Ranking`**: ใช้ตาราง `employees` ทั้งหมด (active) เป็น base list — พนักงานที่ไม่มีงานเสร็จในช่วงจะแสดงเป็น 0 ไม่หายจากรายงาน
- **Sheet `MoM`**: เช่นกัน base ด้วย employees ทั้งหมด
- เพิ่ม **Sheet `Logs`** — log ดิบทุกแถวในช่วงที่เลือก (job_id, พนักงาน, หมวดหมู่, ขั้นตอน, action, เวลา) เพื่อให้ตรวจสอบ/รวบยอดเองได้
- เพิ่ม **Sheet `Sessions`** — start/finish pair พร้อม duration, std, over (ครอบคลุมกว่า Over_Standard ที่กรองเฉพาะที่เกินมาตรฐาน)
- เพิ่ม **Sheet `By_Step`** — สรุปจำนวนงานเสร็จต่อขั้นตอนในช่วง
- เพิ่ม **Sheet `By_Category`** — สรุปจำนวนงานเสร็จต่อหมวดหมู่ในช่วง
- ใส่ header สรุปช่วงเวลา/ฟิลเตอร์ที่ใช้ใน sheet แรก

### ไฟล์ที่แก้
- `src/routes/_protected.dashboard.tsx` (ไฟล์เดียว)

### ไม่กระทบ
- ไม่แตะ schema/RLS/edge function
- ไม่เปลี่ยน UI ส่วนอื่นๆ ของ Dashboard
