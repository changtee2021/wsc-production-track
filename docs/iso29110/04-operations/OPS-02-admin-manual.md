# OPS-02 คู่มือผู้ดูแล

| รายการ | ค่า |
| --- | --- |
| Document ID | OPS-02 |
| Document Title | คู่มือผู้ดูแล |
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
| 0.1 | 3 พฤศจิกายน 2026 | เฉพาะของที่มีหน้าจอหรือไฟล์ตั้งค่า | PENDING HUMAN INPUT |

## Configuration

ชื่อตัวแปรที่แอปอ่านอยู่ใน `.env.example` และ `docs/DEPLOY-VERCEL.md` ค่าไม่ถูกคัดลอกมาที่นี่

schema ที่ต้องตรงกันคือ `VITE_SUPABASE_SCHEMA` และ `SUPABASE_SCHEMA`

## User administration

หน้า `/manage` เป็นจุดจัดการพนักงานตามเมนู ขั้นตอนเพิ่มคนทีละฟิลด์เป็น NOT VERIFIED ในรอบนี้

## Permissions

แต่ละแผนกมีไฟล์โทเคนใน `src/lib/auth/` การเปลี่ยนรหัสทำที่ตัวแปรสภาพแวดล้อมของโฮสต์ ไม่มีหน้าในแอปที่รอบนี้ยืนยันว่าแก้รหัสได้อย่างปลอดภัย

## Errors

หน้า `/server-logs` อยู่ในเมนู ตาราง `error_logs` อยู่ในไทป์ ความครบของ log เป็น NOT VERIFIED

## Backup and monitoring

วิธีสำรองอยู่ใน OPS-04 หน้า `/storage` เป็นหน้าพื้นที่ไฟล์ตามชื่อเมนู ไม่ใช่หน้ากดสำรองฐานข้อมูล

## สิ่งที่ยังไม่พัฒนาเป็นคู่มือ

นโยบายสิทธิ์แบบบทบาทในฐานข้อมูลยังไม่ได้ตรวจจากเซิร์ฟเวอร์ฐานข้อมูล จึงไม่เขียนขั้นตอนให้สิทธิ์ RLS
