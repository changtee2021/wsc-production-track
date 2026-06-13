
# Backup ข้อมูลทั้งหมดสำหรับย้ายไป ERP project

ผมจะรันใน Lovable sandbox (มี psql + service role อยู่แล้ว) แล้ววาง output ทั้งหมดที่ `/mnt/documents/backup-YYYYMMDD-HHmm/` ให้คุณดาวน์โหลดเป็น ZIP

## ส่วนที่ทำได้ครบจาก sandbox

### 1. Schema SQL (`schema/`)
- `001-extensions.sql` — `pgcrypto`, `pg_trgm` ฯลฯ
- `010-enums.sql` — ทุก enum type ใน public (เช่น `app_role`, `expense_status`)
- `020-tables.sql` — `CREATE TABLE` 41 ตาราง + PK/FK/UNIQUE/CHECK/defaults/sequences (generate จาก `information_schema` + `pg_catalog`)
- `030-functions.sql` — 5 functions (`get_db_usage_stats`, `fn_score_on_finish`, `fn_parts_used_after_*`, `fn_touch_updated_at`) จาก `pg_get_functiondef`
- `040-triggers.sql` — trigger ที่ผูกกับ function ข้างบน
- `050-grants.sql` — `GRANT` ต่อ role (anon/authenticated/service_role) ตามที่มีอยู่จริง
- `060-rls-policies.sql` — RLS policies ทั้ง 41 ตาราง (จาก `pg_policies`)
- `070-indexes.sql` — index ที่ไม่ใช่ PK
- `apply.sh` — รัน 001–070 เรียงลำดับใน schema เป้าหมาย

### 2. Data CSV (`data/`)
- 1 ไฟล์ต่อ 1 ตาราง: `data/<table>.csv` (UTF-8 + BOM, header row)
- ใช้ `\COPY (SELECT * FROM <t>) TO ... WITH CSV HEADER`
- ครอบคลุม 41 ตาราง: announcements, app_settings, assets, categories, employees, employee_badges, employee_scores, error_logs, expense_*, expenses, feedbacks, home_banners, inventory_items, maintenance_*, office_*, packing_*, policies, production_*, qc_*, spare_*, steps, stock_*, system_logs, ticket_comments
- ลำดับการ import จะถูกจัดให้ตาม FK dependency

### 3. Data SQL (`data-sql/`)
- ไฟล์ `<table>.sql` มี `INSERT INTO ... VALUES ...` แบบ multi-row (batch 500 แถว) — สำหรับ restore ผ่าน psql ทีเดียวจบ
- เผื่อกรณี COPY ใช้ไม่สะดวก

### 4. Storage manifest (`storage/`)
- `manifest.json` — list ทุก object ในทุก bucket (path, size, mime, created_at, metadata) ดึงผ่าน service role
- **ไฟล์จริงไม่ download** — ดูส่วน "ข้อจำกัด" ด้านล่าง
- รวม script `download-storage.mjs` ที่คุณรันบนเครื่องตัวเอง (ใช้ legacy service role + ERP service role) เพื่อ copy bucket → bucket

### 5. Manifest + verify (`MANIFEST.json` + `verify.sql`)
- row count ของทุกตาราง + checksum (md5 ของ CSV) + ขนาดไฟล์ + timestamp
- `verify.sql` รันบน ERP หลัง import แล้วเทียบ count ตรงทุกตาราง

### 6. Restore runbook (`README.md`)
ขั้นตอนรันบน ERP project `erpzxusskbtdxvqadwxv` schema `wsc_production` (ที่มี 34 ตาราง 0 row อยู่แล้ว):
1. `TRUNCATE` ตารางที่เตรียมไว้ (CASCADE)
2. รัน `schema/apply.sh` สำหรับ 7 ตารางที่ ERP ยังไม่มี (diff จะแสดงในตอนสร้าง backup)
3. รัน `\copy` ตามลำดับ FK
4. รัน `verify.sql` เทียบ row count

## ข้อจำกัด (ทำไม่ได้จาก sandbox — ต้องรันบนเครื่องคุณ)

| งาน | เหตุผล | ทางแก้ |
|---|---|---|
| Download Storage files จริง (qc-media, packing-media, log-notes, maintenance-media, expense-receipts, feedback-media, banners, avatars, step-images, office-assets) | sandbox ไม่มี service role key ของ legacy project | ผมเตรียม `download-storage.mjs` ให้ — คุณรันด้วย service role key 2 อัน |
| Export `auth.users` (passwords hashes, identities, sessions, MFA factors) | sandbox เห็นเฉพาะ public schema; Auth admin API ต้องใช้ service role | คุณรัน `export-auth-users.mjs` (อยู่ในแพ็ก) เอง — Supabase Auth ไม่อนุญาตให้ migrate password hash ระหว่างโปรเจกต์อยู่ดี ผู้ใช้ต้อง reset password หรือใช้ magic link ครั้งแรกบน ERP |

## ส่วน technical (สำหรับ review)

- รันผ่าน `code--exec` + `psql` (มี `PG*` env พร้อม) + `supabase--read_query` สำหรับ catalog
- ใช้ Python script เดียวเขียนใน `/tmp/build-backup.py` ทำหน้าที่: query catalog → generate SQL → `\copy` CSV → คำนวณ checksum → zip
- Topological sort ตาราง: อ่าน `pg_constraint` (contype='f') สร้าง DAG → Kahn's algorithm → output `IMPORT-ORDER.txt`
- Output ZIP เดียว: `wsc-backup-YYYYMMDD-HHmm.zip` (`/mnt/documents/`)
- ไม่แตะ live DB, ไม่แตะ schema ใน ERP — เป็น read-only ทั้งหมด
- หลังเสร็จ INSERT 1 แถวลง `system_logs` ตาม Core memory rule

## Output ที่คุณจะได้
```
wsc-backup-20260613-HHmm.zip
├── README.md                      ← runbook
├── MANIFEST.json                  ← row counts + checksums
├── schema/                        ← DDL พร้อม apply.sh
├── data/                          ← CSV 41 ไฟล์
├── data-sql/                      ← INSERT statements 41 ไฟล์
├── storage/manifest.json + download-storage.mjs
├── auth/export-auth-users.mjs     ← script รันเอง
├── IMPORT-ORDER.txt
└── verify.sql
```

ใช้เวลารันประมาณ 1–3 นาที (แล้วแต่ขนาด data)

---

ถ้า OK กด Implement ผมเริ่มได้เลย หรือถ้าจะเพิ่ม/ตัดอะไร (เช่น ไม่ต้อง data-sql, หรือต้องการ split ZIP ต่อตาราง) บอกได้
