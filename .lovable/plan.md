# เพิ่มระบบประกาศ (Announcements)

## เป้าหมาย
- แสดงแถบประกาศบนสุดของหน้าแรก (`/`) และหน้า scan (`/scan`)
- แอดมินสามารถเพิ่ม/แก้ไข/ลบ/เปิด-ปิดประกาศได้จากหน้า `/manage`

## ฐานข้อมูล
สร้างตาราง `announcements`:
- `message` (text) — ข้อความประกาศ
- `active` (boolean, default true) — เปิด/ปิดการแสดง
- `sort_order` (int, default 0) — ลำดับการแสดงเมื่อมีหลายประกาศ
- มาตรฐาน: `id`, `created_at`, `updated_at`

RLS: ทุกคนอ่านได้ (public SELECT). การเขียน/แก้ไข/ลบทำผ่าน server function ที่ใช้ admin token เหมือน `home_banners`

## Server Functions (`src/lib/admin.functions.ts`)
เพิ่ม 3 ฟังก์ชันแบบเดียวกับ banner:
- `adminInsertAnnouncement` — รับ `message`, `sort_order`
- `adminUpdateAnnouncement` — รับ `id`, `message?`, `active?`, `sort_order?`
- `adminDeleteAnnouncement` — รับ `id`

## หน้าจอ

### Component ใหม่: `AnnouncementBar`
- อ่านประกาศที่ `active=true` เรียงตาม `sort_order`
- แสดงเป็นแถบบนสุด (sticky top หรือ inline บนสุดของ container)
- ถ้ามีหลายประกาศ → หมุนเปลี่ยนอัตโนมัติ หรือใช้ marquee เลื่อน
- ใช้สีจาก design token (เช่น `bg-primary/10 text-primary` พร้อม icon Megaphone)

### หน้าแรก (`src/routes/index.tsx`)
- วาง `<AnnouncementBar />` เหนือ banner carousel

### หน้า scan (`src/routes/scan.tsx`)
- วาง `<AnnouncementBar />` ไว้บนสุดของเนื้อหา

### หน้า manage (`src/routes/_protected.manage.tsx`)
- เพิ่ม `AnnouncementsPanel` ใต้/ข้าง `BannersPanel`
- รายการประกาศแบบเดียวกับ banner: ปุ่มเพิ่ม, แก้ไขข้อความ inline (textarea + save), เปิด/ปิด (Eye/EyeOff), ขึ้น/ลง (ArrowUp/Down), ลบ (Trash2)

## ภาษา
ทุก label เป็นภาษาไทย: "ประกาศ", "เพิ่มประกาศ", "แก้ไข", "บันทึก", "ลบประกาศนี้?"

## ไฟล์ที่จะแก้ไข/สร้าง
- migration ใหม่: สร้างตาราง `announcements` + RLS
- `src/lib/admin.functions.ts` — เพิ่ม 3 ฟังก์ชัน
- `src/components/AnnouncementBar.tsx` — สร้างใหม่
- `src/routes/index.tsx` — แทรกแถบประกาศ
- `src/routes/scan.tsx` — แทรกแถบประกาศ
- `src/routes/_protected.manage.tsx` — เพิ่ม `AnnouncementsPanel`
