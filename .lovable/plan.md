## เป้าหมาย

เชื่อม Curtain Flow → ฝ่ายผลิต: รับใบงานที่อนุมัติเช็คสต๊อกแล้วเข้ามาทาง endpoint สาธารณะ, ขึ้นคิวบน `/production-queue`, พิมพ์ Label สติ๊กเกอร์ thermal พร้อม QR, ให้พนักงานสแกน QR เพื่อ "เริ่ม/เสร็จ" แต่ละขั้นตอน, จับเวลา countdown ตามเวลามาตรฐาน, ตัดแต้มเข้า `employee_scores` เดิม และโชว์ Leaderboard

## โครงสร้างข้อมูล (Migration)

ตารางใหม่ `public.production_jobs`:
- `id uuid PK`, `job_no text UNIQUE` (ใช้บน QR, เช่น `25419fa4`)
- `order_no text` (เช่น `SO2604233`), `customer_name text`, `due_date date`, `ship_date date`
- `product_type text` (ม่านม้วน/มู่ลี่/...), `category_id uuid` (map เข้า `categories` ถ้าจับคู่ได้)
- `width_cm numeric`, `height_cm numeric`, `side text` ('L'|'R'|null)
- `fabric_code text`, `rail_code text`, `color_code text`, `motor text`, `accessories jsonb`
- `qty int default 1`, `label_rev text` (เช่น `FR-PL-001 Rev.01`)
- `status text` default `pending` — `pending|in_progress|done|cancelled`
- `printed_at timestamptz`, `started_at timestamptz`, `finished_at timestamptz`
- `source text default 'curtain_flow'`, `source_payload jsonb`
- `created_at`, `updated_at` + trigger touch

Index: `(status, due_date)`, `(job_no)`, `(order_no)`

GRANT: service_role ALL; ไม่ให้ anon/authenticated เพราะเข้าผ่าน server fn ทั้งหมด

RLS: เปิด + policy `service role manages production_jobs` (FOR ALL TO service_role)

> หมายเหตุ: ขั้นตอน start/finish ยังใช้ `production_logs` + `employee_scores` เดิม โดยใช้ `production_jobs.job_no` เป็น `job_id` (text) เพื่อให้ trigger `fn_score_on_finish` ทำงานต่อได้

## Endpoint รับงานจาก Curtain Flow

`POST /api/public/curtain-flow/jobs` (server route, `src/routes/api/public/curtain-flow/jobs.ts`)

- Auth: ตรวจ header `X-API-Key` เทียบ secret `CURTAIN_FLOW_API_KEY` (timingSafeEqual)
- Body: array ของใบงาน, validate ด้วย Zod (job_no, order_no, customer_name, product_type, width_cm, height_cm, fabric_code, rail_code, color_code, side, due_date, ...)
- upsert ลง `production_jobs` ด้วย `supabaseAdmin` ตาม `job_no` (idempotent)
- รองรับ field `cancelled: true` → set `status='cancelled'`
- ตอบกลับ `{ ok: true, accepted, updated, skipped }`
- Rate limit ในหน่วยความจำ (60/นาที/IP)

เพิ่ม endpoint คู่เสริม:
- `GET /api/public/curtain-flow/jobs/:job_no` — ให้ Curtain Flow โพลสถานะกลับ (auth เดียวกัน, คืน status + เวลา start/finish)

เอกสาร: เพิ่มหัวข้อสั้นใน `public/llms.txt` อธิบาย schema body + ตัวอย่าง curl

## Server functions (`src/lib/features/production-jobs.functions.ts`)

ทั้งหมด validate ด้วย admin token เดิม (`verifyAdminToken`):
- `adminListProductionJobs({token, status?, search?, date_range?})` — ใช้ใน `/production-queue`
- `adminMarkLabelPrinted({token, id})` — set `printed_at`
- `adminCancelProductionJob({token, id, reason})`
- `adminGetJobByQrToken({token, job_no})` — สำหรับสแกน

Worker-side (ไม่ต้อง admin token, ใช้ employee_id + job_no):
- `workerScanStart({employee_id, step_id, category_id, job_no})` → resolve `production_jobs` → insert `production_logs` action='start' + set jobs.status='in_progress', started_at
- `workerScanFinish({employee_id, step_id, category_id, job_no, note?, note_image_url?})` → insert action='finish' (trigger คะแนนทำงานเอง) → ถ้า step สุดท้าย set status='done', finished_at
- คืน `{points, tier, target_seconds, actual_seconds, total_points_today}` เพื่อให้หน้าจอเด้ง toast พลุ

## หน้า `/production-queue` (admin, `_protected.production-queue.tsx`)

Layout เน้นแท็บเล็ต, การ์ดใหญ่ขอบมน:
- Filter bar: สถานะ (รอผลิต/กำลังผลิต/เสร็จ/ยกเลิก), ค้นหา job_no/order_no, ช่วงวันที่
- Grid การ์ดต่อใบงาน — แสดง: `JOB_NO` ตัวใหญ่, order_no, customer, ประเภท, ขนาด `W × H cm`, สี/ใบ/ราง เด่น, ด้าน L/R, due_date
- ปุ่ม `🖨️ พิมพ์ Label` (เรียก `adminMarkLabelPrinted` + เปิด `/print-label/:job_no` ใน popup → `window.print()`)
- ปุ่ม `▶️ เริ่มผลิต` → เปิด QR ขยายจอเต็มให้พนักงานสแกน (หรือกดปุ่ม "เปิดสแกนเนอร์" ใช้กล้องในเครื่อง)
- Badge สถานะ + เวลาที่กำลังเดิน (live countdown ถ้ามี standard)

