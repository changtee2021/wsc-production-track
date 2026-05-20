## 1) เปลี่ยนชื่อเมนู "ประวัติงาน" → "ประวัติงานผลิต"

**ไฟล์:** `src/components/AdminSidebar.tsx`
- แก้รายการ `{ title: "ประวัติงาน", url: "/logs" }` เป็น `{ title: "ประวัติงานผลิต", url: "/logs" }`
- (ไม่เปลี่ยน path/route — แค่ label ในเมนู)

---

## 2) ฟีเจอร์ใหม่ "ค้นหา Job ด่วน" (Quick Look)

วางใต้ Dashboard ในเมนูแอดมิน — ใส่เลข `job_id` หรือสแกน QR แล้วโชว์ข้อมูลทุกอย่างของ job นั้นในหน้าเดียว

### 2.1 Server function — `src/lib/admin.functions.ts`
เพิ่ม `adminFetchJobDetail({ token, job_id })` คืนข้อมูลรวมของ job:
- **production_logs** ทุก action (start/finish/etc.) ของ job_id นี้ พร้อม join `employees(name, emp_code, avatar_url)`, `steps(step_name, icon)`, `categories(name)`
- **qc_reports** ทุกใบของ job_id นี้ พร้อม join `qc_employees(name, emp_code)`, `categories(name)`, `employees(name)` และ `qc_report_items` (checklist ผ่าน/ไม่ผ่าน + remark + media) ของแต่ละใบ
- **summary**: นับจำนวน workers (distinct employee), จำนวน steps ที่ทำเสร็จ, ผลรวม QC (pass/fail/unknown), เวลา start แรกสุด & finish ล่าสุด, category หลัก
- ใช้ `assertAdmin(token)` + `supabaseAdmin` (RLS bypass บนเซิร์ฟเวอร์อย่างปลอดภัย)
- คืน DTO แบน ๆ (ตามกฎ serialization-safe)
- ถ้าไม่พบ job เลย คืน `{ found: false }` แทน throw

### 2.2 หน้าใหม่ — `src/routes/_protected.job-lookup.tsx`
- Header: "ค้นหา Job ด่วน" + คำอธิบายสั้น
- แถวค้นหา:
  - `Input` ใส่เลข job id + ปุ่ม **"ค้นหา"** (icon Search)
  - ปุ่ม **"สแกน QR"** เปิด `QrScannerDialog` (มีอยู่แล้ว) → เติมค่าลง input แล้ว auto-search
  - กด Enter ก็ค้นหา
- ผลลัพธ์ (เมื่อพบ):
  1. **การ์ดสรุป** — Job ID ตัวใหญ่, หมวด, ช่วงเวลา (เริ่ม-เสร็จล่าสุด), จำนวนพนักงานที่ทำ, จำนวนขั้นตอน, สรุป QC (ผ่าน/ไม่ผ่าน badge)
  2. **Timeline ขั้นตอนการผลิต** — list `production_logs` เรียงตามเวลา แสดง: avatar + ชื่อพนักงาน + emp_code, ชื่อ step, action (start/finish), เวลา, หมวด, note (+ note_image ถ้ามี)
  3. **รายงาน QC ทั้งหมดของ Job** — Accordion แต่ละใบเหมือนหน้า `/qc-reports` (หุบ default): หัวการ์ดโชว์ เวลา + ผู้ตรวจ + ✓/✗; กางแล้วโชว์ checklist items, สื่อ, หมายเหตุ
- ถ้าไม่พบ: state ว่าง "ไม่พบข้อมูลของ Job นี้"
- Loading state ระหว่างยิง server fn

### 2.3 Sidebar — `src/components/AdminSidebar.tsx`
แทรกใต้ Dashboard:
```
{ title: "ค้นหา Job ด่วน", url: "/job-lookup", icon: Search }
```
(import `Search` จาก lucide-react)

---

## 3) บันทึก `system_logs`
INSERT 1 แถว — `category: feature`, สรุป "เพิ่มหน้าค้นหา Job ด่วน (Quick Look) สำหรับแอดมิน + เปลี่ยนชื่อเมนูประวัติงานเป็นประวัติงานผลิต"

---

## ไฟล์ที่จะเปลี่ยน
- `src/components/AdminSidebar.tsx` (rename + เพิ่มเมนู)
- `src/lib/admin.functions.ts` (เพิ่ม `adminFetchJobDetail`)
- `src/routes/_protected.job-lookup.tsx` (สร้างใหม่)
- `system_logs` INSERT
