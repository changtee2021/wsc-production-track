## เป้าหมาย
เปลี่ยน "ไฟแดง" จากค่ากลางตัวเดียว → กำหนดได้ต่อ (ขั้นตอน × หมวด) เหมือนตารางเวลามาตรฐาน และ prefill ค่าเริ่มต้นด้วยค่ากลางปัจจุบัน (3)

## ขอบเขต

### 1) Schema (`supabase--migration`)
เพิ่มคอลัมน์ `red_threshold integer` ลงในตาราง `production_standards` (nullable ก็พอ แต่ UI จะบังคับให้ตั้งทุกแถวที่มีเวลามาตรฐาน)

### 2) Server functions (`src/lib/features/production-monitor.functions.ts`)
- **`adminUpsertProductionStandard`**: รับ `red_threshold: number (1..50)` เพิ่มเข้าไป บันทึกพร้อม target_seconds
- **`adminListProductionStandards`**: คืน `red_threshold` ในแต่ละแถวด้วย
- **`fetchStandardsMap()` + `getRedThresholdValue()` callers**: เปลี่ยนเป็น map คืน `{ target_seconds, red_threshold }` ต่อ key
- **`adminGetProductionDashboard`**: ใช้ threshold ต่อ (step, category) ของพนักงานคนนั้นในรอบวัน — นับ exceeded แล้วเทียบกับ threshold ของขั้นตอนที่กำลังทำ (หรือถ้าจะ aggregate: แดงเมื่อใดก็ตามที่มีขั้นตอนใดเกินจำนวน threshold ของขั้นตอนนั้น)
- **`adminGetEmployeeTimeline`**: ส่ง `red_threshold` กลับต่อแถว + นับ exceeded แยกตาม (step, category) เทียบ threshold ของแต่ละขั้น แทนการใช้ค่าเดียว
- **ลบ** `adminGetRedThreshold`, `adminSetRedThreshold`, `getRedThresholdValue` และลบ key `production_red_threshold` ใน `app_settings`

### 3) UI หน้าเวลามาตรฐาน (`src/routes/_protected.production-standards.tsx`)
- ลบ section "ไฟแดงเมื่อเกินมาตรฐานวันละ ___ ครั้ง" ตัวเดียวออก
- ในแต่ละช่องของ matrix เพิ่มอินพุตที่สอง: "ไฟแดง (ครั้ง/วัน)" ข้างใต้ "เวลา (นาที)"
  - ค่าเริ่มต้น prefill = 3 เมื่อยังไม่มีค่า
  - บังคับกรอกทั้งสองช่องก่อน save
  - ปุ่ม save เดียวบันทึกทั้งคู่
- หัวข้อ + คำอธิบายใหม่: "ตั้งเวลามาตรฐาน + จำนวนครั้งที่ถือว่าไฟแดง ของแต่ละขั้นตอน × หมวด"

### 4) ที่อื่นที่อ้างถึง threshold เดิม
- `src/routes/_protected.employee-profile.$id.tsx` — `stats.is_red` คำนวณใหม่จาก per-step counters (server function ใหม่จะ return is_red มาให้แล้ว) UI ไม่เปลี่ยน
- `src/routes/_protected.production-dashboard.tsx` — ใช้ `is_red` ที่ส่งมาจาก server ต่อ active card (server คำนวณตาม threshold ของขั้นตอนนั้น)

### 5) Logging + version
- INSERT แถว `system_logs` (category=`feature`) สรุปการเปลี่ยน threshold เป็น per-step×category + ลบ global setting
- bump `src/lib/utils/version.ts` → R.06

## หมายเหตุ
- ไม่กระทบ logic การจับคู่ start/finish หรือการให้คะแนนใน `fn_score_on_finish`
- migration ลบ key `production_red_threshold` ออกจาก `app_settings` (one-time cleanup)
- prefill = 3 ฝั่ง UI เท่านั้น (DB เก็บเฉพ