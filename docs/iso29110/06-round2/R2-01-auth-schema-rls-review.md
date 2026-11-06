# R2-01 ตรวจ Authentication, สิทธิ์ฝั่งเซิร์ฟเวอร์, สคีมา และ RLS

| รายการ | ค่า |
| --- | --- |
| Document ID | R2-01 |
| Document Title | ผลตรวจอ่านซอร์สเรื่องการยืนยันตัวตน สิทธิ์ สคีมา และ RLS |
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
| 0.1 | 3 พฤศจิกายน 2026 | อ่านซอร์สและไฟล์ migration เท่านั้น ไม่ได้แก้โค้ดและไม่ได้สอบถามฐานข้อมูลจริง | PENDING HUMAN INPUT |

รอบนี้ไม่ได้เชื่อมต่อฐานข้อมูล ไม่ได้รัน SQL และไม่ได้แก้แอป ข้อความด้านล่างเป็นสิ่งที่อ่านจากไฟล์ได้ สิ่งที่มีผลบนฐานจริงยังเป็น NOT VERIFIED

## สิ่งที่อ่านได้จากซอร์ส

| หัวข้อ | หลักฐาน | ข้อสรุปจากไฟล์ |
| --- | --- | --- |
| โครงแอดมิน | `src/routes/_protected.tsx` บรรทัด 16–24 | `beforeLoad` ตรวจ `isAdminSession()` เฉพาะเมื่อ `window` มีค่า การเรนเดอร์ฝั่งเซิร์ฟเวอร์ไม่ถูกเงื่อนไขนี้กัน |
| เซสชันแอดมิน | `src/lib/auth/admin-session.ts` | เก็บโทเคนใน `sessionStorage` คีย์ `ptrack_admin_token` เป็นการตรวจฝั่งเบราว์เซอร์ |
| โทเคน QC และแพ็ค | `src/lib/auth/dept-token.server.ts`, `qc-token.server.ts` | โทเคนเป็น HMAC มีเวลาหมดอายุ ฟังก์ชัน QC และแพ็คเรียก `verifyQcToken` หรือ `verifyPackingToken` ก่อนทำงาน |
| ฟังก์ชันแอดมินส่วนใหญ่ | ไฟล์ใน `src/lib/features/` ที่เรียก `verifyAdminToken` | มีการตรวจโทเคนฝั่งเซิร์ฟเวอร์ในฟังก์ชันที่อ่านพบ |
| บันทึกสแกน | `src/lib/features/scan.functions.ts` | `submitProductionLog` ไม่เรียกตัวตรวจโทเคน ตรวจแค่รหัสพนักงาน ขั้นตอน และหมวดที่ยังใช้งาน แล้วจำกัดจำนวนส่งต่อ IP ในหน่วยความจำ |
| ไคลเอนต์ฐานข้อมูลของเซิร์ฟเวอร์ | `src/integrations/supabase/client.server.ts` | คอมเมนต์ในไฟล์ระบุว่าใช้ service role และข้าม RLS สคีมาที่ส่งให้ไคลเอนต์มาจาก `SUPABASE_SCHEMA` |
| สคีมาเริ่มต้นในโค้ด | `src/lib/erp-config.ts` | ถ้าไม่ตั้งค่า env ค่าเริ่มต้นคือ `wsc_production` รหัสโปรเจกต์ในไฟล์คือ `erpzxusskbtdxvqadwxv` |
| ชนิดตารางที่สร้างอัตโนมัติ | `src/integrations/supabase/types.ts` | กุญแจสคีมาในไฟล์ชนิดคือ `public` ไม่ใช่ `wsc_production` |
| นโยบายในไฟล์ migration | `supabase/migrations/*.sql` | นโยบายส่วนใหญ่สร้างบน `public.*` มีดัชนีหนึ่งรายการบน `wsc_production.production_logs` ใน `20261013100000_production_logs_created_at_index.sql` |

## ข้อขัดแย้งที่พบ

| รหัส | ข้อขัดแย้ง | ผลต่อการยื่น |
| --- | --- | --- |
| C-AUTH-01 | หน้าในกลุ่ม `_protected` กันที่เบราว์เซอร์ ขณะที่การเขียนข้อมูลใช้ service role ซึ่งข้าม RLS | ต้องมีคนตรวจว่าทุกเส้นทางเขียนข้อมูลมีการตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ก่อนถึงฐาน |
| C-AUTH-02 | QC และแพ็คตรวจโทเคน HMAC ก่อนบันทึก แต่ `submitProductionLog` ไม่ตรวจโทเคนแบบเดียวกัน | ช่องนี้ยังเปิดเป็นการตรวจจากซอร์ส ไม่ได้พิสูจน์ด้วยการยิงคำขอจริง |
| C-SCHEMA-01 | โค้ดรันชี้สคีมา `wsc_production` แต่ไฟล์ชนิดและ migration ส่วนใหญ่พูดถึง `public` | แคตตาล็อกที่มีผลบนฐานจริงยังเป็น NOT VERIFIED |
| C-RLS-01 | migration แรกสร้างนโยบาย `Anyone can insert production logs` บน `public.production_logs` และในรอบนี้อ่านไม่พบคำสั่ง DROP ของนโยบายนี้ | นโยบายที่มีผลจริงยังเป็น NOT VERIFIED แม้ไฟล์ประวัติจะยังเปิดทาง INSERT |
| C-RLS-02 | `20260519034647_fe11d646-aefa-4978-8581-06db3c321170.sql` เขียนเองว่าการเขียน QC ผ่าน `supabaseAdmin` ซึ่งข้าม RLS และใส่ restrictive policy กัน anon บน `public` | ไฟล์บอกเจตนา แต่ไม่ได้พิสูจน์ว่านโยบายเดียวกันมีอยู่บน `wsc_production` |

## API สาธารณะที่อ่านจากไฟล์

| เส้นทาง | การตรวจในไฟล์ | สถานะการยิงจริง |
| --- | --- | --- |
| `GET /api/public/health` | ไม่มีรหัสลับ คืนสถานะบริการ | NOT EXECUTED ในรอบนี้ |
| `POST /api/public/production-intake` | HMAC `x-intake-signature` กับ `PRODUCTION_INTAKE_SECRET` | NOT EXECUTED |
| `GET` และ `POST` curtain-flow jobs | `X-API-Key` เทียบ `CURTAIN_FLOW_API_KEY` | NOT EXECUTED |
| stock-count reports และ migration-export | เฮดเดอร์ `x-wsc-secret` | NOT EXECUTED |
| line daily send | `apikey` หรือ Bearer | NOT EXECUTED |

รอบนี้ไม่ได้คัดลอกรหัสลับจาก `.env` มาไว้ในเอกสาร

## สิ่งที่รอบนี้ไม่ได้ทำ

- ไม่ได้แก้ฟังก์ชันสแกน QC แพ็ค หรือเส้นทางแอดมิน
- ไม่ได้สร้างหรือรัน migration
- ไม่ได้เปิดแคตตาล็อก `pg_policies` ของฐานจริง
- ไม่ได้สรุปว่านโยบายในไฟล์คือสิ่งที่ฐานผลิตใช้อยู่
