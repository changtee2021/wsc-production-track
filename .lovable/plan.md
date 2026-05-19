# Plan

## 1. แก้ปัญหาลบพนักงานติด FK constraint

**สาเหตุ:** `production_logs.employee_id` ใช้ `ON DELETE RESTRICT` (และตั้ง `NOT NULL`) ทำให้ลบพนักงานที่เคยมี log ไม่ได้

**วิธีแก้:** เก็บประวัติงานไว้เสมอ แต่ให้ลบพนักงานได้ โดยเปลี่ยน FK เป็น `ON DELETE SET NULL` และอนุญาตให้ `employee_id` เป็น NULL

### Migration
```sql
ALTER TABLE public.production_logs ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.production_logs DROP CONSTRAINT IF EXISTS production_logs_employee_id_fkey;
ALTER TABLE public.production_logs
  ADD CONSTRAINT production_logs_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
```
(ทำแบบเดียวกันกับ `qc_employees` ใน `qc_reports.qc_employee_id` — ปัจจุบันเป็น RESTRICT — เพื่อให้ลบพนักงาน QC ได้ด้วย)

### Frontend
- `src/routes/_protected.logs.tsx` และจุดอื่นที่อ่าน `l.employees?.name`: แสดง "— (พนักงานถูกลบ)" เมื่อ `employees` เป็น null
- `src/routes/_protected.dashboard.tsx`: เวลา group ตามพนักงาน ให้ข้าม/รวมเป็น "ไม่ระบุ" สำหรับ row ที่ employee_id เป็น null

## 2. เพิ่มตัวเลือกช่วงวันที่ในหน้าประวัติงาน

ไฟล์: `src/routes/_protected.logs.tsx`

เพิ่ม state `dateFrom`, `dateTo` (Date | undefined) และ:
- เพิ่มแถบฟิลเตอร์ใหม่ "ช่วงวันที่" ใต้ filter grid ปัจจุบัน ใช้ shadcn Popover + Calendar (date range) — ปุ่ม 2 ปุ่ม "ตั้งแต่" / "ถึง"
- เพิ่ม preset ปุ่มเร็ว: วันนี้ / 7 วัน / 30 วัน / ทั้งหมด
- กรองใน `useMemo` filtered: เทียบ `new Date(l.created_at)` กับช่วง (รวมทั้งวันของ `dateTo`)
- ปุ่ม "ล้างช่วงวันที่" เมื่อมีค่า

ใช้ `@/components/ui/calendar` + `popover` + `date-fns` (มีอยู่แล้วในโปรเจ็กต์)

## Files to edit
- `supabase/migrations/<new>.sql` — เปลี่ยน FK เป็น SET NULL + ทำคอลัมน์ employee_id เป็น nullable (ทั้ง production_logs และ qc_reports.qc_employee_id ที่ปัจจุบันยัง RESTRICT)
- `src/routes/_protected.logs.tsx` — เพิ่ม date range filter + render fallback ชื่อพนักงานที่ถูกลบ
- `src/routes/_protected.dashboard.tsx` — handle employee null (แสดง "ไม่ระบุ")
