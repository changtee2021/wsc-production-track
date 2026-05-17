## ภาพรวม
สร้างระบบ QC แยกจากระบบสแกนพนักงานปกติ ประกอบด้วย 4 ส่วน:
1) ปุ่มเข้า QC + รหัสผ่าน `wscqc123`
2) หน้า `/qc` สำหรับสแกน-เลือกขั้นตอน-แนบรูป/วิดีโอ/ข้อความ-ส่งรายงาน
3) หน้าแอดมินจัดการพนักงาน QC (popup แยก)
4) หน้ารายงาน QC ในแอดมิน

## 1. ฐานข้อมูล (migration)
ตารางใหม่ + storage bucket ใหม่:

- **`qc_employees`** — `id, name, emp_code, active, created_at` (RLS: public read)
- **`qc_reports`** — เก็บรายงาน QC
  - `id, job_id, qc_employee_id, production_log_id (nullable), step_id, category_id, employee_id (พนักงานที่ทำขั้นตอนนั้น), note (text), media (jsonb array ของ {url, type:'image'|'video'}), status (text default 'open'), created_at`
  - RLS: public INSERT (เหมือน production_logs), อ่านผ่าน server fn admin เท่านั้น
- **Storage bucket `qc-media`** (public) สำหรับรูปและวิดีโอ
- เพิ่ม secret ใหม่: `QC_PASSWORD = wscqc123` (หรือ hardcode ใน env)

## 2. หน้าเข้า QC
- เพิ่มปุ่ม **"QC"** ที่ `AppHeader` มุมบนขวาของหน้าแรก (`/`) ข้างปุ่ม Admin
- สร้าง route `/qc-login` (หรือใช้ dialog) ที่รับรหัสผ่าน `wscqc123`
- ใช้ pattern เดียวกับ admin: `verifyQcPassword` server fn + token เก็บใน localStorage (`ptrack_qc_token`)
- เพิ่ม helper `qc-session.ts` คล้าย `admin-session.ts`
- เพิ่ม layout route `_qc.tsx` หรือเช็คใน loader ของ `/qc`

## 3. หน้า `/qc`
ใช้ UI ใกล้เคียง `/scan` แต่:
- **สแกน QR / กรอก job_id** (เหมือนเดิม)
- **เลือกพนักงาน QC** จาก `qc_employees`
- เมื่อมี job_id แล้ว → query `production_logs` ของ job นั้น (action='finish') แสดง list:
  - หมวดหมู่ + ขั้นตอน + ชื่อพนักงาน + เวลา
  - แตะเลือก 1 รายการ → เปิดฟอร์มรายงาน
- **ฟอร์มรายงาน**:
  - กล่องข้อความ (note)
  - ปุ่มถ่ายภาพ / เลือกรูป (หลายไฟล์)
  - ปุ่มถ่ายวิดีโอ / เลือกวิดีโอ
  - preview thumbnails + ลบได้
  - ปุ่ม **"ส่งรายงานไปแอดมิน"**
- ไม่มีปุ่ม start/finish

## 4. แอดมิน — จัดการพนักงาน QC
ใน `/manage` เพิ่มแท็บใหม่ **"พนักงาน QC"** (หรือปุ่ม popup ตาม request)
- CRUD พนักงาน QC (ชื่อ, รหัส, active)
- ใช้ server fn ใหม่: `adminUpsertQcEmployee`, `adminDeleteQcEmployee`

## 5. แอดมิน — รายงาน QC
หน้าใหม่ `/_protected.qc-reports.tsx` (ลิงก์จาก dashboard/manage)
- ตารางรายงาน QC: วันที่, job_id, หมวดหมู่, ขั้นตอน, พนักงานที่ทำ, ผู้ตรวจ QC, note, สื่อ (คลิกดูได้)
- ฟิลเตอร์: ช่วงวันที่, job_id, พนักงาน QC, สถานะ
- ปุ่ม mark resolved/open
- export Excel/CSV (optional ตาม pattern logs.tsx)

## 6. Server functions ใหม่ (`src/lib/qc.functions.ts`)
- `verifyQcPassword(password)` → token
- `checkQcToken(token)`
- `qcFetchJobLogs(jobId)` — return finish logs ของ job
- `qcSubmitReport({ token, job_id, qc_employee_id, step_id, category_id, employee_id, production_log_id, note, media })`
- `qcCreateUploadUrl({ token, ext, kind })` — signed upload ไป bucket `qc-media`
- `adminListQcEmployees(token)`, `adminUpsertQcEmployee`, `adminDeleteQcEmployee`
- `adminFetchQcReports({ token, filters })`, `adminUpdateQcReportStatus`

## ไฟล์ที่แก้ / สร้าง
**สร้าง**
- `supabase migration` (qc_employees, qc_reports, bucket qc-media + policies)
- `src/lib/qc.functions.ts`, `src/lib/qc-session.ts`, `src/lib/qc-token.server.ts`
- `src/routes/qc.tsx` (หน้าหลัก QC + login flow)
- `src/routes/_protected.qc-reports.tsx`
- เพิ่ม functions ใน `src/lib/admin.functions.ts` สำหรับ QC employees + reports

**แก้**
- `src/routes/index.tsx` หรือ `AppHeader` — เพิ่มปุ่ม QC มุมบนขวา
- `src/routes/_protected.manage.tsx` — เพิ่มแท็บ "พนักงาน QC"
- `src/routes/_protected.dashboard.tsx` — เพิ่มลิงก์ไปหน้ารายงาน QC (optional)

## คำถามก่อนเริ่ม
1. รหัส `wscqc123` ให้ hardcode ในโค้ดเลย หรือเก็บเป็น secret `QC_PASSWORD`?
2. ขนาด/ระยะเวลาวิดีโอจำกัดเท่าไร (เช่น ≤ 30MB, ≤ 60 วินาที)?
3. รายงาน QC ให้ปรากฏใน Dashboard เดิมด้วยไหม หรือแยกหน้าใหม่อย่างเดียวพอ?
