## ปรับปรุงระบบ QC: Checklist-based Inspection + Master Data

ต่อยอดจาก QC ปัจจุบัน (รหัสผ่าน QC, สแกน Job, รายชื่อพนักงาน QC, log ของ job) — เพิ่ม **checklist ไดนามิกตามหมวดสินค้า**, ระบบจัดการ checklist ของแอดมิน, และอัปเกรดหน้า QC Reports

---

### 1) Database (1 migration)

**ตารางใหม่ — `qc_checklists`** (master checklist ตามหมวด)
- `id` uuid PK
- `category_id` uuid → `categories(id)` ON DELETE CASCADE
- `item_text` text (≤500)
- `item_order` int (สำหรับเรียงลำดับ)
- `is_active` boolean default true
- `created_at` timestamptz
- RLS: `SELECT` แบบ public (QC ต้องใช้); เขียนผ่าน server-only admin client เท่านั้น
- Index: `(category_id, item_order)`

**ตารางใหม่ — `qc_report_items`** (ผลแต่ละข้อในรายงาน)
- `id` uuid PK
- `qc_report_id` uuid → `qc_reports(id)` ON DELETE CASCADE
- `checklist_id` uuid → `qc_checklists(id)` ON DELETE SET NULL (snapshot ตามชื่อขณะตรวจ)
- `item_text_snapshot` text (เก็บข้อความขณะตรวจ เผื่อ checklist ถูกแก้ภายหลัง)
- `item_order` int
- `is_passed` boolean
- `remark` text nullable
- `media` jsonb default `[]` (รูป/วิดีโอเฉพาะข้อนี้)
- RLS: INSERT public, SELECT ผ่าน admin server เท่านั้น

**แก้ตาราง `qc_reports`** (เพิ่มคอลัมน์ ไม่ลบของเดิม)
- เพิ่ม `overall_result` text — `'pass'` / `'fail'` / `null` (null = รายงานยุคเก่าก่อน checklist)
- เพิ่ม `summary` text — สรุป "ผ่าน X/Y ข้อ" หรือเก็บ pass_count/fail_count อย่างใดอย่างหนึ่ง
- คงคอลัมน์เดิม (`production_log_id`, `step_id`, `employee_id`, `note`, `media`, `status`) — ใช้ `note`+`media` เป็น "หมายเหตุภาพรวม" + "หลักฐานภาพรวม"

> เหตุผลคงของเดิม: รายงาน QC ที่บันทึกไว้แล้วในระบบจะยังดูได้ปกติ (`overall_result = null` = รายงานยุคเก่า)

---

### 2) Server functions

**ของพนักงาน QC** (`src/lib/qc.functions.ts` — แก้ไฟล์เดิม)
- `qcFetchChecklist({ token, category_id })` — ดึง checklist active ของหมวด เรียงตาม `item_order`
- `qcSubmitReport(...)` — เปลี่ยน signature: รับ `items: [{checklist_id, item_text, item_order, is_passed, remark, media}]`, `overall_result`, คงพารามิเตอร์เดิมไว้
  - Logic: insert ลง `qc_reports` แล้ว insert ลง `qc_report_items` ใน transaction เดียว (ใช้ `supabaseAdmin` หลาย call)

**ของแอดมิน** (`src/lib/admin.functions.ts` — เพิ่ม functions)
- `adminFetchChecklists({ token, category_id? })` — ดึง checklist ของหมวด (รวมที่ปิดใช้งาน)
- `adminUpsertChecklistItem({ token, id?, category_id, item_text, item_order, is_active })`
- `adminDeleteChecklistItem({ token, id })`
- `adminReorderChecklist({ token, category_id, ordered_ids: string[] })` — อัปเดต `item_order` ทีละข้อ
- `adminFetchQcReports` — ขยาย select ให้ join `qc_report_items` มาด้วย เพื่อโชว์ใน gallery

---

### 3) Frontend — QC (Mobile, แก้ไฟล์ `src/routes/qc.tsx`)

โครงสร้างใหม่ (mobile-first, สำหรับวงจรเดียวต่อ 1 job):

