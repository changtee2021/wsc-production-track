## เป้าหมาย
1. เปลี่ยนชื่อแอป `ProductionTrack` → `WSC ProductionTrack` ทั้งระบบ
2. ออกแบบหน้าแรก (`/`) ใหม่ แบ่งเป็น 2 ส่วน: แบนเนอร์สไลด์โชว์ (2/3) + ส่วนเริ่มงาน + 3 ขั้นตอน (1/3)
3. เพิ่มหน้าจัดการแบนเนอร์ในหน้าแอดมิน (จัดการข้อมูล) เพื่ออัปโหลด/ลบ/เรียงรูปแบนเนอร์ได้

## Backend (Lovable Cloud)

**Storage bucket ใหม่: `banners`** (public read)
- นโยบาย: ทุกคนดูได้ / เฉพาะผู้ใช้ที่ล็อกอินแล้วอัปโหลด/ลบได้

**ตารางใหม่: `home_banners`**
- `id`, `image_path` (path ใน bucket), `sort_order` (int), `active` (bool), `created_at`
- RLS: select = ทุกคน, insert/update/delete = authenticated เท่านั้น

## Frontend

### `src/routes/index.tsx` — หน้าแรกใหม่
Layout เต็มจอแบ่งเป็น 2 ส่วนด้วย flex:
```text
┌─────────────────────────┐
│                         │
│   Banner Carousel       │  2/3 ของจอ (h-[66.67vh])
│   (auto-slide ทุก 5s)   │
│   • • •  (dots)         │
├─────────────────────────┤
│  3 ขั้นตอน + ไอคอน      │  1/3 ของจอ (h-[33.33vh])
│  ① สแกน ② เลือก ③ ยืนยัน│
│  [ เลื่อนเพื่อเริ่มงาน → ]│
└─────────────────────────┘
```
- Carousel: ใช้ `embla-carousel-react` (มีอยู่แล้วใน `components/ui/carousel`) + `embla-carousel-autoplay`
- โหลดรูปจาก `home_banners` ที่ `active = true` เรียงตาม `sort_order`
- ถ้าไม่มีรูป → fallback เป็น `welcome-hero.png`
- ส่วนล่าง: 3 ไอคอน (ScanLine, Users, CheckCircle2) เรียงแนวนอนพร้อมคำอธิบายสั้น + `SlideToConfirm` "เริ่มงาน"
- Header เล็กลง (logo + ปุ่มแอดมิน) ลอยทับแบนเนอร์ (absolute, glass effect)

### `src/routes/_protected.manage.tsx` — เพิ่มแท็บ/การ์ด "แบนเนอร์หน้าแรก"
- รายการรูปแบนเนอร์ปัจจุบัน (thumbnail + ปุ่มลบ + toggle active + ปุ่มเลื่อนขึ้น/ลง)
- ปุ่ม "อัปโหลดรูปแบนเนอร์" → upload เข้า bucket `banners` แล้ว insert row
- แนะนำสัดส่วน 3:4 (portrait) หรือเตือนถ้ารูปเล็กเกินไป

### เปลี่ยนชื่อแอป
แทนที่ `ProductionTrack` → `WSC ProductionTrack` ใน:
- `src/components/AppHeader.tsx`
- `src/routes/index.tsx`, `scan.tsx`, `admin.tsx`, `_protected.logs.tsx`, `_protected.dashboard.tsx`, `_protected.manage.tsx`
- `src/lib/i18n.tsx`

## ไฟล์ที่จะแก้ไข/สร้าง
- ใหม่: migration สร้างตาราง `home_banners` + bucket `banners` + RLS
- แก้: `src/routes/index.tsx` (รื้อ layout ใหม่)
- แก้: `src/routes/_protected.manage.tsx` (เพิ่มส่วนจัดการแบนเนอร์)
- แก้: ไฟล์ที่มีคำว่า `ProductionTrack` (8 ไฟล์)

## คำถามสั้น ๆ ก่อนลงมือ
- รูปแบนเนอร์ให้ auto-slide ไหม (ค่าเริ่มต้น: ใช่ ทุก 5 วินาที) — ถ้าไม่ตอบจะใช้ค่านี้
- 3 ขั้นตอนใช้ข้อความเดิม: **สแกน QR → เลือกพนักงาน/ขั้นตอน → เลื่อนเพื่อยืนยัน** — ถ้าไม่ตอบจะใช้ข้อความนี้