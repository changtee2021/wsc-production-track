## ขอบเขต Phase 1 (B1)

ระบบทะเบียนสินทรัพย์ออฟฟิศ/โรงงานที่ไม่ใช่เครื่องจักร (ใช้แยกจากตาราง `assets` ของฝั่ง Maintenance) พร้อมการคำนวณค่าเสื่อมราคาแบบเส้นตรง (straight-line) และรายงานสรุปต่อหมวด/ต่อปี เปิดให้พนักงานทั่วไปเข้าดู+ค้นได้โดยไม่ต้องใช้รหัส ส่วนการเพิ่ม/แก้/ลบ ทำผ่านหน้า Admin

ไม่รวมในรอบนี้: การเบิก/คืน (B2) จะทำเฟสถัดไป

---

## โครงสร้างข้อมูลใหม่

### `office_asset_categories` (lookup หมวดหมู่)
- `name` (เช่น เครื่องเขียน, กระดาษ, อุปกรณ์ไฟฟ้า, เฟอร์นิเจอร์, เครื่องใช้สำนักงาน)
- `default_useful_life_months` (อายุใช้งานเริ่มต้นของหมวดเป็นเดือน เช่น 36, 60)
- `active`, `sort_order`

### `office_assets` (ทะเบียนสินทรัพย์รายชิ้น)
- `code` (รหัสภายใน เช่น OFF-0001 — generate อัตโนมัติ)
- `name`, `category_id`
- `brand`, `model`, `serial_no`, `vendor`
- `purchase_date`, `purchase_price`, `salvage_value` (มูลค่าซาก, default 0)
- `useful_life_months` (override default หมวด)
- `warranty_until`, `location` (สถานที่/โซน), `assignee` (ผู้ใช้ — text field)
- `image_url`, `note`
- `status`: `in_use` | `repair` | `retired` | `lost`
- `active`

### RLS
- `office_asset_categories`: SELECT เปิด public (อ่านได้ทุกคน), เขียนผ่าน service role เท่านั้น
- `office_assets`: บล็อก anon/authenticated แบบ RESTRICTIVE — เข้าถึงผ่าน server functions ทั้งหมด

---

## Server functions (`src/lib/office-assets.functions.ts`)

แนวเดียวกับ Packing — token ออกฟรีไม่ตรวจรหัสผ่าน (HMAC token, อายุ 12 ชม.) เพื่อใช้กับ rate-limit/abuse tracking และให้ TypeScript/server-side validation ทำงานได้

- `issueOfficeSession()` — ออก token ทันที
- `officeListAssets({ token, search, category_id, status })` — list + filter
- `officeGetAsset({ token, id })` — รายละเอียดชิ้นเดียว พร้อมค่าเสื่อมคำนวณ ณ ปัจจุบัน
- `officeListCategories({ token })` — รายการหมวด
- `officeSummary({ token, year? })` — สรุปต่อหมวด/ต่อปี: รวมจำนวนชิ้น, มูลค่าทุน, ค่าเสื่อมสะสม, มูลค่าคงเหลือ
- กลุ่ม admin (ต้อง `verifyAdminToken`):
  - `adminUpsertOfficeAsset(...)`, `adminDeleteOfficeAsset({ id })`
  - `adminUpsertOfficeCategory(...)`, `adminDeleteOfficeCategory({ id })`
  - `adminUploadOfficeAssetImage` — ใช้ bucket `office-assets` ใหม่ (private + signed URL ผ่าน `media.functions.ts`)

### สูตรค่าเสื่อม (คำนวณฝั่ง server, ไม่เก็บลง DB)
```
months_in_use   = max(0, months_between(purchase_date, today))
months_capped   = min(months_in_use, useful_life_months)
monthly_dep     = (purchase_price - salvage_value) / useful_life_months
accumulated_dep = monthly_dep * months_capped
book_value      = purchase_price - accumulated_dep
fully_depreciated = months_in_use >= useful_life_months
```
ค่าทั้งหมดส่งกลับใน response เพื่อให้ UI โชว์ได้ทันที

---

## หน้าเว็บ

### `/supplies` (public — เปิดให้พนักงานเข้าดู)
- หน้า list สินทรัพย์: card/table + search + filter หมวด/สถานะ
- คลิกเข้าดูรายละเอียด: รูป, สเปก, วันซื้อ, ประกัน, ค่าเสื่อมปัจจุบัน, สถานะ
- ใช้ `office-session` (sessionStorage) — ออก token อัตโนมัติเหมือน Packing

### `/supplies-admin` (อยู่ใต้ `_protected`, เฉพาะแอดมิน)
- ตาราง CRUD สินทรัพย์ + dialog เพิ่ม/แก้
- จัดการหมวดหมู่ (panel แยก)
- อัปโหลดรูป (compress ก่อนส่งเหมือนของเดิม)

### `/supplies-reports` (อยู่ใต้ `_protected`)
- รายงานสรุป:
  - เลือกปี → ตารางต่อหมวด: จำนวนชิ้น, มูลค่าทุนรวม, ค่าเสื่อมปีนี้, ค่าเสื่อมสะสม, มูลค่าคงเหลือ
  - กราฟแท่ง: มูลค่าคงเหลือต่อหมวด
  - ตารางสินทรัพย์ที่หมดอายุการใช้งานแล้ว (fully depreciated)
- ปุ่ม export CSV

### Sidebar
เพิ่มลิงก์ใน `AdminSidebar` (สำหรับแอดมิน) และเพิ่มทางเข้าจากหน้า Home/More สำหรับพนักงาน

---

## รายละเอียดเทคนิค

- ตาราง category seed ค่าเริ่มต้น: เครื่องเขียน (36 เดือน), กระดาษ (12), อุปกรณ์ไฟฟ้า (60), เฟอร์นิเจอร์ (60), คอมพิวเตอร์/อุปกรณ์ IT (36), อื่นๆ (36)
- Sequence สำหรับ `code`: `office_asset_seq` → format `OFF-NNNN`
- ใช้รูปจาก bucket `office-assets` (สร้างใหม่, private, signed URL TTL 1 ชม.) — เพิ่มใน `media.functions.ts` allowed list และ `adminSignMediaUrls`
- ปรับ `AdminAiAssistant`/AI tools: ยังไม่ต้องในรอบนี้
- ทุกการเปลี่ยน schema/โค้ด INSERT ลง `system_logs` ตาม core memory

---

## ขั้นตอนการ implement
1. Migration: ตาราง + sequence + bucket + RLS + grants + seed หมวด
2. Server functions `office-assets.functions.ts` + ขยาย `media.functions.ts` ให้รองรับ bucket ใหม่
3. หน้า public `/supplies` + session helper
4. หน้า admin `/supplies-admin` (CRUD)
5. หน้า report `/supplies-reports` + export CSV
6. ลิงก์เข้าเมนู Home / AdminSidebar
7. บันทึก `system_logs`
