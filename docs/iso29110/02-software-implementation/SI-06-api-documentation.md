# SI-06 API และการเชื่อมต่อ

| รายการ | ค่า |
| --- | --- |
| Document ID | SI-06 |
| Document Title | API และการเชื่อมต่อ |
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
| 0.1 | 3 พฤศจิกายน 2026 | บัญชีจากไฟล์ route ไม่มีค่าความลับ | PENDING HUMAN INPUT |

เอกสารนี้ไม่ใส่ค่าคีย์หรือรหัสผ่าน

| Path | Method | การตรวจสิทธิ์ที่อ่านได้ | หน้าที่ | หลักฐาน |
| --- | --- | --- | --- | --- |
| `/api/public/health` | GET | ไม่พบการตรวจความลับในไฟล์ | คืน ok และชื่อบริการ | `src/routes/api/public/health.ts` |
| `/api/public/production-intake` | POST | เฮดเดอร์ `x-intake-signature` เป็น HMAC ของเนื้อข้อความ | รับงานจาก backoffice | `production-intake.ts` |
| `/api/public/curtain-flow/jobs` | GET, POST | เฮดเดอร์ `X-API-Key` | รับหรืออ่านงานจาก Curtain Flow | `curtain-flow/jobs.ts` |
| `/api/public/stock-count/reports` | GET, OPTIONS | เฮดเดอร์ `x-wsc-secret` | ให้ระบบภายนอกอ่านรายงานนับสต๊อก | `stock-count.reports.ts` |
| `/api/public/hooks/line-daily-send` | POST | เฮดเดอร์ `apikey` หรือ Bearer เทียบกับคีย์ที่ตั้งในสภาพแวดล้อม | จุดให้งานตามเวลาเรียกสรุปรายวัน | `hooks/line-daily-send.ts` |
| `/api/public/migration-export` | GET | เฮดเดอร์ `x-wsc-secret` | ตัวช่วยส่งออกตารางตอนย้ายระบบ ตามคอมเมนต์ในไฟล์ | `migration-export.ts` |

รายงานนับสต๊อกตั้ง `access-control-allow-origin` เป็น `*` ในไฟล์นั้น ผู้ตรวจความปลอดภัยควรยืนยันว่าเหมาะสม สถานะการตัดสินเป็น NOT VERIFIED

Server function ของหน้าเว็บไม่ได้ยกมาทุกตัวในตารางนี้ บัญชีนั้นอยู่ที่ไฟล์ใต้ `src/lib/features/` และแต่ละตัวใช้ตัวตรวจของแผนกนั้น

โครง request ของ intake และ curtain flow อยู่ใน zod ของไฟล์ต้นทาง ไม่คัดลอกตัวอย่างข้อมูลลูกค้า
