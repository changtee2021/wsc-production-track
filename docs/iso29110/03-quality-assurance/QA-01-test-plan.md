# QA-01 แผนทดสอบ

| รายการ | ค่า |
| --- | --- |
| Document ID | QA-01 |
| Document Title | แผนทดสอบ |
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
| 0.1 | 3 พฤศจิกายน 2026 | แผนตามของที่มีเทส และของที่ยังไม่รัน | PENDING HUMAN INPUT |

## Strategy

ทดสอบกฎที่แยกจากฐานข้อมูลด้วย `npm test` ทดสอบการบันทึกจริงเฉพาะในสภาพแวดล้อมที่ไม่ได้เขียนทับข้อมูลผลิต ตอนนี้ยังไม่มีสภาพแวดล้อมนั้นในเอกสารนี้

## In scope now

| แบบ | เป้าหมาย | วิธี |
| --- | --- | --- |
| หน่วย | กฎสแกนทดลอง กฎส่งรายงาน QC และแพ็ค ข้อความ CSV | `npm test` |
| ระบบบนพื้นงาน | สแกนหนึ่งงาน รายงาน QC หนึ่งใบ รายงานแพ็คหนึ่งใบ | คนทำงานทำแล้วบันทึกใน QA-03 |
| สิทธิ์ | แอดมินและแต่ละแผนกเข้าได้เฉพาะบทบาทตน | ACTION REQUIRED |
| รับงานจากระบบอื่น | intake และ curtain flow | ใช้ข้อมูลจำลอง คนละฐานกับของใช้จริง |

## Out of scope of the last run

การ insert จริงลง `production_logs`, `qc_reports`, `packing_reports` ไม่ได้อยู่ใน `npm test`

## Regression

รัน `npm test` ทุกครั้งก่อนแก้กฎใน `scan-trial.ts` หรือ `report-media-validation.ts`

## User acceptance

ทำหลัง QA-02 ที่เกี่ยวกับงานจริงมีผลรัน และผู้ใช้ลงนามใน PM-08
