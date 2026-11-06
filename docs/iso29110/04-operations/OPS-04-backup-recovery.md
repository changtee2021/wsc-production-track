# OPS-04 การสำรองและการกู้คืน

| รายการ | ค่า |
| --- | --- |
| Document ID | OPS-04 |
| Document Title | การสำรองและการกู้คืน |
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
| 0.1 | 3 พฤศจิกายน 2026 | บันทึกวิธีที่มีในเอกสาร และบันทึกว่ายังไม่มีการซ้อม | PENDING HUMAN INPUT |

## Inventory

| รายการ | หลักฐาน | สถานะ |
| --- | --- | --- |
| สคริปต์สำรอง schema | `docs/WSC-MONDAY-GO-LIVE-TONIGHT.md` อ้าง `wp-group-erp/scripts/backup-erp-schemas.ps1` | สคริปต์อยู่นอก repo นี้ การมีไฟล์จริงเป็น NOT VERIFIED ในรอบนี้ |
| ไฟล์ผลสำรอง | เอกสารบอกชื่อ `wsc_production.sql` | ไม่พบใบวันที่ใน repo นี้ |

## Schedule

ไม่พบตารางสำรองอัตโนมัติใน repo นี้

## Procedure ตามเอกสารเดิม

รันสคริปต์สำรอง เก็บโฟลเดอร์ตามวันเวลา ถ้าข้อมูลพังให้นำเข้าไฟล์นั้นกลับ แล้วตรวจ health

## Recovery test

| วันที่ | ผู้ทำ | ผล |
| --- | --- | --- |
| | | NOT EXECUTED |

ห้ามสรุปว่ากู้คืนได้สำเร็จ

## Risks

RK-02 ใน PM-05
