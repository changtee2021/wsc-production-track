
# แผน: เจ้าหนูแจ้งซ่อม (Maintenance Module)

ทำเฉพาะส่วน A ทั้งหมดในรอบนี้ ส่วน B (สต๊อกออฟฟิศ/พนักงาน) จะทำเป็น Phase ถัดไป

## ภาพรวมการใช้งาน

```text
หน้าแรก → ปุ่ม "เจ้าหนูแจ้งซ่อม" (ใส่รหัส wscmaintenance123 ครั้งเดียว)
  ├─ แดชบอร์ดงานแจ้งซ่อม (open / in_progress / done)
  ├─ ทรัพย์สิน (เครื่องจักร/อุปกรณ์)
  ├─ แจ้งซ่อมใหม่
  └─ สต๊อกอะไหล่
```

flow งานซ่อม 1 ใบ:
```text
แจ้งซ่อม (รูป+เหตุผล+เลือกเครื่อง)
   ↓
เช็กอะไหล่ที่ต้องใช้ → เบิก (ตัดสต๊อก auto)
   ↓
ดำเนินการซ่อม (ถ่ายภาพส่งงาน + บันทึกวิธีซ่อม)
   ↓
ปิดงาน → เก็บเป็น log ค้นหาได้
```

## 1. Database (migration)

ตารางใหม่ทั้งหมดอยู่ใน schema `public`, RLS แบบเดียวกับ QC/Packing (block anon/auth — เข้าผ่าน server fn + admin client เท่านั้น):

- **`assets`** — ทรัพย์สิน/เครื่องจักร
  - `code` (รหัสทรัพย์สิน, unique), `name`, `category` (machine/equipment/tool), `location`, `serial_no`, `brand`, `model`, `purchase_date`, `purchase_price`, `vendor`, `warranty_until`, `note`, `image_url`, `active`
- **`spare_parts`** — อะไหล่
  - `code` (unique), `name`, `unit`, `stock_qty` (int), `min_qty`, `location_bin`, `unit_cost`, `image_url`, `active`
- **`maintenance_tickets`** — ใบแจ้งซ่อม
  - `ticket_no` (auto), `asset_id`, `reporter_name`, `reported_at`, `problem_text`, `problem_media` jsonb, `priority` (low/normal/high), `status` (open/in_progress/done/cancelled), `assignee_name`, `started_at`, `done_at`, `fix_method`, `fix_media` jsonb, `summary`
- **`maintenance_parts_used`** — อะไหล่ที่เบิกในใบงานนี้
  - `ticket_id`, `spare_part_id`, `qty`, `note`, `created_at`
- **`spare_part_movements`** — log การเคลื่อนไหวสต๊อก (issue/restock/adjust)
  - `spare_part_id`, `delta` (+/-), `reason`, `ticket_id` (nullable), `created_at`
- Trigger: เมื่อ insert `maintenance_parts_used` → ตัด `spare_parts.stock_qty` และเขียน `spare_part_movements` อัตโนมัติ
- **Storage bucket ใหม่** `maintenance-media` (private) — เก็บรูป/วิดีโอแจ้งซ่อม + รูปส่งงาน (signed URLs ผ่าน `media.functions.ts`)
- **Secret ใหม่** `MAINTENANCE_PASSWORD = wscmaintenance123` — เพิ่มผ่าน `add_secret`

## 2. Server functions / helpers

- `src/lib/maintenance-token.server.ts` — issue/verify token + ตรวจรหัสผ่าน (clone จาก qc-token)
- `src/lib/maintenance-session.ts` — client token store
- `src/lib/maintenance.functions.ts` — endpoints หลัก:
  - auth: `verifyMaintenancePassword`, `checkMaintenanceToken`
  - assets: `listAssets`, `upsertAsset`, `deleteAsset`, `getAsset`
  - spare parts: `listSpareParts`, `upsertSparePart`, `deleteSparePart`, `restockPart`
  - tickets: `listTickets` (filter status/asset/วันที่), `createTicket`, `getTicket`, `updateTicketStatus`, `addPartsUsed`, `closeTicket` (กรอก fix_method + แนบรูปงาน), `cancelTicket`
  - media: `maintenanceUploadMedia` (bucket `maintenance-media`)
