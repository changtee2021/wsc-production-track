## 1. ย้ายปุ่ม "เจ้าหนูแจ้งซ่อม" ขึ้นไปบนขวาข้างปุ่ม LINE

ที่ `src/routes/index.tsx`:
- ลบปุ่ม "เจ้าหนูแจ้งซ่อม" สีส้มขนาดเต็ม ที่ด้านล่าง
- เพิ่มปุ่มไอคอนเล็ก `<Wrench>` สีส้มในแถบ header ขวาบน วางก่อนปุ่ม LINE (ลำดับ: ซ่อม → LINE → แอดมิน) — สไตล์เดียวกับปุ่ม LINE (rounded-full, sm:inline label "แจ้งซ่อม")

## 2. เพิ่มอัปโหลดรูปในรายการทรัพย์สิน/อะไหล่

`src/routes/maintenance.tsx` (และหน้าใหม่ในข้อ 3):
- ใน `AssetDialog` และ `PartDialog` เพิ่มฟิลด์ "รูปภาพ" — ใช้ `MediaUploader` ที่มีอยู่แล้ว (หรือ helper เล็กกว่า) แล้วบันทึก URL ลง `image_url` (server fn รองรับอยู่แล้ว)
- แสดงรูปเป็น thumbnail ในแต่ละการ์ดของ `AssetsPanel`/`PartsPanel`

## 3. ย้ายหน้าจัดการทรัพย์สิน + อะไหล่ ไปอยู่กับแอดมิน

- สร้าง route ใหม่ `src/routes/_protected.maintenance-master.tsx` (หัวข้อ "ทรัพย์สิน & อะไหล่") รวม 2 tab: ทรัพย์สิน / อะไหล่ — reuse component `AssetsPanel` / `PartsPanel` (export จาก maintenance.tsx หรือย้ายเป็น component แยก)
- ใน `src/routes/maintenance.tsx` ตัด tab "ทรัพย์สิน" และ "อะไหล่" ออก เหลือเฉพาะ "แจ้งซ่อม" — หน้าช่างซ่อมโฟกัสเฉพาะ tickets
- เพิ่มลิงก์ "ทรัพย์สิน & อะไหล่" ใน `AdminSidebar` กลุ่ม "ซ่อมบำรุง"
- ปรับ `assertMaint` (หรือเพิ่ม helper) ให้ยอมรับทั้ง maintenance token **และ** admin token เพื่อให้ server fns ที่จัดการ asset/part เรียกจากหน้าแอดมินได้

## 4. Dropdown พนักงานซ่อม + จัดการพนักงานซ่อมในแอดมิน

- Migration: สร้างตาราง `maintenance_employees` (โครงสร้างเหมือน `qc_employees`/`packing_employees`) + RLS block anon เหมือนกัน
- Server fns: `adminListMaintenanceEmployees`, `adminUpsertMaintenanceEmployee`, `adminDeleteMaintenanceEmployee` + `maintenanceListEmployees` (ใช้ token ช่างซ่อม)
- ใน `TicketDetailDialog` (maintenance.tsx) เปลี่ยน Input "ผู้รับผิดชอบซ่อม" เป็น `<Select>` จากรายชื่อ + ช่องพิมพ์เองได้ (fallback)
- เพิ่ม `MaintenanceEmployeesPanel` ใน `_protected.manage.tsx` (รูปแบบเดียวกับ `QcEmployeesPanel`) พร้อมอัปโหลดรูป/รหัสพนักงาน

## 5. รวมรายชื่อพนักงานทุกแผนก ไว้บนสุดของหน้าจัดการพนักงาน

- Server fn ใหม่ `adminListAllStaff`: รวมข้อมูลจาก 4 ตาราง (`employees`, `qc_employees`, `packing_employees`, `maintenance_employees`) คืนเป็น list ที่จับคู่ด้วย `name+emp_code` แล้วระบุ `departments: ("production"|"qc"|"packing"|"maintenance")[]` พร้อม `ids` ของแต่ละแผนก
- Server fn `adminToggleStaffDepartment({ name, emp_code, avatar_url, department, enabled })`: ถ้า `enabled=true` ไม่มีในแผนกนั้น → INSERT, ถ้า `enabled=false` → DELETE จากตารางแผนกนั้น (คงข้อมูลเดิมในแผนกอื่นไว้)
- เพิ่ม `AllStaffPanel` ที่ด้านบนสุดของหน้า manage.tsx: แสดงตารางทุกคน คอลัมน์ ชื่อ/รูป/รหัส/แผนก (checkbox 4 ช่อง) — ติ๊กถูก = เพิ่มเข้าแผนก, ติ๊กออก = ลบจากแผนก; แสดง badge แผนกที่มีอยู่; แก้ไขชื่อ/รหัส = sync ทุกแผนกที่ผูกอยู่

## ไฟล์ที่เกี่ยวข้อง

- `src/routes/index.tsx` (ข้อ 1)
- `src/routes/maintenance.tsx` (ข้อ 2, 3, 4)
- `src/routes/_protected.maintenance-master.tsx` (ใหม่ — ข้อ 3)
- `src/components/AdminSidebar.tsx` (ข้อ 3)
- `src/lib/maintenance.functions.ts` (ข้อ 3, 4)
- `src/lib/staff-directory.functions.ts` (ใหม่ — ข้อ 5)
- `src/routes/_protected.manage.tsx` (ข้อ 4, 5)
- Migration: `maintenance_employees` table + RLS + GRANT (ข้อ 4)
- Log ลง `system_logs` ทุกการเปลี่ยนแปลง