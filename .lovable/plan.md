
# ระบบเบิกอุปกรณ์ออฟฟิศ (B2 — Requests & Stock)

## ภาพรวม
เพิ่ม flow การเบิก-อนุมัติ-ตัดสต๊อก สำหรับอุปกรณ์ในตาราง `office_assets` (ที่มีอยู่แล้ว) พร้อมแดชบอร์ดสำหรับแอดมินดูคำขอ/ค่าใช้จ่าย/สต๊อกใกล้หมด

## 1) Database (migration)

**แก้ `office_assets` เพิ่มคอลัมน์สต๊อก:**
- `stock_qty` integer not null default 0
- `min_qty` integer not null default 0  (เกณฑ์เตือน "ใกล้หมด")
- `unit` text not null default 'ชิ้น'

**ตารางใหม่ `office_requests` (หัวคำขอ):**
- `id`, `req_no` (auto: `REQ-YYMM-####`)
- `requester_employee_id` (uuid → office_employees / ไม่ FK เพื่อความยืดหยุ่น)
- `requester_name` (snapshot)
- `status` text: `pending` / `approved` / `rejected` / `cancelled`
- `note` text
- `approver_employee_id`, `approver_name` (snapshot, set ตอน approve)
- `approved_at`, `created_at`, `updated_at`

**ตารางใหม่ `office_request_items`:**
- `id`, `request_id` → office_requests
- `asset_id` → office_assets, `asset_name_snapshot`, `unit_price_snapshot`
- `qty` int (≥1)

**ตารางใหม่ `office_stock_movements` (log การเคลื่อนสต๊อก):**
- `id`, `asset_id`, `delta` int (− เบิก / + เติม)
- `reason` text: `issue` / `restock` / `adjust`
- `request_id` (nullable), `note`, `created_at`

GRANTs ครบ + RLS block anon/authenticated (เข้าผ่าน server fn เท่านั้น เหมือนของเดิม)

## 2) Server functions (`src/lib/office-requests.functions.ts`)

**สำหรับพนักงาน (token = office session ที่มีอยู่):**
- `officeSubmitRequest({ token, requester_employee_id, items:[{asset_id, qty}], note })` — สร้าง pending request
- `officeListMyRequests` (optional, แสดงสถานะของตัวเอง)

**สำหรับแอดมิน (admin token):**
- `adminListOfficeRequests({ status })` — รายการคำขอ + items
- `adminApproveOfficeRequest({ id, approver_employee_id })` — ตรวจสต๊อกพอ → ตัด `stock_qty` ทุก item, log movement, set approved
- `adminRejectOfficeRequest({ id, reason })`
- `adminOfficeRestock({ asset_id, qty, note })` — เติมสต๊อก + movement
- `adminOfficeStockDashboard()` — รวม:
  - คำขอ pending (count + list)
  - ของใกล้หมด (`stock_qty <= min_qty`)
  - ค่าใช้จ่ายเดือนนี้ / รวมทั้งหมด (จาก movements * unit_price)
  - top รายการที่ถูกเบิกบ่อย

## 3) UI — หน้าแรก (`src/routes/index.tsx`)

- ปุ่ม **"เบิกอุปกรณ์ออฟฟิศ"** มุมบนขวา → ลิงก์ไป `/supplies-request`

## 4) UI — หน้าเบิก (`src/routes/supplies-request.tsx`, public)

- ใช้ office session (free issue เหมือน Packing — ไม่ต้องรหัส)
- ขั้น 1: เลือกพนักงาน (จาก `office_employees`)
- ขั้น 2: แท็บ/dropdown เลือกหมวด (จาก `office_asset_categories`) — เลือกแล้วโชว์เฉพาะรายการในหมวดนั้น
- ช่องค้นหาชื่อ/รหัส filter รายการแบบ realtime
- แต่ละรายการ: รูป + ชื่อ + สต๊อกคงเหลือ + ปุ่ม +/− จำนวน (max = stock_qty)
- ตะกร้ารวมด้านล่าง + ช่อง note + ปุ่ม **"ยื่นขอเบิก"**
- toast แสดง `req_no` หลังส่ง

## 5) UI — แดชบอร์ดแอดมิน (`src/routes/_protected.supplies-dashboard.tsx`)

แท็บ/section ในหน้าเดียว:
- **สรุปบน**: จำนวน pending, ของใกล้หมด, ค่าใช้จ่ายเดือนนี้, ค่าใช้จ่ายสะสม
- **คำขอรออนุมัติ**: card แต่ละคำขอ — ผู้ขอ, รายการ + จำนวน, มูลค่ารวม, dropdown "ผู้อนุมัติ" (เลือก office_employee), ปุ่ม Approve / Reject
- **สต๊อกใกล้หมด**: ตารางรายการ + ปุ่ม "เติมสต๊อก" (modal ใส่จำนวน + หมายเหตุ)
- **ประวัติคำขอ** (filter status)
- **รายงานการใช้** (สรุปต่อหมวด / ต่อเดือน — ใช้ movements)

เพิ่มเมนู "แดชบอร์ดสต๊อก" ใน `AdminSidebar` หมวด Stock Office

## 6) อัปเดต admin panel ของเดิม

- `_protected.supplies-admin.tsx`: ฟอร์มแก้สินทรัพย์ เพิ่มช่อง `stock_qty`, `min_qty`, `unit`

## ไฟล์ที่จะสร้าง/แก้

**สร้าง:**
- `supabase/migrations/<ts>_office_requests.sql`
- `src/lib/office-requests.functions.ts`
- `src/routes/supplies-request.tsx`
- `src/routes/_protected.supplies-dashboard.tsx`

**แก้:**
- `src/lib/office-assets.functions.ts` (รวม stock fields ใน schema/return)
- `src/routes/index.tsx` (ปุ่มมุมขวาบน)
- `src/routes/_protected.supplies-admin.tsx` (เพิ่มช่อง stock/min/unit)
- `src/components/AdminSidebar.tsx` (เพิ่มเมนูแดชบอร์ด)
- `src/routes/_protected.tsx` (title route ใหม่)
- `src/integrations/supabase/types.ts` (auto)

**Log:** insert `system_logs` (category: feature) อธิบายฟีเจอร์เบิก/อนุมัติ/สต๊อก

## ความปลอดภัย
- พนักงานยื่นเบิกผ่าน office token (free) → สร้างได้แค่ pending, ไม่ตัดสต๊อก
- เฉพาะ admin token เท่านั้นที่ approve/reject/restock → ตัดสต๊อกใน transaction (เช็คก่อนว่าพอ ไม่งั้น throw)
- Movement log ทุกการเปลี่ยนแปลง
