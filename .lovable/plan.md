
# แผนตรวจสอบบัคก่อนอัปเดต

ทำเป็น 4 เฟส ไล่จากเร็ว→ช้า เพื่อกรองปัญหาเป็นชั้น ๆ ไม่แก้โค้ดในเฟสตรวจ — รวบรวมรายการ bug แล้วค่อยขออนุมัติเฟสแก้

## เฟส 1 — Static analysis (เร็วสุด)
สแกนทั้งโปรเจกต์โดยไม่รันแอป:
- `bunx tsc --noEmit` — หา type error / import ที่หาไฟล์ไม่เจอ / โค้ดที่หลงเหลือจาก R.07
- `bunx eslint .` — หา unused imports, hooks deps ผิด, dead code
- `rg` หา anti-pattern ที่รู้แล้วว่ามักหลุด:
  - `useEffect` + `fetch` (ควรเป็น loader/serverFn)
  - `Link to="/employee-profile` ที่ยังหลงเหลือ (ต้องเปลี่ยนเป็น popup hook หมดแล้ว)
  - `process.env` ที่ module scope ใน shared file
  - `client.server` ถูก import จาก client-reachable file
  - `console.log` / `TODO` / `FIXME` ค้าง
- `supabase--linter` — เช็ค RLS / policy / GRANT
- เปิด `production-export.ts`, `EmployeeProfileDialog.tsx`, `EmployeeProfileProvider.tsx`, `_protected.production-dashboard.tsx`, `_protected.production-standards.tsx`, `production-monitor.functions.ts`, `employee-profile.functions.ts` อ่านเทียบ logic

## เฟส 2 — R.07 feature audit
อ่านโค้ดฟีเจอร์ใหม่และตรวจรายจุด:

**Production Standards (tabs per category)**
- ตรวจ default category, การจัดการ dirty state, validation ค่าที่ติดลบ/ว่าง
- ปุ่ม "save all in category" rollback ตอน error ถูกไหม

**Production Dashboard (Live + Historical)**
- `adminGetProductionHistory`: range custom/year ขอบเขตวันถูกต้องหรือไม่, timezone (เดิมมี TODO เรื่อง UTC vs TH)
- ตัวกรอง category_id ส่งเป็น 0/null สลับกันไหม (เห็นใน network log ส่ง `"category_id": 0`)
- Pairing logs ใน historical กับ live ใช้ logic เดียวกันไหม
- Export CSV (BOM, encoding ภาษาไทย) + XLSX (multi-sheet, header)

**Employee Profile Popup**
- Provider mount ครั้งเดียวใน `_protected.tsx` — ถูก
- `useOpenEmployeeProfile()` fallback no-op ตอนใช้นอก provider เงียบเกินไป (ควร console.warn)
- ตรวจหน้า: `manage`, `qc-reports`, `packing-reports`, `AllStaffPanel` ว่าคลิกเปิด popup จริง
- ตรวจ DialogContent ว่ามี `<DialogDescription>` (console.warn อยู่)
- Export รายงานจาก popup ทำงาน

**Logging / Version**
- `version.ts` = R.07 ✓
- มี row ใน `system_logs` สำหรับ R.07 หรือยัง — ตรวจด้วย `supabase--read_query`

## เฟส 3 — Browser smoke test
ใช้ `browser--view_preview` เปิดทีละหน้าและทำ smoke flow:
1. `/production-standards` → สลับ tab หมวด, แก้ค่า, save
2. `/production-dashboard` → toggle Live↔Historical, สลับ range (day/week/month/year/custom), เลือก category, กด Export CSV + XLSX
3. `/manage` → กดชื่อพนักงาน → popup เปิด → ปิด → กดชื่ออื่นซ้ำ (ตรวจ memory leak / state stuck)
4. `/qc-reports` + `/packing-reports` → กดชื่อในรายงานเปิด popup
5. เก็บ console + network ทุกหน้า เช็ค 4xx/5xx

## เฟส 4 — Console warnings
- `DialogContent` missing Description → เพิ่ม `<DialogDescription>` (sr-only ก็ได้)
- Recharts width=-1 height=-1 → container ไม่มี min-height ตอน data ว่าง (น่าจะอยู่ใน production-dashboard ส่วน PieChart)

## ผลลัพธ์
ผมจะสรุปผลรวมเป็นรายการ bug จัดลำดับ (critical / high / medium / low / cosmetic) แต่ละข้อระบุ:
- ไฟล์ + บรรทัด
- อาการ
- ข้อเสนอวิธีแก้
- ผลกระทบ

แล้วรอ user อนุมัติว่าจะให้แก้ข้อไหนบ้าง (จะแก้รวดเดียวทุกข้อ หรือเฉพาะ critical/high)
