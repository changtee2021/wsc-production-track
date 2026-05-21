# แผน: เพิ่มแผนก "แพ็คของ" (Packing) — ฟีเจอร์ชุดเดียวกับ QC

จะคัดลอกโครงสร้างของ QC ทั้งหมดมาเป็นแผนก "แพ็คของ" แบบขนานกัน (ไม่กระทบของเดิม)

## 1) Database (migration)
สร้างตารางและบัคเก็ตใหม่ขนานกับ QC:
- `packing_employees` — พนักงานแพ็ค (id, name, emp_code, avatar_url, active)
- `packing_checklists` — รายการเช็คลิสต์ตาม category (id, category_id, item_text, item_order, is_active)
- `packing_reports` — รายงานการแพ็ค (job_id, packing_employee_id, production_log_id, step_id, category_id, employee_id, note, media jsonb, overall_result, summary, status)
- `packing_report_items` — ข้อย่อยในรายงาน (qc_report_id เทียบเป็น packing_report_id, checklist_id, item_text_snapshot, item_order, is_passed, result_tag, remark, media)
- Storage bucket ใหม่ `packing-media` (private) — โครงสร้าง policy เหมือน `qc-media`
- RLS: บล็อก anon/auth ทั้งหมด เข้าผ่าน server function ด้วย admin client เท่านั้น (เหมือน QC)
- Secret ใหม่: `PACKING_PASSWORD` (จะขอจากผู้ใช้ก่อนเริ่มทำ migration)

## 2) Server functions และ helpers
- `src/lib/packing-token.server.ts` — issue/verify token + check password (clone จาก qc-token.server.ts)
- `src/lib/packing.functions.ts` — clone จาก `qc.functions.ts` ทุก endpoint:
  - `verifyPackingPassword`, `checkPackingToken`
  - `packingFetchJobLogs`, `packingFetchChecklist`
  - `packingSubmitReport`, `packingListEmployees`
  - `packingUploadMedia` (ใช้ bucket `packing-media`)
- `src/lib/packing-session.ts` — เก็บ token ฝั่ง client (clone qc-session.ts)
- `src/lib/packing-export.ts` — CSV export (clone qc-export.ts)
- ขยาย `src/lib/admin.functions.ts`:
  - `adminFetchPackingReports`, `adminFetchPackingSummary`
  - CRUD: `adminListPackingEmployees/Upsert/Delete`, `adminListPackingChecklists/Upsert/Delete`
  - เพิ่มข้อมูล packing เข้า `adminFetchJobDetail` ของ Job Lookup ด้วย

## 3) หน้าใหม่ (routes)
- `src/routes/packing.tsx` — หน้าทำงานของพนักงานแพ็ค: ล็อกอินรหัสผ่าน → เลือกตัวเอง → สแกน/กรอก Job ID → ดู logs → เลือก step/category → ทำ checklist (ผ่าน / ไม่ผ่าน / มอเตอร์) → แนบรูป/วิดีโอ → บันทึก  
  (clone โครงจาก `src/routes/qc.tsx` ทั้งหน้า)
- `src/routes/_protected.packing-reports.tsx` — รายงานแพ็คของ (clone `_protected.qc-reports.tsx` รวมการ์ดหุบ/กางและ filter ช่วงวันที่)
- `src/routes/_protected.packing-summary.tsx` — สรุปแพ็คของ (clone `_protected.qc-summary.tsx`)

## 4) หน้า "จัดการข้อมูล" (`_protected.manage.tsx`)
เพิ่ม 2 แท็บใหม่ใต้แท็บของ QC:
- **พนักงานแพ็คของ** — CRUD `packing_employees` (เหมือนแท็บพนักงาน QC)
- **Checklist แพ็คของ** — CRUD `packing_checklists` ต่อหมวด (ใช้ `QcChecklistsPanel` เป็นแม่แบบ → สร้าง `PackingChecklistsPanel.tsx`)

## 5) Navigation & Job Lookup
- `AdminSidebar.tsx`: เพิ่มเมนู "รายงานแพ็คของ" และ "สรุปแพ็คของ" ใต้กลุ่ม QC (หรือกลุ่มใหม่ "แพ็คของ")
- `src/routes/index.tsx` / หน้า scan: เพิ่มทางเข้าหน้า `/packing` ข้างปุ่ม QC
- `_protected.job-lookup.tsx`: แสดงรายงานแพ็คของของ job นั้นเพิ่มเติม (timeline + การ์ดหุบ/กาง รูปแบบเดียวกับ QC)

## 6) System logs
INSERT แถวลง `public.system_logs` สรุปการเพิ่มแผนก "แพ็คของ" พร้อม paths ที่แก้/สร้าง

---

## คำถามก่อนเริ่ม
1. **รหัสผ่านเข้าหน้าแพ็คของ** — ใช้รหัสเดียวกับ QC, ใช้รหัสเดียวกับ Admin, หรือสร้าง secret ใหม่ `PACKING_PASSWORD`?
2. **ปุ่มในเช็คลิสต์** — ใช้ ผ่าน/ไม่ผ่าน/มอเตอร์ เหมือน QC ทุกอย่าง หรือสำหรับแพ็คของให้เป็น ผ่าน/ไม่ผ่าน เฉยๆ (ไม่มีมอเตอร์)?
3. **เมนูใน Sidebar** — รวมไว้ใต้กลุ่ม QC, หรือสร้างกลุ่มใหม่ "แพ็คของ" แยกจาก QC?
4. **แชร์ checklist กับ QC ไหม** — แยกตารางคนละชุด (แผนแนะนำ) หรือใช้ตาราง `qc_checklists` ร่วมกันโดยเพิ่ม column `dept`?
