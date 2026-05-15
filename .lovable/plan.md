## เป้าหมาย
เพิ่มเซกชันใหม่ใน `/dashboard` แสดง pie chart **รายหมวดหมู่** สำหรับวันที่เลือกบนฟิลเตอร์ (scope=day) — แต่ละหมวดหมู่มี 2 pie: จำนวนชุดต่อขั้นตอน และเวลาเฉลี่ยต่อขั้นตอน

## สิ่งที่จะเพิ่ม

### F. รายงานรายหมวดหมู่ × ขั้นตอน (รายวัน)
- การ์ด 1 ใบต่อ 1 หมวดหมู่ (เฉพาะหมวดที่มีข้อมูลในวันนั้น)
- หัวการ์ด: ชื่อหมวดหมู่ + ยอดรวม finish ของวัน
- ในแต่ละการ์ดมี 2 pie วางคู่กัน (grid sm:2):
  - **Pie ซ้าย — จำนวนชุดต่อขั้นตอน**: slice = ขั้นตอน, value = จำนวน finish events ของขั้นตอนนั้นในหมวดนี้
  - **Pie ขวา — เวลาเฉลี่ยต่อขั้นตอน (นาที)**: slice = ขั้นตอน, value = ค่าเฉลี่ยเวลาจาก start→finish pairs ของขั้นตอนนั้นในหมวดนี้
- ถ้า scope ไม่ใช่ `day` → แสดงข้อความสั้น ๆ ว่า "เปลี่ยนเป็นโหมดรายวันเพื่อดูรายงานนี้"

## โครงเซกชันหลังปรับ
```text
รายงานรายพนักงาน × ขั้นตอน
├─ ตาราง matrix
├─ 3D. Bar รายขั้นตอน — จำนวนงานต่อพนักงาน
├─ 3E. Bar รายขั้นตอน — เวลาเฉลี่ยต่อพนักงาน
├─ 4. MoM
└─ F. Pie รายหมวดหมู่ — จำนวนชุด + เวลาเฉลี่ย/ขั้นตอน (รายวัน)  ← ใหม่
```

## รายละเอียดเทคนิค
- ไฟล์เดียว: `src/routes/_protected.dashboard.tsx`
- เพิ่ม `useMemo` ตัวเดียว `categoryDayReport`:
  - input: `filtered` (logs ในวัน) + `scopedSessions` (start→finish pairs ในวัน) + `categories` + `steps`
  - group by `category_id` → `step_id`
  - แต่ละ step เก็บ `{ finishCount, avgMin }` (avgMin = mean ของ duration จาก scopedSessions ที่ตรง category×step)
  - คืน `[{ id, name, totalFinish, jobsData: [{name, value}], avgData: [{name, value}] }]`
- JSX ใช้ `PieChart`, `Pie`, `Cell`, `Tooltip`, `Legend`, `ResponsiveContainer` (มี import อยู่แล้ว)
- ใช้ `CHART_COLORS` ที่มีอยู่
- gate ด้วย `scope === "day"` — โหมด month จะเห็นแค่ placeholder

## ส่วนที่ไม่แตะ
- โลจิกโหลดข้อมูล / ฟิลเตอร์ / `filtered` / `scopedSessions`
- เซกชันอื่นทั้งหมด
- Export Excel
