# 01 การสำรวจระบบ

| รายการ | ค่า |
| --- | --- |
| Document ID | DISC-01 |
| Document Title | การสำรวจระบบ |
| Project Name | WSC Production Track |
| Version | 0.1 |
| Created Date | 3 พฤศจิกายน 2026 |
| Prepared By | ที่ปรึกษาจัดทำจากซอร์ส |
| Reviewed By | PENDING HUMAN INPUT |
| Approved By | PENDING HUMAN INPUT |
| Document Status | DRAFT |

## Revision History

| Version | Date | Description | Approved By |
| --- | --- | --- | --- |
| 0.1 | 3 พฤศจิกายน 2026 | ร่างจากซอร์สที่อ่านได้ ไม่มีการอนุมัติ | PENDING HUMAN INPUT |

## 1. สรุปที่ตรวจได้

WSC Production Track เป็นเว็บแอปติดตามงานผลิตและงานสนับสนุนในโรงงาน เขียนด้วย TypeScript บน TanStack Start และ React ข้อมูลอยู่ที่ Supabase โปรเจกต์ `erpzxusskbtdxvqadwxv` schema ที่โค้ดกำหนดค่าเริ่มต้นคือ `wsc_production`

หลักฐาน: `package.json`, `src/lib/erp-config.ts`, `.env.example` (ชื่อตัวแปรเท่านั้น), `docs/DEPLOY-VERCEL.md`, `vercel.json`

## 2. คลังโค้ด

| หัวข้อ | สิ่งที่ตรวจได้ | หลักฐาน |
| --- | --- | --- |
| Remote | `changtee2021/wsc-production-track` | `git remote` |
| Commit แรก | `929a9a4` วันที่ 1 ม.ค. 2025 ข้อความ `template: tanstack_start_ts` | `git rev-list` |
| HEAD ตอนสำรวจ | `8951f84` วันที่ 3 พ.ย. 2026 | `git log -1` |
| Working tree | มีรายการที่ยังไม่ commit 17 รายการ | `git status --short` นับจำนวน |

วันที่เริ่มโครงการธุรกิจจริงเป็น **NOT VERIFIED** commit แรกเป็นเทมเพลต ไม่ใช่หลักฐานวันสั่งงาน

## 3. เทคโนโลยี

| ชั้น | สิ่งที่พบ |
| --- | --- |
| ภาษา | TypeScript |
| UI | React 19 |
| เฟรมเวิร์ก | TanStack Start / TanStack Router, Vite 7 |
| ข้อมูล | `@supabase/supabase-js` schema จาก `SUPABASE_SCHEMA` |
| ตรวจรูปแบบข้อมูล | zod |
| โฮสต์ที่เอกสาร deploy ระบุ | Vercel region `sin1`, preset Nitro `vercel` |
| ทดสอบอัตโนมัติ | `npm test` ใช้ `node --test` สามไฟล์ |

หลักฐาน: `package.json`, `vercel.json`, `src/integrations/supabase/client.server.ts`

## 4. สถาปัตยกรรมที่ย่อได้จากโค้ด

- หน้าแอดมินอยู่ใต้ route `_protected` และตรวจโทเคนใน `sessionStorage` ฝั่งเบราว์เซอร์ก่อนเข้า (`src/routes/_protected.tsx`, `src/lib/auth/admin-session.ts`)
- หน้างาน เช่น สแกน QC แพ็ค มีโทเคนแยกตามแผนกใน `src/lib/auth/`
- ฟังก์ชันที่เขียนข้อมูลใช้ server function และ `supabaseAdmin`
- มี API สาธารณะใต้ `src/routes/api/public/`

การตรวจสิทธิ์บนเซิร์ฟเวอร์ของทุกหน้าแอดมินเป็น **NOT VERIFIED** ทั้งชุด โค้ดที่อ่านได้ของ `_protected` ตรวจเซสชันเมื่อมี `window`

## 5. ข้อมูล

`src/integrations/supabase/types.ts` วางตารางไว้ใต้คีย์ `public` ขณะที่ไคลเอนต์ตั้ง schema จากตัวแปรสภาพแวดล้อม ค่าเริ่มต้น `wsc_production`

