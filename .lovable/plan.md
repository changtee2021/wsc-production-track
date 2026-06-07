# แยกหมวดการผลิตออกจากหน้าพนักงาน

## เป้าหมาย
ย้าย 4 หมวดนี้ออกจากหน้า `/manage` (พนักงาน) ไปอยู่หน้าใหม่ของตัวเอง โดย**ไม่แตะข้อมูลในฐานข้อมูล** ปรับเฉพาะ UX/ตำแหน่งเมนู:
- หมวดหมู่งานม่าน
- ขั้นตอนการผลิต
- เช็คลิสต์ QC
- เช็คลิสต์แพ็คของ

## สิ่งที่จะทำ

### 1. สร้างหน้าใหม่ `src/routes/_protected.production-setup.tsx`
- ใช้ `validateSearch` รับ `?tab=cat|step|qc-check|pack-check` เหมือนเดิม
- ใช้คอมโพเนนต์เดิมที่มีอยู่ทั้งหมด (re-export จาก `_protected.manage.tsx` หรือย้าย `CategoriesPanel` + `StepsPanel` มาไฟล์ใหม่ และ import `QcChecklistsPanel` / `PackingChecklistsPanel` จากที่เดิม)
- หัวข้อหน้า: "ตั้งค่าการผลิต" — แสดงเป็น Section/Collapsible 4 อันแบบเดียวกับ manage เพื่อให้ผู้ใช้คุ้นเคย
- เปิด section อัตโนมัติตาม `tab`

### 2. เอา 4 sections ออกจาก `_protected.manage.tsx`
- ลบ `cat`, `step`, `qc-check`, `pack-check` จาก `sections[]`
- ลบ import `QcChecklistsPanel` / `PackingChecklistsPanel` ที่ไม่ใช้แล้ว
- ย้าย `CategoriesPanel` + `StepsPanel` ไปไฟล์ใหม่ (พร้อม import ของมัน) — ฟังก์ชัน server เดิม (`adminUpsertCategory` ฯลฯ) ไม่เปลี่ยน
- หน้า manage เหลือเฉพาะหมวดพนักงาน (all/prod/qc/pack/maint/office)
- ปรับคำอธิบายหัวเรื่องให้ตรง: "จัดการพนักงานทุกแผนก"

### 3. อัปเดต Sidebar (`AdminSidebar.tsx`)
ในกลุ่ม **"การผลิต"** เปลี่ยน url ของ 4 รายการจาก `/manage?tab=...` → `/production-setup?tab=...`:
- หมวดหมู่งานม่าน → `/production-setup` + `{tab:"cat"}`
- ขั้นตอนการผลิต → `/production-setup` + `{tab:"step"}`
- เช็คลิสต์ QC → `/production-setup` + `{tab:"qc-check"}`
- เช็คลิสต์แพ็คของ → `/production-setup` + `{tab:"pack-check"}`

(รายการอื่น เช่น แดชบอร์ดไลน์ผลิต / เวลามาตรฐาน คงเดิม)

### 4. บันทึก system_logs + อัปเดต `src/lib/utils/version.ts` (รัน R เพิ่ม 1)

## สิ่งที่จะไม่ทำ
- ไม่แตะ schema/ตาราง/ข้อมูลเดิม (categories, steps, qc_checklists, packing_checklists)
- ไม่แก้ server functions
- ไม่เปลี่ยนหน้า production-dashboard / production-standards
- ไม่ลบ route `/manage` (ยังใช้สำหรับพนักงาน) — แค่ลบ 4 sections ออก

## ผลลัพธ์ UX
- เมนู "พนักงาน" (ระบบ → พนักงาน) → จัดการคนล้วน ๆ
- เมนู "การผลิต" 4 รายการ → ไปหน้าใหม่ `/production-setup` ที่รวมการตั้งค่าการผลิตไว้ที่เดียว
