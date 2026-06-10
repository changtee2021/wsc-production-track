## เพิ่มระบบ Server Logs (จับ Internal Server Error ย้อนหลัง)

ลอกแพทเทิร์นจากโปรเจกต์ Curtain Flow มาปรับใช้กับ stack ของแอปนี้ (admin token แทน Supabase auth)

### Database
- migration ใหม่: `public.error_logs`
  - คอลัมน์: `id uuid pk`, `created_at`, `level` (error/warn), `source` (ssr/route/client/health), `route_path`, `message`, `stack`, `status_code`, `request_url`, `user_agent`, `notified_at`
  - index: `(created_at desc)`, `(level, created_at desc)`
  - RLS เปิด, นโยบาย service_role only (ทำผ่าน supabaseAdmin จาก server fn)
  - GRANT ให้ service_role
- บันทึก system_logs หลังย้าย migration

### Server-side error capture (ลอกจาก Curtain Flow)
สร้าง:
- `src/server.ts` — wrapper ครอบ `@tanstack/react-start/server-entry` + `normalizeCatastrophicSsrResponse` ตรวจจับ h3 swallowed 500 → log + render error page + `recordError`
- `src/lib/error-capture.ts` — globalThis listeners (`error`, `unhandledrejection`) เก็บ Error ล่าสุดให้ wrapper ดึงไปใช้
- `src/lib/error-page.ts` — HTML fallback dependency-free
- `src/lib/error-logs.server.ts` — `recordError()` insert ลง `error_logs` (clamp ความยาว, kill-safe)

แก้:
- `vite.config.ts` — เพิ่ม `tanstackStart: { server: { entry: "server" } }`
- `wrangler.jsonc` — `"main": "src/server.ts"`

### Server functions (admin-only ผ่าน admin token)
สร้าง `src/lib/features/error-logs.functions.ts`:
- `adminListErrorLogs({ token, days, level, source, search })` — query + filter + cleanup เก่ากว่า 30 วัน
- `adminRunSsrHealthCheck({ token })` — fetch หน้า `/`, `/scan`, `/feedback`, `/qc`, `/packing`, `/maintenance` ภายในเอง บันทึก fail
- `adminGetErrorLogStats({ token })` — นับ 24h สำหรับ badge

### หน้า UI
สร้าง `src/routes/_protected.server-logs.tsx`:
- Header + ปุ่ม "รันสุขภาพรูทหลัก"
- ฟิลเตอร์: ช่วงวัน (7/14/30) · ระดับ · แหล่ง · ค้นหา
- ตารางแสดงผล คลิกแถวเพื่อกางดู stack/url เต็ม
- ใช้ shadcn Card/Table/Badge/Select/Input + lucide icons

แก้:
- `src/components/AdminSidebar.tsx` — เพิ่มเมนู "Server Logs" (ScrollText icon)

### ทดสอบ
- เปิด `/server-logs` (หลัง login admin) → ตารางว่างได้
- กดปุ่ม "รันสุขภาพรูทหลัก" ดูสถานะแต่ละ route 200/500/ms
- (optional) สร้าง route ทดสอบโยน error เพื่อยืนยันว่าบันทึกลง `error_logs`

### ไฟล์ที่เพิ่ม/แก้
- เพิ่ม: migration, `src/server.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/error-logs.server.ts`, `src/lib/features/error-logs.functions.ts`, `src/routes/_protected.server-logs.tsx`
- แก้: `vite.config.ts`, `wrangler.jsonc`, `src/components/AdminSidebar.tsx`