```text
[Job ID + สแกน QR + manual]            (เดิม)
[เลือกพนักงาน QC]                       (เดิม)
[Job History — pass-through summary]    (เดิม: แสดงรายชื่อพนักงาน × ขั้นตอน ของ job)
─────────────────────────────────────
[Checklist] (NEW)
  หมวด: <ดึงจาก category ของ job log ล่าสุด หรือให้เลือก>
  ┌─────────────────────────────────┐
  │ 1. ความสะอาดของผิวไม้           │
  │   [✓ ผ่าน] [✗ ไม่ผ่าน]          │
  │   ↓ ถ้ากด ไม่ผ่าน               │
  │   ▪ Textarea remark (required)  │
  │   ▪ ปุ่มถ่ายรูป/วิดีโอ เฉพาะข้อ│
  │   ▪ แกลเลอรี่ media ของข้อ      │
  ├─────────────────────────────────┤
  │ 2. ...                          │
  └─────────────────────────────────┘
─────────────────────────────────────
[หลักฐานภาพรวม]
  - หมายเหตุภาพรวม (textarea)
  - ปุ่มถ่ายรูป + ปุ่มถ่ายวิดีโอ (capture="environment")
─────────────────────────────────────
[ปุ่มส่งรายงาน]
  - แสดงสรุป "ผ่าน X/Y" + overall_result อัตโนมัติ (มีข้อไม่ผ่าน = fail)
```

**Logic หลัก**
- เมื่อมี `selectedLog` หรือ job log ใดๆ ที่มี category → call `qcFetchChecklist` ดึงรายการมาแสดง
- ถ้า job ไม่มี category ที่ระบุ → ให้ QC เลือก category เอง (Select dropdown)
- ปุ่ม Pass/Fail: ใช้สี success/destructive ใน design tokens
- Fail → render `<Textarea>` + ปุ่มกล้องเฉพาะข้อ (reuse pattern upload เดิม)
- Validate ก่อนส่ง: ตอบครบทุกข้อ, ทุก Fail ต้องมี remark
- `overall_result = items.every(i => i.is_passed) ? 'pass' : 'fail'`

**ส่วนที่ "เลือกขั้นตอนเดิม"** (ปัจจุบันให้ QC เลือก production log 1 ขั้นเพื่อ flag defect) → **ลบออก** เพราะ flow ใหม่เป็น checklist เต็มรูปแบบของทั้ง job

---

### 4) Frontend — Admin Checklist Builder (`src/routes/_protected.manage.tsx`)

เพิ่ม Panel ใหม่: **`ChecklistsPanel`**
- Dropdown เลือกหมวด (จาก `categories`)
- รายการ checklist ของหมวดนั้น (drag handle ซ้าย, text, สวิตช์ active/inactive, ปุ่ม edit/delete)
- ฟอร์มเพิ่มข้อใหม่ด้านบน
- Drag & drop: ใช้ `@dnd-kit/core` + `@dnd-kit/sortable` (ต้อง `bun add`)
- เมื่อปล่อย drag → call `adminReorderChecklist`

---

### 5) Frontend — QC Reports (`src/routes/_protected.qc-reports.tsx`)

ปรับ card ของแต่ละรายงาน:
- เพิ่ม badge "ผ่าน" / "ไม่ผ่าน" (จาก `overall_result`) ข้าง badge open/resolved เดิม
- ถ้ามี `qc_report_items` → แสดงตารางย่อย: ✓/✗, ข้อความ, remark, mini-gallery ต่อข้อ
- คง gallery รวม (`media`) ของรายงานไว้

---

### 6) Dependency ใหม่
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (สำหรับ drag-reorder)

### 7) ไฟล์ที่จะแก้/สร้าง
- ➕ migration: `qc_checklists`, `qc_report_items`, alter `qc_reports`
- ✏️ `src/lib/qc.functions.ts` — เพิ่ม `qcFetchChecklist`, ขยาย `qcSubmitReport`
- ✏️ `src/lib/admin.functions.ts` — เพิ่ม checklist CRUD + reorder, ขยาย `adminFetchQcReports`
- ✏️ `src/routes/qc.tsx` — แทนที่ flow เลือก step ด้วย checklist flow
- ✏️ `src/routes/_protected.manage.tsx` — เพิ่ม `ChecklistsPanel`
- ✏️ `src/routes/_protected.qc-reports.tsx` — แสดงผลรายข้อ + overall result

---

### คำถามก่อนเริ่ม

ขอยืนยัน 2 จุดสั้นๆ:

1. **flow เก่าที่ "เลือก 1 ขั้นตอนแล้วรายงาน defect"** — ลบทิ้งได้เลย ใช้ checklist ของทั้ง job แทน ใช่หรือไม่? (รายงานเก่าใน DB ยังอยู่ ดูได้ปกติ)
2. **กรณี job ไม่มีหมวดสินค้าใน history** (เช่นยังไม่เริ่มทำในระบบ) — ให้ QC เลือก category เองจาก dropdown ใช่หรือไม่?