- ขยาย `src/lib/media.functions.ts` เพิ่ม `maintenanceSignMediaUrls` + เพิ่ม `maintenance-media` ใน `ALLOWED`
- ขยาย `src/lib/admin.functions.ts`: เพิ่ม view รวมในหน้าแอดมิน (รายการ ticket + สถิติ)

## 3. หน้าใหม่ (routes)

- `src/routes/maintenance.tsx` — เกตรหัสผ่าน + แดชบอร์ดงานซ่อม (tab: Open / In progress / Done) + ปุ่มแจ้งซ่อม + ทางเข้าทรัพย์สิน/อะไหล่
  - subview ทำในไฟล์เดียว: `TicketListPanel`, `NewTicketForm`, `TicketDetail` (เช็ก/เบิกอะไหล่ + ปิดงาน), `AssetsPanel`, `SparePartsPanel`
- `src/routes/_protected.maintenance-admin.tsx` — มุมมองแอดมิน: รายงานสรุป, รายการ ticket ทั้งหมด, อะไหล่ใกล้หมด (stock_qty ≤ min_qty), export CSV

## 4. Navigation

- `src/routes/index.tsx`: เพิ่มปุ่ม "เจ้าหนูแจ้งซ่อม" ใต้ปุ่ม QC/แพ็คของ (สีส้ม/เขียวเข้ม เพื่อแยกหมวด — ใช้ semantic token)
- `src/components/AdminSidebar.tsx`: เพิ่มกลุ่มใหม่ "ซ่อมบำรุง" → "รายงานซ่อมบำรุง" (link ไป `/maintenance-admin`) วางก่อนกลุ่ม "ระบบ"
- `_protected.tsx`: เพิ่ม PAGE_TITLES สำหรับ `/maintenance-admin`

## 5. รายละเอียดที่สำคัญ

- รูป/วิดีโอแนบ: ใช้ `compressMedia` (มีอยู่แล้วใน `src/lib/media-compress.ts`) ก่อนอัปโหลด
- สต๊อกตัดเมื่อ "เบิก" เท่านั้น (insert `maintenance_parts_used`) — มีปุ่มคืน/ยกเลิกแถวที่จะเขียน movement กลับ
- ticket_no สร้างจาก sequence: `MT-YYMM-####`
- "log การซ่อม" = list ticket ที่ `status=done` พร้อม fix_method + รูป — พนักงานเปิดดูซ่อมแบบเก่าได้
- หน้า assets/spare parts แก้ไขได้จากหน้า `/maintenance` เลย (ไม่ต้องเป็นแอดมิน) ตามที่ผู้ใช้ระบุว่า "พนักงานทุกคน ไม่ต้องใส่รหัส" ถ้าผ่านเกตรหัส maintenance แล้ว
- ทุกการ insert/update ลง `public.system_logs` ตาม core rule

## 6. ไฟล์ที่จะสร้าง / แก้

สร้าง:
- `supabase/migrations/<ts>_maintenance.sql`
- `src/lib/maintenance-token.server.ts`
- `src/lib/maintenance-session.ts`
- `src/lib/maintenance.functions.ts`
- `src/routes/maintenance.tsx`
- `src/routes/_protected.maintenance-admin.tsx`

แก้:
- `src/lib/media.functions.ts` (เพิ่ม maintenance bucket + sign fn)
- `src/routes/index.tsx` (เพิ่มปุ่มเข้าหน้าซ่อม)
- `src/components/AdminSidebar.tsx` (เพิ่มกลุ่มซ่อมบำรุง)
- `src/routes/_protected.tsx` (title)
- `src/integrations/supabase/types.ts` (auto จาก migration)
- `src/routeTree.gen.ts` (auto)

## ลำดับการทำ

1. ขอ secret `MAINTENANCE_PASSWORD` จากผู้ใช้
2. รัน migration (ตาราง + bucket + RLS + trigger)
3. เขียน server fn + token helpers
4. เขียนหน้า `/maintenance` (gate + dashboard + ticket flow + assets + spare parts)
5. เพิ่มหน้าแอดมิน + sidebar + ปุ่มหน้าแรก
6. INSERT system_logs

หลังจบ phase นี้ ค่อยทำส่วน B (สต๊อกอุปกรณ์ออฟฟิศ/พนักงาน) ในรอบถัดไป — โครงตารางจะคล้าย `spare_parts` มาก แต่แยก domain ให้ชัดเจน
