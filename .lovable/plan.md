## เป้าหมาย
ทำหน้า `/employee-profile/$id` ให้ใช้ได้กับพนักงาน "ทุกแผนก" รวมข้อมูลในหน้าเดียว เลือกช่วงเวลาได้ (วัน/สัปดาห์/เดือน) และทำให้ชื่อพนักงาน+ปุ่ม 👁 คลิกได้จากทุกหน้าที่มีชื่อพนักงาน

## ขอบเขต

### 1) Server function ใหม่: `adminGetEmployeeProfile`
ไฟล์: `src/lib/features/employee-profile.functions.ts`

รับ input: `{ token, staff_key, range: "day"|"week"|"month", anchor_date }`
- `staff_key` = คีย์รวมจาก AllStaff (lowercase name + emp_code) — ใช้หาแถวที่ตรงกันในทุกตารางแผนก
- คืน:
  - `employee`: ข้อมูลรวม (name, emp_code, avatar_url, nationality, departments[])
  - `production`: timeline + stats (เหมือนเดิมจาก production_logs/standards)
  - `qc`: จำนวน qc_reports + รายการล่าสุด (จาก `qc_employees.id` ที่ match)
  - `packing`: จำนวน packing_reports + รายการล่าสุด
  - `maintenance`: จำนวน maintenance_tickets ที่ assign + สถานะ
  - `office`: จำนวน office_requests ที่เบิก
  - `expenses`: จำนวน expenses + ยอดรวม

ใช้ `supabaseAdmin` + verify admin token

### 2) ปรับหน้าโปรไฟล์ `_protected.employee-profile.$id.tsx`
- เปลี่ยน param ให้รับ `staff_key` (ใช้ `id` parameter เดิม โดยให้ค่าเป็น staff_key) — backward compat: ถ้า uuid ก็ map → staff_key
- เพิ่ม segmented control: **วัน / สัปดาห์ / เดือน** + date picker (anchor)
- Header: avatar, ชื่อ, รหัส, สัญชาติ, badge แสดงแผนกทั้งหมดที่สังกัด
- KPI cards (รวม): งานเสร็จ, เวลาทำงานรวม, เกินเวลา, สถานะไฟแดง
- Tabs/sections: ผลิต (timeline เดิม) | QC | แพ็ค | ซ่อม | ออฟฟิศ | ค่าใช้จ่าย — แต่ละแท็บโชว์สรุปจำนวน + รายการล่าสุด
- ถ้าไม่มีข้อมูลในแผนกใด แสดง empty state

### 3) ลิงก์เข้าโปรไฟล์ทุกจุด
ทุกที่เปลี่ยนเป็น `<Link to="/employee-profile/$id" params={{ id: staffKey }}>` หรือปุ่ม 👁

**A. `src/components/AllStaffPanel.tsx`**
- ลบเงื่อนไข `r.ids.production` — ทำให้ชื่อคลิกได้ทุกแถว
- เพิ่มคอลัมน์ "ดู" หรือปุ่ม 👁 (Eye icon) ในคอลัมน์ Actions ทุกแถว

**B. หน้าที่มีชื่อพนักงาน — เพิ่มปุ่ม 👁/ทำชื่อคลิกได้**
- `_protected.production-dashboard.tsx` — การ์ดในไลน์ผลิต
- `_protected.qc-reports.tsx` — ตารางผู้ตรวจ QC
- `_protected.packing-reports.tsx` — ตารางผู้แพ็ค
- `_protected.expenses-dashboard.tsx` — รายการคนเบิก
- `_protected.supplies-dashboard.tsx` — คนเบิกออฟฟิศ
- `_protected.dashboard.tsx` — ถ้ามี leaderboard/รายชื่อ

### 4) Helper รวม staff_key
ไฟล์: `src/lib/utils/staff-key.ts` — function `makeStaffKey(name, emp_code)` ใช้ logic เดียวกับ `staff-directory.functions.ts` เพื่อให้ทุกหน้าสร้างคีย์ลิงก์ได้ตรงกัน

### 5) Logging
- เพิ่มแถว `system_logs` (category=`feature`) สรุปการเพิ่มโปรไฟล์รวมทุกแผนก + จุดคลิกใหม่
- อัปเดต `src/lib/utils/version.ts` → R.05

## หมายเหตุ
- ไม่แตะ schema database — ใช้ตารางและคอลัมน์ที่มีอยู่
- ไม่กระทบ logic การบันทึก production_logs/standards เดิม
- ช่วงเวลา: คำนวณช่วง start/end ตาม anchor + range ที่ฝั่ง server
- กราฟ performance รายวันใน 30 วัน — ตัดออก (ไม่อยู่ในขอบ