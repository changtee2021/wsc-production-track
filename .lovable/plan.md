# แผนงาน: ย้ายปุ่ม LINE + ปรับรูปแบบข้อความ

## 1. ย้ายปุ่ม "ทดสอบการแจ้งเตือน LINE"
- **ลบ** การ์ดปุ่ม LINE ออกจาก `src/routes/_protected.dashboard.tsx` (บรรทัด 1332–1356) พร้อม state `lineSending`, handler `handleSendLineTest`, import `adminSendLineTest`, `useServerFn`, `Send` ที่ไม่ใช้แล้ว
- **เพิ่ม** การ์ดเดียวกันใน `src/routes/_protected.logs-update.tsx` วางไว้ส่วนบน (ใต้หัวข้อ "บันทึกการอัปเดตแอป") พร้อม state + handler + import ที่จำเป็น

## 2. อัปเดตข้อความ LINE ใน `src/lib/line.functions.ts`

### Query เพิ่ม breakdown per-category
ใน `production_logs` มี column `category_id` อยู่แล้ว → ขยาย select เป็น `job_id, action, created_at, category_id` แล้ว aggregate แยกตามหมวด

Categories จาก DB (active):
- `339900cc...` → ม่านปรับแสง
- `7d54b73b...` → ม่านม้วน
- `0a07e9ba...` → มู่ลี่ไม้
- `27dd1ef7...` → มู่ลี่อลูมิเนียม

แนวทาง: query `categories` (id, name) → สำหรับแต่ละหมวด คำนวณ `newJobs / inProgress / finished` ด้วย logic เดียวกับยอดรวม (กรองจาก `category_id`) — สำหรับ "งานใหม่" ต้องตรวจ prior logs ของ job_id ที่กรองตามหมวดด้วย

### Format ข้อความใหม่
```
🚀 [WSC Production]
สรุปภาพรวมประจำวันที่ {dateStr}

📦 ภาพรวมการผลิต (Production)
- งานใหม่วันนี้: {n} รายการ
- กำลังดำเนินการ: {n} รายการ
- ผลิตเสร็จสิ้น: {n} รายการ

📦 การผลิตหมวดมู่ลี่ไม้
- งานใหม่วันนี้: {n} รายการ
- กำลังดำเนินการ: {n} รายการ
- ผลิตเสร็จสิ้น: {n} รายการ

📦 การผลิตหมวดมู่ลี่อลูมิเนียม
... (เหมือนกัน)

📦 การผลิตหมวดม่านม้วน
... 

📦 การผลิตหมวดม่านปรับแสง
... 

🔍 หมวดตรวจสอบ (QC)
- ตรวจสอบแล้ว: {qcTotal} รายการ
- ✅ ผ่านมาตรฐาน: {qcPassed}
- ❌ พบจุดบกพร่อง: {qcFailed}

⚠️ แจ้งเตือนพิเศษ: {รายการ failed หรือ "ไม่มี"}

📱 ลิงก์เข้าดูระบบ: https://wsc-production-track.lovable.app

🧠 บทวิเคราะห์ประจำวัน (AI)
{สรุป AI วิเคราะห์ภาพรวม + แต่ละหมวด}
```

### AI Analysis
- ส่ง stats ทั้งภาพรวม + breakdown per-category เข้า Lovable AI Gateway (`google/gemini-2.5-flash`)
- Prompt ให้สรุป 3-5 บรรทัด: ภาพรวม + ข้อสังเกตหมวดที่โดดเด่น/น่าห่วง + คำแนะนำ

## 3. บันทึก system_logs
INSERT log: "ย้ายปุ่มทดสอบ LINE ไป LogUpdate + เพิ่ม breakdown หมวดผลิตในข้อความ" (category: feature)

## ไฟล์ที่เปลี่ยน
- `src/routes/_protected.dashboard.tsx` (ลบ section LINE)
- `src/routes/_protected.logs-update.tsx` (เพิ่ม section LINE)
- `src/lib/line.functions.ts` (query per-category + format ใหม่ + AI prompt ใหม่)
- `system_logs` INSERT
