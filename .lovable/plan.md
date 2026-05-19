# LogUpdate — บันทึกการเปลี่ยนแปลงแอป

## เป้าหมาย
หน้าใหม่ใน Admin แสดงรายการการอัปเดต/แก้ไข/เพิ่มฟีเจอร์ของแอปแบบ timeline และตั้งกฎให้ Lovable insert log อัตโนมัติทุกครั้งที่แก้โค้ด

## 1. Database (migration)

ตาราง `system_logs`:
- `id` uuid PK
- `title` text — หัวข้อสั้น (เช่น "เพิ่มหน้า LogUpdate")
- `summary` text — สรุปสิ่งที่เปลี่ยน (อ่านง่าย ภาษาไทย)
- `category` text — `feature` | `bugfix` | `security` | `ui` | `refactor`
- `version` text nullable — เช่น `v1.2.3`
- `paths` text[] — ไฟล์/โมดูลที่แตะ
- `created_at` timestamptz default now()

RLS: เปิด, block anon ทั้งหมด (admin อ่านผ่าน service-role server function เหมือนตารางอื่น)

Index: `created_at desc`

## 2. Server functions (`src/lib/system-logs.functions.ts`)
- `adminFetchSystemLogs({ token, limit?, category? })` — list
- `adminInsertSystemLog({ token, title, summary, category, version?, paths? })` — manual add (optional admin UI)
- `adminDeleteSystemLog({ token, id })`
- `adminGetLatestLogTimestamp()` — สำหรับคำนวน badge NEW
ทุกตัวใช้ `assertAdmin` + `supabaseAdmin` (pattern เดียวกับ `admin.functions.ts`)

## 3. หน้า Admin

### `src/routes/_protected.logs-update.tsx`
- Timeline เรียงใหม่→เก่า, group ตามวัน
- Filter: category, search
- แต่ละการ์ดแสดง: badge category สี, title, summary, paths chips, created_at (Asia/Bangkok), version pill ถ้ามี
- ปุ่ม "เพิ่ม log" (dialog) สำหรับ admin เพิ่มเอง + ปุ่มลบ

### Sidebar (`AdminSidebar.tsx`)
- เพิ่มเมนู "อัปเดตล่าสุด" / "LogUpdate"
- Badge "NEW" สีแดง เมื่อ `latest_log.created_at > localStorage.lastSeenLogAt`
- เข้าหน้านี้แล้ว set `lastSeenLogAt = now()` → badge หาย

### Auto-open dialog
- เมื่อ admin เข้าหน้า `/admin` (หลัง login) ครั้งแรกหลังมี log ใหม่ → เปิด Dialog สรุป log ล่าสุด N รายการที่ยังไม่เห็น
- กด "รับทราบ" → set `lastSeenLogAt`, dialog ปิด
- เก็บ state ใน `localStorage` key: `wsc.admin.lastSeenLogAt`

## 4. กฎ auto-log สำหรับ Lovable (ตัวผม)

บันทึกเป็น **project memory** (`mem://index.md` core rule + `mem://features/system-logs`):

> **Core rule:** ทุก turn ที่แก้โค้ด/เพิ่มฟีเจอร์/แก้บั๊ก ต้องสร้าง migration เพิ่มแถวใน `system_logs` ด้วย (title, summary ภาษาไทย, category, paths[]) ใน migration เดียวกับการเปลี่ยนแปลง หรือ migration แยกถ้าไม่มี schema change

ทุกครั้งจะใช้ `INSERT INTO public.system_logs (...) VALUES (...)` แนบท้าย migration ที่จะรัน ผ่าน `supabase--insert` หรือใน migration เดียวกัน

## 5. Detail technical
- ใช้ pattern `requireToken()` + `showError()` จาก `admin-helpers.ts`
- เพิ่ม route เข้า `src/routeTree.gen.ts` อัตโนมัติโดย vite plugin (ไม่แตะมือ)
- รูปแบบเวลาแสดงผล: `dd MMM yyyy HH:mm` (th locale) + relative ("2 ชั่วโมงที่แล้ว")
- Category color mapping ใน styles.css tokens

## ขอบเขตที่ไม่ทำ
- ไม่ดึง git history มาแสดง (เป็น manual/AI insert เท่านั้น)
- ไม่ทำ public changelog (เฉพาะ admin)
- ไม่ทำ markdown rendering ใน summary (plain text + paths array)
