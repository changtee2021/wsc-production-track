# SI-01 ข้อกำหนดซอฟต์แวร์

| รายการ | ค่า |
| --- | --- |
| Document ID | SI-01 |
| Document Title | ข้อกำหนดซอฟต์แวร์ |
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
| 0.1 | 3 พฤศจิกายน 2026 | สกัดจากพฤติกรรมโค้ด ไม่ใช่คำขอที่ผู้ใช้ลงนาม | PENDING HUMAN INPUT |

ทุกรายการด้านล่างเป็น **Inferred Current Behavior** ไม่มีหลักฐานว่าผู้ใช้ร้องขอหรืออนุมัติแล้ว

## Purpose and Scope

ระบบบันทึกและแสดงงานผลิตของ WSC Production Track ตามฟังก์ชันใน `DISC-02` ขอบเขตนอกเมนูที่ซ่อนอยู่คือ F-031

## User Categories

แอดมิน และผู้ใช้หน้างานที่มีโทเคนแผนก ชื่อหน่วยงานจริงเป็น PENDING HUMAN INPUT

## Functional Requirements

| ID | พฤติกรรมที่โค้ดทำ | หลักฐาน |
| --- | --- | --- |
| REQ-001 | แอดมินที่ไม่มีโทเคนในเบราว์เซอร์ถูกส่งไปหน้า `/admin` | `src/routes/_protected.tsx` |
| REQ-002 | บันทึกเริ่มหรือจบขั้นผลิตเมื่อพนักงานและขั้นยังเปิดใช้งาน | `src/lib/features/scan.functions.ts` |
| REQ-003 | สแกนทดลองไม่ให้ข้ามขั้นที่เลนยังไม่จบ | `src/lib/scan-trial.ts` |
| REQ-004 | รายงาน QC และแพ็คส่งได้เมื่อเลือกผลครบ ข้อไม่ผ่านมีหมายเหตุ และมีสื่อรวมอย่างน้อยหนึ่งรายการ | `src/lib/utils/report-media-validation.ts` |
| REQ-005 | คะแนนรวมของรายงานเป็นผ่านเมื่อทุกข้อผ่าน มิฉะนั้นไม่ผ่าน ถ้าระบุผลเองให้ใช้ค่านั้น | `checklistOverall` ในไฟล์เดียวกัน |
| REQ-006 | รับงานจาก backoffice เมื่อลายเซ็น HMAC ตรง | `src/routes/api/public/production-intake.ts` |
| REQ-007 | รับงาน Curtain Flow เมื่อคีย์ API ตรง และบันทึกตาม `job_no` | `src/routes/api/public/curtain-flow/jobs.ts` |
| REQ-008 | ตอบสุขภาพระบบเป็น JSON | `src/routes/api/public/health.ts` |
| REQ-009 | มีรายงานแอดมินของ QC แพ็ค สต๊อก ค่าใช้จ่าย และผลิต ตาม route ใน DISC-02 | ไฟล์ route ที่อ้างใน DISC-02 |
| REQ-010 | พิมพ์แท็กตามเลขงานได้จาก route พิมพ์ | `src/routes/_protected.print-label.$jobNo.tsx` |

## Non-functional and Security

| ID | เรื่อง | หลักฐาน | ช่องว่าง |
| --- | --- | --- | --- |
| REQ-011 | รหัสผ่านแผนกอยู่ในตัวแปรสภาพแวดล้อม ไม่ใส่ในเอกสารนี้ | ชื่อตัวแปรใน `.env.example` | ค่าจริง NOT VERIFIED ว่าถูกตั้งบนโฮสต์ |
| REQ-012 | สื่อของรายงานมีเพดานจำนวนในตัวตรวจของ server function | `qc.functions.ts` จำกัด media | ขนาดไฟล์อ้าง `src/lib/utils/media-limits.ts` รอบนี้ไม่เปิดทุกค่า |
| REQ-013 | ประสิทธิภาพไม่ได้กำหนดตัวเลขในซอร์ส | ไม่พบข้อตกลงเวลาตอบ | PENDING HUMAN INPUT |

## Error Handling

ฟังก์ชันสแกนและรายงานโยน `Error` เป็นข้อความภาษาไทยเมื่อข้อมูลไม่ผ่านเงื่อนไข ดูไฟล์ใน REQ-002 และ REQ-004

## Acceptance

เกณฑ์รับข้อกำหนดนี้คือผู้ใช้ยืนยันว่ารายการ REQ ตรงงานจริง ผลยังเป็น PENDING HUMAN INPUT