## หน้าพิมพ์ Label `/print-label/$jobNo` (route ภายใน admin)

- ใช้ CSS `@media print` ขนาดสติ๊กเกอร์ ~ 80mm × 40mm (config ได้)
- Layout เหมือนสติ๊กเกอร์จริงในรูป: หัวบริษัท, order_no มุมขวา, ชื่องาน, ขนาด ม้วน W × H cm, ผ้า, โซ่/ราง/มอเตอร์, รหัสใบ/Rev, วันสั่ง/วันส่ง, QR (เข้ารหัส `job_no`) มุมบน
- รองรับ qty → พิมพ์ซ้ำตามจำนวน
- ใช้ `qrcode` (มีในโปรเจกต์อยู่แล้วผ่าน `scan.tsx`?) — ถ้ายังไม่มีค่อยติดตั้ง `qrcode.react`

## โฟลวสแกน + แต้ม

ต่อยอด `src/routes/scan.tsx` ที่มีอยู่:
- เพิ่มโหมด "งานผลิตจาก Curtain Flow": เมื่อสแกน QR ได้ `job_no` → เรียก `adminGetJobByQrToken` แสดงรายละเอียดใบงาน + เลือก step → ปุ่ม `เริ่ม`/`เสร็จ`
- countdown timer ตาม `production_standards.target_seconds` (มีอยู่แล้ว) ระหว่างรอกด "เสร็จ"
- เมื่อเสร็จ: แสดง toast `+N คะแนน` พร้อม confetti เบา ๆ (lib `canvas-confetti` ขนาดเล็ก)

## Leaderboard

หน้าใหม่/พาเนลใน home worker (`/scan` หน้าแรก) + การ์ดในหน้า admin dashboard:
- Query `employee_scores` group by employee, สัปดาห์ปัจจุบัน, SUM(points) DESC LIMIT 10
- แสดงชื่อ + emp_code + แต้ม + badges (`employee_badges`)
- เพิ่ม server fn `getWeeklyLeaderboard()` (public, ไม่ต้อง auth)

## Secret

ต้องเพิ่ม secret ใหม่ผ่าน `add_secret`:
- `CURTAIN_FLOW_API_KEY` — สำหรับ Header `X-API-Key` ที่ฝั่ง Curtain Flow จะส่งมา

## เทคนิค / ข้อพิจารณา

- `production_jobs.job_no` เป็น text เพราะ Curtain Flow gen เอง (เห็นในรูปเป็น hex สั้น เช่น `03ae06cd`, `25419fa4`)
- กันยิงซ้ำด้วย upsert on `job_no`
- ไม่ใช้ Edge Function — ใช้ TanStack server route + `createServerFn` ตามแนวทางโปรเจกต์
- ไม่กระทบ schema เดิม: `production_logs`, `production_standards`, `employee_scores` ใช้ตามเดิม
- บันทึก `system_logs` ทุก migration/feature change ตามกฎโปรเจกต์

## ไฟล์หลักที่จะแตะ/สร้าง

สร้าง:
- `supabase/migrations/<ts>_production_jobs.sql`
- `src/routes/api/public/curtain-flow/jobs.ts` (POST + GET by job_no — ใช้ splat หรือสองไฟล์)
- `src/lib/features/production-jobs.functions.ts`
- `src/routes/_protected.production-queue.tsx`
- `src/routes/_protected.print-label.$jobNo.tsx`
- `src/components/ProductionJobCard.tsx`
- `src/components/Leaderboard.tsx`

แก้:
- `src/components/AdminSidebar.tsx` — เพิ่มเมนู "คิวผลิต (Curtain Flow)"
- `src/routes/scan.tsx` — เพิ่มโหมด job_no scan + countdown + confetti
- `src/routes/index.tsx` (หรือ home worker) — โชว์ Leaderboard
- `public/llms.txt` — เพิ่มเอกสาร endpoint

## เอกสาร endpoint (สำหรับ Curtain Flow)

```
POST https://wsc-production-track.lovable.app/api/public/curtain-flow/jobs
Headers:
  X-API-Key: <CURTAIN_FLOW_API_KEY>
  Content-Type: application/json
Body:
{
  "jobs": [
    {
      "job_no": "25419fa4",
      "order_no": "SO2604233",
      "customer_name": "บริษัท อินเฮ้าส์ ดีไซ",
      "product_type": "ม่านม้วน",
      "width_cm": 140, "height_cm": 160,
      "fabric_code": "L4-301",
      "rail_code": "FR-PL-001",
      "color_code": "ขาว",
      "side": "L",
      "motor": null,
      "qty": 1,
      "due_date": "2026-06-12",
      "label_rev": "Rev.01",
      "cancelled": false
    }
  ]
}
Response: { "ok": true, "accepted": 1, "updated": 0 }
```

ยืนยันแผนนี้เพื่อเริ่มสร้างได้เลยครับ
