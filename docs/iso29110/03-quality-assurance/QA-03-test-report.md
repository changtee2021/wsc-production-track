# QA-03 รายงานผลการทดสอบ

| รายการ | ค่า |
| --- | --- |
| Document ID | QA-03 |
| Document Title | รายงานผลการทดสอบ |
| Project Name | WSC Production Track |
| Version | 0.2 |
| Created Date | 3 พฤศจิกายน 2026 |
| Prepared By | ที่ปรึกษาจัดทำจากซอร์ส |
| Reviewed By | PENDING HUMAN INPUT |
| Approved By | PENDING HUMAN INPUT |
| Document Status | DRAFT |

## Revision History

| Version | Date | Description | Approved By |
| --- | --- | --- | --- |
| 0.1 | 3 พฤศจิกายน 2026 | บันทึกเฉพาะคำสั่งที่รันแล้ว | PENDING HUMAN INPUT |
| 0.2 | 3 พฤศจิกายน 2026 | เพิ่มรอบ `npm test` ที่สอง 24 ข้อ และแยกข้อที่ผ่านเพราะโหลดตัวจัดการคำขอไม่ได้ | PENDING HUMAN INPUT |

## Executed

| รายการ | ค่า |
| --- | --- |
| Command | `npm test` |
| Environment | เครื่องพัฒนาของ repo นี้ ไม่ได้ชี้ให้เทสเขียนฐานข้อมูล |
| Timestamp | 3 พฤศจิกายน 2026 |
| Passed | 16 |
| Failed | 0 |
| Skipped | 0 |
| Log | ผลบนคอนโซลของคำสั่ง ไม่ได้เก็บบันทึกไฟล์แยก |

คำสั่งนี้รัน `src/lib/scan-trial.test.ts`, `src/lib/utils/report-media-validation.test.ts`, `src/lib/utils/report-export.test.ts`

## Executed later the same day

| รายการ | ค่า |
| --- | --- |
| Command | `npm test` |
| Environment | เครื่องพัฒนาของ repo นี้ ไม่ได้ตั้งค่าเชื่อมฐานข้อมูลในเทส |
| Timestamp | 3 พฤศจิกายน 2026 รอบที่ 2 |
| Passed | 24 |
| Failed | 0 |
| Skipped | 0 |
| Log | ผลบนคอนโซลของคำสั่ง ไม่ได้เก็บบันทึกไฟล์แยก |

คำสั่งรอบนี้เพิ่ม `tests/integration/dept-token.test.ts` และ `tests/integration/handler-load.test.ts`

สี่ข้อของไฟล์หลังผ่านเพราะการ import ตัวจัดการคำขอถูกปฏิเสธด้วยข้อความ `Cannot find package '@/` ข้อเหล่านั้นไม่ใช่ผลว่า API สแกน QC หรือแพ็คทำงานถูกต้อง รายละเอียดอยู่ใน QA-07

## Not executed

| กลุ่ม | สถานะ | เหตุผล |
| --- | --- | --- |
| TC-F-01 ถึง TC-F-05 | NOT EXECUTED | ต้องใช้หน้างานหรือข้อมูลจำลองที่แยกจากข้อมูลผลิต แบบบันทึกอยู่ที่ QA-08 และยังไม่ได้กรอก |
| การกู้คืนฐานข้อมูล | NOT EXECUTED | มีแบบว่างที่ OPS-06 ยังไม่มีรอบที่กรอกแล้ว |
| `npm run build` ในรอบจัดเอกสารนี้ | NOT EXECUTED | ไม่ได้สั่ง build ซ้ำในรอบเขียนโฟลเดอร์ `docs/iso29110` |

ผล build ครั้งก่อนหน้าในงานอื่นไม่ถูกนำมาเขียนว่าผ่านในเอกสารนี้
