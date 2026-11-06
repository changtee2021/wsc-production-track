# PM-07 การจัดการโครงแบบ

| รายการ | ค่า |
| --- | --- |
| Document ID | PM-07 |
| Document Title | การจัดการโครงแบบ |
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
| 0.1 | 3 พฤศจิกายน 2026 | บันทึกของที่อยู่ใน Git และไฟล์ตั้งค่า | PENDING HUMAN INPUT |

## Configuration Items

| รายการ | ที่อยู่ | รุ่นที่อ้างได้ตอนสำรวจ |
| --- | --- | --- |
| ซอร์สแอป | repo นี้ | HEAD `8951f84` และ working tree ที่ยังไม่ commit 17 รายการ |
| เอกสาร ISO ชุดนี้ | `docs/iso29110/` | 0.1 วันที่ 3 พ.ย. 2026 |
| Dependencies | `package.json` และ lockfile | NOT VERIFIED ว่า lock ตรงกับเครื่อง build ล่าสุด |
| Schema ที่โค้ดชี้ | `VITE_SUPABASE_SCHEMA` / `SUPABASE_SCHEMA` | ค่าเริ่มต้น `wsc_production` |
| โฮสต์ | `vercel.json` | region `sin1`, build ใช้หน่วยความจำ 8192 MB |

## Branch

พบ merge pull request ในประวัติวันที่ 3 พ.ย. 2026 จึงมีหลักฐานว่าใช้ pull request อย่างน้อยในวันนั้น นโยบายสาขาถาวรเป็น **NOT VERIFIED** เพราะไม่ได้เปิดเอกสารนโยบายสาขา

## Release

ไม่มีแท็ก Git ที่รอบนี้ตรวจว่าเป็นรุ่นส่งมอบ การเรียกเอกสารนี้ว่า baseline ที่ปิดแล้วยังทำไม่ได้ จนกว่าจะมี commit ของชุดเอกสารและผู้มีอำนาจรับรุ่นนั้น

## Backup

วิธีที่เอกสาร go-live เขียนคือสคริปต์ `wp-group-erp/scripts/backup-erp-schemas.ps1` แล้วเก็บ `wsc_production.sql`

การรันสคริปต์นั้นเป็น **NOT VERIFIED** ในรอบสำรวจนี้ ไม่พบใบวันที่สำรองใน repo
