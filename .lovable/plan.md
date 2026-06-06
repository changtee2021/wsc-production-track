# รายงานตรวจสอบโค้ดทั้งโปรเจกต์

สแกนแล้ว 141 ไฟล์ TS/TSX, 67 dependencies, 26 route, 14 lib helper, 13 component
**ขอบเขตยกเว้น**: ไม่แตะส่วนข้อมูลพนักงาน/staff-directory (รักษาให้ทำงานต่อได้)

---

## 1) บั๊ก/ความเสี่ยง Security & RLS

### A. Database linter เตือน 12 รายการ
- **WARN 1** Function search_path mutable — มี DB function ที่ยังไม่ตั้ง `search_path` (`fn_touch_updated_at`)
- **WARN 2** Extension อยู่ใน schema `public`
- **WARN 3–6** Public buckets เปิด listing กว้าง (`avatars`, `step-images`, `banners`, `office-assets`) — ใครก็ list ไฟล์ทั้ง bucket ได้
- **WARN 7–12** SECURITY DEFINER functions เปิดให้ `anon`/`authenticated` เรียก execute โดยตรง (ควร REVOKE แล้วเรียกผ่าน server fn เท่านั้น)

### B. รูปแบบ auth ปัจจุบัน (ข้อสังเกต ไม่ใช่บั๊กเฉียบพลัน)
- ใช้ **password เดียวต่อแผนก** เก็บใน secrets (`ADMIN_PASSWORD`, `QC_PASSWORD`, `PACKING_PASSWORD`, `MAINTENANCE_PASSWORD`) + token เก็บใน `sessionStorage`
- ไม่ได้ผูกกับ Supabase Auth → ไม่มี per-user accountability, token ไม่หมดอายุชัดเจน
- **ดีแล้ว**: ไม่มี direct `supabase.from(...).insert/update/delete` จาก browser เลย — ทุก write ผ่าน server fn

### C. จุดอื่น
- ไฟล์ใหญ่มาก เสี่ยง regression: `_protected.dashboard.tsx` 1940 บรรทัด, `_protected.manage.tsx` 1365, `qc.tsx` 1064, `QrScannerDialog.tsx` 783
- console.log ค้างใน production code 3 จุด (QrScannerDialog, ai-admin.functions, line-notify.server)

---

## 2) ความซ้ำซ้อน / Dead code

### A. Session/token pattern ซ้ำ 6 ชุด (โครงสร้างเหมือนกันเป๊ะ)
ทุกแผนกมีไฟล์คู่ `*-session.ts` (client) + `*-token.server.ts` (server verify) เหมือนกันทุกบรรทัด ต่างแค่ `KEY` constant:
- admin / qc / packing / maintenance / expense / office
→ รวมเป็น **factory เดียว** `createDeptSession(key)` + `createDeptTokenVerifier(secret)` ลดได้ ~12 ไฟล์เหลือ 2

### B. ไฟล์ orphan (ไม่มีใคร import)
- `src/components/SlideToConfirm.tsx` (138 บรรทัด)
- `src/lib/download.ts`
→ ลบทิ้งได้

### C. Export pattern คล้ายกันใน `*-export.ts`
- `qc-export.ts`, `packing-export.ts` — อาจรวม helper ส่วน CSV/XLSX

---

## 3) จัดระเบียบโครงสร้าง

ปัจจุบัน `src/lib/` มี 41 ไฟล์ flat ปนกัน (sessions, tokens, server fns, helpers, AI tools, line, media) → อ่านยาก

แนะนำจัดเป็น sub-folders (ไม่บังคับ ขึ้นกับว่ายอมรับ rename หรือไม่):
```
src/lib/
  auth/        admin-session, *-token.server, dept-session factory
  features/    admin, qc, packing, maintenance, expense, office, scan (.functions.ts)
  integrations/line.*, media.*, worker-upload
  ai/          ai-admin.*, ai-admin-tools.server
  utils/       i18n, utils, log-seen, media-compress, media-zip, exports
```

### Route ใหญ่ที่ควรซอย
- `_protected.dashboard.tsx` 1940 → แยกเป็น tabs/sections (charts, leaderboard, filters, exports)
- `_protected.manage.tsx` 1365 → แยกตามแท็บ (categories, employees, steps, dept-employees)
- `qc.tsx` 1064 → แยก form/list/upload
- `QrScannerDialog.tsx` 783 → แยก hook สแกน + UI dialog

---

## 4) ของที่ "ดีอยู่แล้ว" ไม่ต้องแตะ
- ไม่มี direct browser write ไป DB
- ทุก server fn ที่ดูใช้ zod validate input
- มี `system_logs` audit + memory rule แล้ว
- Private buckets (qc-media, log-notes, packing-media, maintenance-media, expense-receipts) ใช้ signed URL

---

## ขั้นถัดไป — เลือกได้ว่าให้แก้ส่วนไหน (ทำทีละชุด)

| # | กลุ่มงาน | ความเสี่ยง | ผลกระทบ |
|---|---|---|---|
| **A** | Fix DB linter ทั้ง 12 ข้อ (search_path, REVOKE EXECUTE, bucket listing) | ต่ำ–ปานกลาง | ปลอดภัยขึ้น ไม่กระทบ UX |
| **B** | ลบ orphan + console.log + dead code | ต่ำมาก | สะอาดขึ้น |
| **C** | รวม session/token 12 ไฟล์ → factory 2 ไฟล์ | ต่ำ (ต้องเทสล็อกอินทุกแผนก) | โค้ดลด ~80% ในส่วนนี้ |
| **D** | จัดโฟลเดอร์ `src/lib/` ใหม่ | ปานกลาง (import path เปลี่ยนเยอะ) | อ่านง่ายขึ้นถาวร |
| **E** | ซอย route ใหญ่ (dashboard, manage, qc, QrScanner) | ปานกลาง–สูง | บำรุงรักษาดีขึ้น แต่ diff เยอะ |

**คำแนะนำ**: เริ่มจาก A + B (เสี่ยงต่ำ ผลชัด) → ค่อยทำ C → ค่อย D/E ถ้ายังต้องการ

โปรดบอกว่าจะให้เริ่มชุดไหน (เลือกได้หลายตัว เช่น "A+B" หรือ "ทั้งหมด ทำเป็น migration หลายรอบ")
