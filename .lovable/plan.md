## เป้าหมาย
ปรับเซกชัน "รายงานรายพนักงาน × ขั้นตอน" ในหน้า `/dashboard` ให้เห็นภาพง่ายขึ้นด้วยกราฟวงกลม + เพิ่มรายงานเวลาเฉลี่ยต่อชุด

## สิ่งที่จะเพิ่ม (เรียงต่อจากตาราง matrix เดิม)

### A. Pie chart — งานรวมต่อขั้นตอน
- รวมจำนวนงาน (`finish`) ของทุกพนักงาน แยกตามขั้นตอน
- ใช้ข้อมูลจาก `empStepReport.stepCols` + `empStepReport.colTotals` ที่มีอยู่แล้ว
- Tooltip + legend แสดงชื่อขั้นตอน + จำนวน + %

### B. Pie chart รายพนักงาน — สัดส่วนหมวดหมู่ × ขั้นตอน
- การ์ด grid (responsive) หนึ่งใบต่อพนักงาน 1 คน
- แต่ละใบมี pie chart แสดง breakdown ของพนักงานคนนั้น โดย slice = "หมวดหมู่ — ขั้นตอน" (เช่น "เสื้อ — ตัด", "เสื้อ — เย็บ")
- ค่า = จำนวน unique `job_id` ที่ `action = "finish"` ของคู่นั้น
- ใต้กราฟแสดงชื่อ + จำนวนงานรวมของพนักงาน
- ใช้ `filtered` (มี scope + ฟิลเตอร์ครบแล้ว) — ต้อง derive ใหม่ใน `useMemo` เพราะ matrix เดิมไม่มีมิติ category

### C. Pie chart — เวลาผลิตเฉลี่ยต่อชุด รายพนักงาน
- ใช้ `scopedSessions` (start→finish pairs) จัดกลุ่มตาม `employee_id` × `job_id`
- "เวลาต่อชุด" = ผลรวมเวลาทุก step ของ job เดียวกันที่พนักงานคนนั้นทำ (นาที)
- ค่าเฉลี่ยต่อพนักงาน = เฉลี่ยข้าม jobs
- Pie slice ขนาด = ค่าเฉลี่ยนาที (คนเฉลี่ยช้า slice ใหญ่), tooltip บอกชื่อ + นาทีจริง + จำนวน job ที่นับเฉลี่ย
- มีหมายเหตุเล็ก ๆ บอกว่าคำนวณจากงานที่มีทั้ง start และ finish ในช่วงเวลา

## โครงหลังปรับ (เซกชัน 3 เดิม)
```text
รายงานรายพนักงาน × ขั้นตอน
├─ ตาราง matrix (เดิม)
├─ A. Pie: งานรวมต่อขั้นตอน           [full width]
├─ B. Pie grid รายพนักงาน × หมวด-ขั้นตอน [grid sm:2 lg:3]
└─ C. Pie: เวลาเฉลี่ยต่อชุด รายพนักงาน  [full width]
```

## ส่วนที่ไม่แตะ
- โลจิกโหลดข้อมูล / `sessions` / `scopedSessions` / ฟิลเตอร์บาร์
- ตาราง matrix เดิม / MoM / over-standard / กิจกรรมล่าสุด / Export

## ไฟล์ที่แก้
- `src/routes/_protected.dashboard.tsx` ไฟล์เดียว
  - เพิ่ม `useMemo` 3 ตัว: `stepPie`, `empCategoryStepPie` (array per employee), `avgPerJobPie`
  - เพิ่ม JSX 3 ก้อนต่อจากตาราง matrix
  - ใช้ `PieChart`, `Pie`, `Cell`, `Tooltip`, `Legend`, `ResponsiveContainer` จาก `recharts` ที่ import อยู่แล้ว
