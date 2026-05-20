# แผน: แสดงพนักงานทุกคนใน Job ID บนการ์ด QC Report

## ปัญหาปัจจุบัน
ในหน้า `/qc-reports` แต่ละการ์ดโชว์ "พนักงานที่ทำ" คนเดียว (จาก `r.employees.name` ที่ผูกกับ production_log เดียว) ทำให้ไม่เห็นภาพรวมว่า Job นี้มีใครทำขั้นตอนไหนบ้าง

## สิ่งที่จะทำ

### 1. เพิ่ม server fn `adminFetchJobWorkers` ใน `src/lib/admin.functions.ts`
- รับ `{ token, job_id }`
- Query `production_logs` ของ job_id นั้น เฉพาะ `action='finish'`
- Join กับ `employees(name, emp_code)`, `steps(step_name)`, `categories(name)`
- เรียงตาม `created_at` ASC
- คืน rows: `[{ id, created_at, action, employee, step, category, note }]`

### 2. ปรับ UI `src/routes/_protected.qc-reports.tsx`
- เพิ่ม state `jobWorkersMap: Record<jobId, Row[]>` + `loadingJob: Record<jobId, boolean>`
- ใน loop การ์ด: ใต้ส่วน "ผู้ตรวจ QC" เพิ่ม `<Accordion type="single" collapsible>` หัวข้อ "พนักงานที่ทำใน Job นี้ทั้งหมด (กดเพื่อดู)"
  - เรียก `adminFetchJobWorkers({ token, job_id: r.job_id })` ครั้งแรกที่กดเปิด (lazy load) แล้ว cache ลง `jobWorkersMap`
  - แสดงเป็นตาราง/รายการ: `เวลา • ขั้นตอน • พนักงาน (emp_code) • หมายเหตุ`
  - ถ้ายังโหลด → spinner; ถ้าว่าง → "ไม่มีบันทึกการผลิต"
- คงข้อความ "พนักงานที่ทำ" เดิม (พนักงานของ log ที่ผูก QC report) ไว้ตามเดิม

### 3. บันทึก system_logs
INSERT log: "เพิ่มรายการพนักงาน/ขั้นตอนทั้งหมดของ Job ในการ์ดรายงาน QC (collapsible)" — category: feature

## ไฟล์ที่เปลี่ยน
- `src/lib/admin.functions.ts` (เพิ่ม `adminFetchJobWorkers`)
- `src/routes/_protected.qc-reports.tsx` (เพิ่ม Accordion + lazy fetch)
- `system_logs` INSERT
