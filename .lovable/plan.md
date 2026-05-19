## เพิ่มหน้า "การใช้พื้นที่จัดเก็บ" (Storage Usage) สำหรับแอดมิน

หน้าใหม่สำหรับติดตามว่า Database และ Storage ใช้พื้นที่ไปเท่าไหร่ เพื่อให้แอดมินวางแผนเพิ่มพื้นที่ได้ทันก่อนเต็ม

### 1. Route ใหม่
- `src/routes/_protected.storage.tsx` — หน้าหลัก
- เพิ่มปุ่ม "Storage" ใน nav bar ของ `src/routes/_protected.tsx` (icon: `HardDrive`)

### 2. Server function ใหม่
`src/lib/storage-usage.functions.ts` — `getStorageUsage` (admin token required)

ดึงข้อมูล 2 ส่วน:
- **Database size** — ผ่าน `supabaseAdmin.rpc` หรือ raw SQL query:
  - ขนาด DB ทั้งหมด (`pg_database_size`)
  - แยกตามตาราง (`pg_total_relation_size`) สำหรับ 8 ตารางใน schema public
  - จำนวนแถว (count) ในแต่ละตาราง
- **Storage buckets** — วนทุก bucket (`avatars`, `step-images`, `banners`, `log-notes`, `qc-media`):
  - ใช้ `supabaseAdmin.storage.from(bucket).list("", { limit: 1000 })` แบบ recursive
  - รวมขนาดจาก `metadata.size` ของแต่ละไฟล์
  - นับจำนวนไฟล์
  - ขนาดรวมต่อ bucket

> หมายเหตุเทคนิค: เนื่องจาก `pg_database_size` ต้องใช้ผ่าน SQL ไม่ใช่ PostgREST จะต้องสร้าง SQL function ใน public schema (security definer) ที่คืนค่า JSON ของ DB size + per-table stats เพื่อให้ supabaseAdmin เรียกผ่าน `.rpc()` ได้

### 3. Migration ใหม่
สร้าง function `public.get_db_usage_stats()`:
```sql
CREATE OR REPLACE FUNCTION public.get_db_usage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$ ... $$;
```
คืน `{ total_bytes, tables: [{name, size_bytes, row_count}] }`

### 4. UI ของหน้า Storage

```text
┌─ การใช้พื้นที่จัดเก็บ ────────────────────────────┐
│ [สรุปรวม]                                          │
│   Database: 14 MB   Storage: 23 MB  รวม: 37 MB     │
│                                                    │
│ [Database]                          14.0 MB        │
│   ▓▓▓░░░░░░░░░░░░░░░░░  (แถบสี relative)          │
│   ├ production_logs   2.3 MB   1,234 rows         │
│   ├ qc_reports         64 KB     12 rows          │
│   └ ...                                            │
│                                                    │
│ [File Storage]                      23 MB          │
│   ├ avatars       1.2 MB    8 ไฟล์                 │
│   ├ step-images   5.4 MB   23 ไฟล์                 │
│   ├ banners       2.1 MB    4 ไฟล์                 │
│   ├ log-notes     8.3 MB   45 ไฟล์                 │
│   └ qc-media     12.0 MB   18 ไฟล์                 │
│                                                    │
│ [รีเฟรช] อัปเดตล่าสุด: 14:32                       │
└────────────────────────────────────────────────────┘
```

- แถบ progress (component `Progress` ที่มีอยู่แล้ว) แบบ **relative** — เทียบกับขนาดที่ใหญ่ที่สุดในกลุ่มเดียวกัน เพื่อเปรียบเทียบสัดส่วน ไม่มี % เทียบกับ quota fixed (ตามที่ user เลือก "แสดงเฉพาะขนาดที่ใช้ไป")
- ใช้ design tokens ที่มีอยู่ (card, border, muted-foreground)
- ปุ่มรีเฟรชเรียก server function อีกครั้ง
- helper `formatBytes()` แปลง bytes → KB/MB/GB

### 5. Behavior
- โหลดอัตโนมัติเมื่อเข้าหน้า
- แสดง skeleton ระหว่างโหลด
- จัดการ error ด้วย toast (sonner)
- ตารางเรียงจากใหญ่ → เล็ก

### ไฟล์ที่จะแก้/สร้าง
- ➕ `src/routes/_protected.storage.tsx`
- ➕ `src/lib/storage-usage.functions.ts`
- ➕ `supabase/migrations/<ts>_get_db_usage_stats.sql`
- ✏️ `src/routes/_protected.tsx` (เพิ่มปุ่ม nav)