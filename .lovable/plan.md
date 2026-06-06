## ภาพรวม
ใช้ตารางเดิมทั้งหมด (`production_logs`, `production_standards`, `employees`, `categories`, `steps`) — ไม่สร้างตารางใหม่ ใช้ `app_settings` เก็บ threshold (default 3)

## 1) Sidebar — เพิ่มกลุ่ม "การผลิต"
แก้ `src/components/AdminSidebar.tsx` เพิ่ม `SidebarGroup` ชื่อ **การผลิต** ครอบเมนูใหม่:
- หมวดหมู่งานม่าน → `/manage?tab=cat`
- ขั้นตอนการผลิต → `/manage?tab=step`
- เช็คลิสต์ QC → `/manage?tab=qc-check`
- เช็คลิสต์แพ็คของ → `/manage?tab=pack-check`
- **แดชบอร์ดไลน์ผลิต** (ใหม่) → `/production-dashboard`
- **ตั้งค่าเวลามาตรฐาน** (ใหม่) → `/production-standards`

แก้ `_protected.manage.tsx` ให้รับ query `?tab=` เพื่อเปิด accordion ตรงนั้นอัตโนมัติ (เก็บเมนูเดิมไว้ — ไม่ลบ)

## 2) Employee Production Profile
**เพิ่ม route**: `src/routes/_protected.employee-profile.$id.tsx`
- คลิกชื่อพนักงานใน `AllStaffPanel` → นำทางไปหน้านี้ (ใช้ `employees.id` ของแผนก production; ถ้าไม่มีจะ disable)
- แสดง: avatar, ชื่อ, รหัส, แผนก, สถิติวันนี้ (ชิ้นเสร็จ, นาทีทำงานรวม, จำนวนครั้งเกินมาตรฐาน, ป้ายแดงถ้า ≥ threshold)
- **Timeline** เรียงเวลาจากใหม่→เก่า: จับคู่ `production_logs` action=start/finish ของ job+step เดียวกัน คำนวณ `actual_seconds = finish.created_at - start.created_at` เทียบ `production_standards.target_seconds` แสดงชิป 🟢/🔴
- กรองวันที่ได้ (default = วันนี้)

**Server fn ใหม่**: `src/lib/features/employee-profile.functions.ts`
- `adminGetEmployeeTimeline({ token, employee_id, date })` → คืน rows {job_id, category_name, step_name, started_at, finished_at, actual_seconds, target_seconds, exceeded}
- `adminGetEmployeeDailyStats({ token, employee_id, date })` → คืน {finished_count, total_seconds, exceeded_count}

แก้ `AllStaffPanel.tsx`: ทำให้แต่ละ row คลิกได้ → `navigate({ to: "/employee-profile/$id", params: { id: ids.production ?? firstId } })`

## 3) Production Line Dashboard
**เพิ่ม route**: `src/routes/_protected.production-dashboard.tsx`
- Tab ตาม `categories` (ดึงจาก DB จริง — ไม่ hardcode รุ่น)
- ใต้แต่ละ tab แบ่งคอลัมน์ตาม `steps.step_name` (ขั้นตอนย่อย)
- แต่ละคอลัมน์แสดงการ์ดพนักงานที่กำลัง active (`start` ที่ยังไม่มี `finish` ใน ~8h ล่าสุด) + progress bar เทียบ `target_seconds`
- การ์ดของพนักงานที่ exceeded ≥ threshold วันนี้ → กรอบกะพริบสีแดง/ส้ม (Tailwind animate-pulse + ring-destructive)
- Auto refresh ทุก 15 วิ (React Query refetchInterval)

**Server fn**: `adminGetActiveProduction({ token })` → คืน {category_id, step_id, employee, job_id, started_at, elapsed_seconds, target_seconds, employee_exceeded_today}

## 4) Production Standards & Settings
**เพิ่ม route**: `src/routes/_protected.production-standards.tsx`
- ตาราง matrix: หมวดหมู่ × ขั้นตอน → ช่อง target_seconds (แก้ inline บันทึก)
- ช่องตั้งค่า **"จำนวนครั้งเกินเวลาที่ขึ้นไฟแดง"** (default 3) → เก็บใน `app_settings` key `production_red_threshold`

**Server fn**: `adminListProductionStandards`, `adminUpsertProductionStandard`, `adminGetRedThreshold`, `adminSetRedThreshold`

## 5) Migration
- INSERT row default ใน `app_settings` (`production_red_threshold` = "3")
- ไม่แก้ schema อื่น

## 6) System logs
INSERT แถวลง `system_logs` สรุปการเพิ่ม "การผลิต hub + profile + dashboard + ไฟแดง"

## สิ่งที่ไม่ทำ
- ไม่สร้างตารางใหม่ (`production_standard_times`/`employee_production_logs` ไม่ต้อง — ของเดิมครอบคลุมแล้ว)
- ไม่ลบเมนูเดิม
- ไม่แตะระบบสแกน/QC/Packing
- ไม่เปลี่ยน design tokens
