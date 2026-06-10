# แผนการโคลนฟีเจอร์ — ทำทีละกลุ่ม (เริ่ม Group A)

ต้นทาง: `WP/WSC-Production` (multi-company wsc/wp + worker-token)
ปลายทาง: โปรเจคนี้ (single-tenant WSC, ใช้ admin/worker token เดิม)
หลักการพอร์ต: ตัด `company_id`/multi-tenant ทิ้ง, จัดไฟล์ตาม layout เดิมของโปรเจคนี้ (`src/lib/{features,auth,utils}`), ใช้ `requireToken` / admin-token เดิม, คง shape API ที่ Curtain Flow ใช้อยู่

---

## Group A — Stock Count (เชื่อม Curtain Flow) [ทำก่อน]

### A.1 Migration — สร้าง 3 ตารางใหม่ (ผ่าน `supabase--migration`)

```text
public.inventory_items
  id uuid pk, item_code text unique, item_name text, unit text,
  total_qty numeric default 0, active bool default true,
  notes text, created_at, updated_at
GRANT: authenticated R/W, service_role ALL, anon —
RLS: authenticated select/insert/update/delete (admin gate ที่ฝั่ง server)

public.stock_count_batches
  id uuid pk, batch_no bigserial-like (sequence),
  status text check in ('draft','submitted') default 'draft',
  note text default '',
  counted_by_emp_id uuid null, counted_by_emp_code text, counted_by_name text,
  submitted_at timestamptz, created_at, updated_at
GRANT + RLS เหมือนข้างบน

public.stock_counts
  id uuid pk, batch_id uuid fk→stock_count_batches on delete cascade,
  item_id uuid null fk→inventory_items, item_code text, item_name text, unit text,
  counted_qty numeric, system_qty numeric, variance numeric,
  status text check in ('match','short','over'),
  note text default '', counted_by_emp_id uuid null, counted_by_name text,
  created_at
INDEX: (batch_id), (item_code)
```

ไม่มี `company_id` (WSC-only). batch_no ใช้ sequence + trigger เติมตอน insert

### A.2 Auth: `src/lib/auth/stock-session.ts` + `stock-token.server.ts`
ก๊อปแพทเทิร์นเดียวกับ `packing-token.server.ts` (HMAC-signed token, 30 วัน, ไม่ต้องใส่รหัส — issue อัตโนมัติเหมือนแพ็คกิ้ง)

### A.3 Server functions: `src/lib/features/stock-count.functions.ts`
พอร์ตจาก `WP/WSC-Production/src/lib/stock-count.functions.ts` — ตัด `company_id`/`company`, ใช้ `verifyAdminToken` เดิม. มี:
- `issueStockSession`, `checkStockToken`
- worker: `getOrCreateDraftBatch`, `addCountLine`, `updateCountLine`, `deleteCountLine`, `listBatchLines`, `submitBatch`, `listMyBatches`
- admin: `adminListBatches`, `adminListBatchLines`, `adminListInventory`, `adminUpsertInventoryItem`, `adminDeleteInventoryItem`, `adminAdjustStock`

### A.4 Components & Pages
- `src/components/stock/BarcodeScannerDialog.tsx` — ใช้ `@zxing/browser` (เพิ่ม dep)
- `src/routes/stock-count.tsx` — worker UI (สแกน + นับ + ส่ง)
- `src/routes/_protected.stock-count-inventory.tsx` — admin จัดการ inventory_items + ปรับสต๊อกระบบ
- `src/routes/_protected.stock-count-reports.tsx` — admin ดูชุดนับ + ส่งออก CSV
- เพิ่มเมนูใน `AdminSidebar.tsx`

### A.5 Public API: `src/routes/api/public/stock-count.reports.ts`
พอร์ตตรง ตัด `company` filter (default ส่ง batch ของ WSC). ป้องกันด้วย header `x-wsc-secret` = secret `WSC_REPORTS_SECRET` (เพิ่มผ่าน `add_secret` หลังยืนยัน)

### A.6 บันทึก `system_logs` (ตามกฎโปรเจค) — แนบใน migration

---

## Groups ถัดไป (ทำหลังจาก A เสร็จ + เทสต์)

- **Group B** — My Profile (`/my-profile` + emp_code lookup) + `EmployeeHrTabs` 5 แท็บ (ติดต่อ/ส่วนตัว/การจ้าง/การเงิน/เอกสาร) + `EmployeeNameButton` / `EmployeeProfileBody` / `employee-hr.functions.ts` + `my-profile.functions.ts` — อาจต้องเพิ่มคอลัมน์ HR ใน `employees`
- **Group C** — Feedback (table + dialog + admin `/feedback`), `/home` landing + `CompanyLogo`, `DarkModeToggle`, `SlideToConfirm`, Spotlight ⌘K (`spotlight.functions.ts`)
- **Group D + E** — `standards-time.functions.ts`, `scoring.functions.ts`, แตก sitemap เป็น 11 ไฟล์ + `sitemap-helpers.ts`

---

## รายละเอียดเทคนิค (Group A)

- ใช้ `supabaseAdmin` ใน server functions (ผ่าน admin-token หรือ worker stock-token)
- ไม่แตะ `company_id` ทุกที่ — จะลบ filter `eq('company_id', company)` ออกหมด
- `BarcodeScannerDialog` ใช้ `@zxing/browser` (ตรวจ user-uploads ไม่จำเป็น) — fallback เป็น input manual ถ้ากล้องไม่ทำงาน
- secret `WSC_REPORTS_SECRET` — จะขอตั้งหลัง user ยืนยัน Group A
- batch_no auto increment — ใช้ `CREATE SEQUENCE` แล้ว default ในตาราง
- ส่งออก CSV ในหน้า reports — ใช้แพทเทิร์นเดียวกับ `production-excel-export.ts`

## ขอ confirm ก่อนเริ่มลงมือ Group A
1. ตกลงตามแผนนี้?
2. ฟิลด์ใน `inventory_items` อยากเพิ่มอะไรพิเศษไหม (เช่น `category`, `min_qty`, `cost`)?
3. `WSC_REPORTS_SECRET` ให้สร้างใหม่อัตโนมัติแล้วโชว์ค่าให้คัดลอกไปใส่ฝั่ง Curtain Flow ใช่ไหม?
