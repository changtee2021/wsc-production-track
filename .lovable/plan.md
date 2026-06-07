# แผนงาน R.07 — Standards (แยกหมวด) + Dashboard ย้อนหลัง + Profile Popup

ลิงก์แดชบอร์ดจริงสำหรับลองดู (ใช้ได้ทันทีหลังล็อกอินแอดมิน):
- Production Dashboard (live): https://wsc-production-track.lovable.app/production-dashboard
- Production Standards: https://wsc-production-track.lovable.app/production-standards
- Manage (AllStaff): https://wsc-production-track.lovable.app/manage
- Preview (เวอร์ชันล่าสุด): https://id-preview--508931e8-d4fa-42b6-aff5-441481d0ac31.lovable.app/production-dashboard

---

## 1) หน้า "เวลามาตรฐาน & ไฟแดง" — แยกหมวด มี Tab เลือกหมวด

ไฟล์: `src/routes/_protected.production-standards.tsx`

- เปลี่ยนเลย์เอาต์จาก "ตารางแถวขั้นตอน × คอลัมน์หมวด (กว้าง)" เป็น **Tabs ต่อหมวด** (รวมถึงแท็บ "ทุกหมวด (default)" และ "ทั้งหมด/รวม")
- แต่ละแท็บแสดงตารางเล็ก ๆ: คอลัมน์ = `ขั้นตอน | เวลามาตรฐาน(นาที) | ไฟแดง(ครั้ง/วัน) | บันทึก | ลบ`
- แท็บ "ทั้งหมด/รวม" คงตารางแบบ matrix เดิมไว้ดูภาพรวม (สลับมุมมองได้)
- มีช่องค้นหา/กรองชื่อขั้นตอนในแต่ละแท็บ
- ปุ่ม "บันทึกทั้งหมวด" (bulk save แถวที่แก้ในแท็บนั้น) — เรียก `adminUpsertProductionStandard` ทีละแถวที่ dirty

ไม่ต้องแตะ server fn / schema (ใช้ของเดิม).

---

## 2) แดชบอร์ดไลน์การผลิต — ช่วงวัน/สัปดาห์/เดือน/ปี/Custom + Export CSV/XLSX

ไฟล์: `src/routes/_protected.production-dashboard.tsx` + server fn ใหม่ใน `src/lib/features/production-monitor.functions.ts`

### Server fn ใหม่: `adminGetProductionHistory`
input: `{ token, range: "day"|"week"|"month"|"year"|"custom", anchor: YYYY-MM-DD, end?: YYYY-MM-DD, category_id?: string|null }`
output:
```ts
{
  range: { start, end },
  by_employee: Array<{
    employee_id, employee_name, emp_code, avatar_url,
    finished_count, total_seconds,
    exceeded_count,         // จำนวนครั้งที่เกินมาตรฐานในช่วง
    exceeded_by_day: Record<YYYY-MM-DD, number>,
    is_red: boolean,        // เกินเกณฑ์ red_threshold ใน step×cat ใด ๆ
  }>,
  timeline: Array<{          // ทุก pair start/finish ในช่วง
    employee_id, employee_name,
    job_id, step_id, step_name, category_id, category_name,
    started_at, finished_at, actual_seconds,
    target_seconds, exceeded,
  }>,
  totals: { finished_count, exceeded_count, employees_red }
}
```
ใช้ `pairLogs` + `fetchStandardsMap` เดิมจาก production-monitor.functions

