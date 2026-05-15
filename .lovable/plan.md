## เป้าหมาย
เพิ่มชาร์ต 2 ชุด ใต้เซกชัน "รายงานรายพนักงาน × ขั้นตอน" ในหน้า `/dashboard` — มองจากมุมขั้นตอนเป็นหลัก

## สิ่งที่จะเพิ่ม

### D. Bar chart รายขั้นตอน — จำนวนงานที่พนักงานแต่ละคนทำ
- การ์ด grid (responsive sm:2 lg:2) หนึ่งใบต่อ 1 ขั้นตอน
- แต่ละใบมี horizontal BarChart: แกน Y = ชื่อพนักงาน, แกน X = จำนวนงาน (unique `job_id` ที่ `action="finish"`)
- เรียงพนักงานจากมากไปน้อย
- หัวการ์ด: ชื่อขั้นตอน + ยอดรวมงานของขั้นตอนนั้น

### E. Bar chart รายขั้นตอน — เวลาเฉลี่ยพนักงานแต่ละคน
- การ์ด grid เดียวกับ D หนึ่งใบต่อ 1 ขั้นตอน
- horizontal BarChart: แกน Y = ชื่อพนักงาน, แกน X = เวลาเฉลี่ย (นาที) ที่คนนั้นใช้กับขั้นตอนนั้น
- คำนวณจาก `scopedSessions` (start→finish pairs ที่อยู่ในช่วงเวลา) — เฉลี่ยข้ามทุก session ของคู่ employee×step
- ถ้ามี `std_duration_minutes` ของขั้นตอน → วาดเส้น ReferenceLine สีแดงตรงค่ามาตรฐาน + tooltip บอกว่าเกิน/ต่ำกว่ากี่นาที
- เรียงพนักงานจากเร็วสุดไปช้าสุด

## โครงเซกชันหลังปรับ
```text
รายงานรายพนักงาน × ขั้นตอน
├─ ตาราง matrix (เดิม)
├─ A. Pie งานต่อขั้นตอน (เดิม)
├─ B. Pie หมวด×ขั้นตอน รายคน (เดิม)
├─ C. Pie เวลาเฉลี่ย/ชุด รายคน (เดิม)
├─ D. Bar รายขั้นตอน — จำนวนงานต่อพนักงาน  (ใหม่)
└─ E. Bar รายขั้นตอน — เวลาเฉลี่ยต่อพนักงาน (ใหม่)
```

## ส่วนที่ไม่แตะ
- โลจิกโหลดข้อมูล / `filtered` / `sessions` / `scopedSessions` / `empStepReport` / ฟิลเตอร์
- เซกชันอื่น (MoM, over-standard, กิจกรรมล่าสุด, Export)

## ไฟล์ที่แก้
- `src/routes/_protected.dashboard.tsx` ไฟล์เดียว
  - เพิ่ม `useMemo` 2 ตัว: `stepEmpJobs` (per step → array of {emp, jobs}) และ `stepEmpAvg` (per step → array of {emp, avgMin, std})
  - เพิ่ม JSX 2 ก้อนต่อจากเซกชัน C
  - ใช้ `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `ReferenceLine` จาก `recharts` (เพิ่ม import `ReferenceLine`)