**Conflict:** ชื่อ schema ในไทป์กับชื่อ schema ตอนรันไม่ใช่คีย์เดียวกัน การมีตารางครบใน schema `wsc_production` จริงเป็น **NOT VERIFIED** เพราะรอบนี้ไม่ได้สอบถามฐานข้อมูล

ตารางที่ไทป์ระบุและเกี่ยวกับการผลิตโดยตรง ได้แก่ `employees`, `categories`, `steps`, `production_logs`, `production_jobs`, `production_standards`, `qc_reports`, `qc_report_items`, `packing_reports`, `packing_report_items`, `scan_trial_releases`

## 6. การเชื่อมระบบ

| การเชื่อม | สิ่งที่ตรวจได้ | สถานะการใช้งานจริง |
| --- | --- | --- |
| รับงานจาก wsc-backoffice | `POST /api/public/production-intake` ตรวจลายเซ็น HMAC ชื่อเฮดเดอร์ `x-intake-signature` | เส้นทางมีในโค้ด ว่าเรียกสำเร็จทุกวันเป็น NOT VERIFIED |
| LINE | ชื่อตัวแปร `LINE_CHANNEL_ACCESS_TOKEN` และ route `api/public/hooks/line-daily-send` | NOT VERIFIED ว่าส่งจริง |
| สุขภาพระบบ | `GET /api/public/health` คืน `ok`, `service`, `timestamp` | โค้ดมี ผลเรียกตอนเขียนเอกสารนี้เป็น NOT VERIFIED |
| Curtain Flow | `api/public/curtain-flow/jobs.ts` และชื่อตัวแปร `CURTAIN_FLOW_API_KEY` | NOT VERIFIED |

ห้ามคัดลอกค่าใน `.env.example` เข้าเอกสารนี้ มีชื่อตัวแปรรหัสผ่านและคีย์หลายตัว เอกสารนี้เก็บเฉพาะชื่อ

## 7. การทดสอบที่มีอยู่

คำสั่ง `npm test` รันสามไฟล์:

- `src/lib/scan-trial.test.ts`
- `src/lib/utils/report-media-validation.test.ts`
- `src/lib/utils/report-export.test.ts`

ผลรันในเครื่องวันที่ 3 พ.ย. 2026: 16 ผ่าน 0 ไม่ผ่าน ไม่เขียนฐานข้อมูล รายละเอียดอยู่ใน `QA-03`

ไม่มีเทสที่พิสูจน์การ insert ลง `production_logs`, `qc_reports` หรือ `packing_reports`

## 8. เอกสารเดิมใน repo

| ไฟล์ | สิ่งที่ใช้ได้ | ข้อจำกัด |
| --- | --- | --- |
| `docs/WSC-MONDAY-GO-LIVE-TONIGHT.md` | ระบุ URL ปลายทางและแผนคืน 13–14 มิ.ย. 2026 | ช่องตรวจในไฟล์ยังไม่ถูกติ๊ก จึงสรุปว่าขึ้นจริงแล้วไม่ได้ |
| `docs/DEPLOY-VERCEL.md` | ขั้นตอน build และชื่อ schema | ไม่มีเลข deployment |
| `docs/ERP-CUTOVER.md`, `docs/WSC-CUTOVER-PREP.md`, `docs/WSC-API-MIGRATION.md`, `docs/VIDEO-CONVERT.md` | มีอยู่ในคลัง | รอบนี้ไม่ได้ตรวจทุกประโยคว่าตรงโค้ดปัจจุบัน |

## 9. สิ่งที่ยังไม่พบ

- ลายเซ็นอนุมัติขอบเขตหรือรับมอบ
- ใบประชุม
- ตัวเลขชั่วโมงหรือต้นทุน
- ใบสำรองข้อมูลรายครั้งและผลซ้อมกู้คืน
- ชุดเทสของเส้นทางเขียนฐานข้อมูล
- ฉบับเต็มของ ISO/IEC 29110-5-1-2:2025 ใน repo นี้ ดังนั้นการจับคู่มาตรฐานใน `AUDIT-01` เป็นการจับคู่เบื้องต้น