### UI ปรับโครงสร้างหน้าเป็น 2 โหมด (Tabs ด้านบนสุด)
- **Live** (เดิม — ใครกำลังทำงานอยู่ตอนนี้, ไฟแดง animate)
- **Historical** (ใหม่):
  - แถบเลือกช่วง: ปุ่ม `วันนี้ | สัปดาห์ | เดือน | ปี | เลือกช่วง` + DatePicker (`anchor` หรือ `start..end` ถ้า custom)
  - Dropdown เลือกหมวด (`__all` หรือเฉพาะ category)
  - **Summary cards**: เสร็จทั้งหมด / เกินมาตรฐานรวม / พนักงานที่ติดไฟแดง / เวลารวม
  - **ตารางสรุปต่อพนักงาน** (`by_employee`): เรียงตาม exceeded_count desc — คอลัมน์ ชื่อ / เสร็จ / รวมเวลา / เกินกี่ครั้ง / ไฟแดง · กดชื่อเปิด **โปรไฟล์ Popup**
  - **Timeline ไล่ลงมา** (สไตล์เดียวกับโปรไฟล์): list `timeline` แสดงเวลา start→finish, job, step, หมวด, actual vs target, ขึ้นแดงถ้าเกิน · กดชื่อ/แถวเปิด Popup
  - **ปุ่ม Export**: `CSV` และ `Excel(.xlsx)` (ใช้ lib `xlsx` ที่มี / ถ้ายังไม่มีจะ `bun add xlsx`)
    - ไฟล์ CSV: header ภาษาไทย (`วันที่,พนักงาน,รหัส,Job,ขั้นตอน,หมวด,เริ่ม,เสร็จ,เวลาจริง(วิ),มาตรฐาน(วิ),เกิน?`)
    - ไฟล์ XLSX: 2 ชีท `Summary` (per employee) + `Timeline`
    - ตั้งชื่อไฟล์ `production_<range>_<anchor>.csv|xlsx`

---

## 3) โปรไฟล์พนักงาน → Popup แทนการเปลี่ยนหน้า + Export

สร้าง component ใหม่: `src/components/EmployeeProfileDialog.tsx`
- เป็น `<Dialog>` (shadcn) ขนาดใหญ่ (`max-w-4xl`, scrollable) — รี-mount เนื้อหาส่วนใหญ่ของหน้าโปรไฟล์เดิม (header + StatCards + Tabs Production/QC/Packing/Maintenance/Office + แถบเลือก range/anchor)
- props: `{ name, emp_code, open, onOpenChange }`
- ภายในเรียก `adminGetEmployeeAggregateProfile` เหมือนหน้าเดิม
- ปุ่ม **Export** ที่หัว Dialog: ดาวน์โหลด CSV (Production timeline + ตารางสรุปแต่ละแผนก) และ XLSX (หลายชีท: `Summary, Production, QC, Packing, Maintenance, Office, Expenses`)

### เปลี่ยนจุดที่กดชื่อ/ปุ่มตา → เปิด Dialog แทน `<Link to="/employee-profile/$id">`
แก้ไขที่:
- `src/components/AllStaffPanel.tsx` — ปุ่ม 👁 และชื่อพนักงาน
- `src/routes/_protected.production-dashboard.tsx` — ชื่อใน WorkerCard + ตารางสรุปใหม่
- `src/routes/_protected.qc-reports.tsx`, `_protected.packing-reports.tsx`, `_protected.manage.tsx` — จุดที่มีลิงก์ชื่อพนักงาน

ทำผ่าน **context/hook กลาง** เพื่อไม่ต้อง prop-drill:
- สร้าง `src/components/EmployeeProfileProvider.tsx` ครอบใน `_protected.tsx`
- export hook `useOpenEmployeeProfile()` → `(name, emp_code) => void`
- แต่ละหน้าเรียก hook นี้แทน `<Link>`

หน้า `src/routes/_protected.employee-profile.$id.tsx` — เก็บไว้เป็น fallback (เผื่อมี deep-link เดิม / share URL), แต่ default UX เปลี่ยนเป็น Popup

---

## 4) Logging + version

- `src/lib/utils/version.ts` → `R.07`
- INSERT `system_logs` 1 แถว: title="R.07 Standards by category + Historical dashboard + Profile dialog + Export", category="feature", paths คือไฟล์ที่แตะ

## รายการไฟล์ที่จะแก้/สร้าง
สร้าง:
- `src/components/EmployeeProfileDialog.tsx`
- `src/components/EmployeeProfileProvider.tsx`
- `src/lib/utils/export-report.ts` (helper CSV/XLSX)

แก้:
- `src/routes/_protected.production-standards.tsx`
- `src/routes/_protected.production-dashboard.tsx`
- `src/lib/features/production-monitor.functions.ts` (+ `adminGetProductionHistory`)
- `src/routes/_protected.tsx` (ครอบ Provider)
- `src/components/AllStaffPanel.tsx`
- `src/routes/_protected.qc-reports.tsx`, `_protected.packing-reports.tsx`, `_protected.manage.tsx`
- `src/lib/utils/version.ts`

ไม่มี migration ใหม่ — ใช้ schema เดิม.
