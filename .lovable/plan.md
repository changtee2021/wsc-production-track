## ปรับปรุงหน้า Storage — Usage Tracker เทียบเพดาน Free Tier

### เป้าหมาย
แสดงสัดส่วนการใช้พื้นที่เทียบกับเพดาน Free Tier (DB 500 MB, Storage 1024 MB) พร้อม progress bar เปลี่ยนสีตามระดับการใช้งาน

### สิ่งที่จะทำ

**1. เพิ่มค่าคงที่เพดานในแอป** (`src/routes/_protected.storage.tsx`)
- `DB_LIMIT_MB = 500`
- `STORAGE_LIMIT_MB = 1024`

**2. เพิ่มการ์ดสรุป "ภาพรวมเทียบเพดาน" ด้านบน**
แสดง 2 progress bar เด่นๆ:
- **Database Usage**: `{usedMB} / 500 MB` + `%`
- **Storage Usage**: `{usedMB} / 1024 MB` + `%`

แปลง bytes → MB โดยหารด้วย `1,048,576`

**3. สีตามระดับการใช้งาน**
- `< 70%` — เขียว (สีปกติ/primary)
- `70–90%` — เหลือง (warning)
- `> 90%` — แดง (destructive)

ทำผ่าน CSS variant ของ `<Progress>` (ส่ง className สีพื้น indicator) หรือสร้าง wrapper `<UsageBar value max />` ที่เลือกสีให้อัตโนมัติ + badge สถานะ ("ปกติ / ใกล้เต็ม / วิกฤติ")

**4. คงส่วนเดิม**
รายการ "ฐานข้อมูลต่อตาราง" และ "Storage ต่อ bucket" ที่มีอยู่ยังคงไว้ด้านล่าง — ใช้เป็น breakdown รายละเอียด

### หมายเหตุเรื่อง RPC

ผู้ใช้เสนอให้สร้าง RPC `get_storage_used_bytes()` และ `get_db_size_bytes()` ใหม่ — แต่ระบบมีอยู่แล้ว:
- `getStorageUsage` server function คืน `database.total_bytes` (จาก `pg_database_size`) และ `storage.total_bytes` (รวมจาก `storage.objects.metadata->>'size'`)
- ครอบคลุมข้อมูลเดียวกับ RPC ที่เสนอ ไม่ต้องสร้าง RPC ใหม่หรือ migration เพิ่ม

จะใช้ข้อมูล `total_bytes` ที่ server function ส่งกลับมาอยู่แล้วเทียบกับเพดานที่ตั้งไว้ในโค้ด

### ไฟล์ที่จะแก้
- `src/routes/_protected.storage.tsx` — เพิ่ม constants, การ์ด Usage vs Limit, สีตามระดับ

ไม่แตะ backend/database/migrations
