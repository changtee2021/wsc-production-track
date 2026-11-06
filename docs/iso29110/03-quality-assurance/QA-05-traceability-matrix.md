# QA-05 ตารางโยง

| รายการ | ค่า |
| --- | --- |
| Document ID | QA-05 |
| Document Title | ตารางโยงความต้องการ |
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
| 0.1 | 3 พฤศจิกายน 2026 | โยงเฉพาะ REQ ที่มีหลักฐานโค้ด | PENDING HUMAN INPUT |

| Requirement | Design | Source | Test Case | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | SI-02 ส่วนแอดมิน | `src/routes/_protected.tsx` | TC-F-04 | โค้ดมี เทสยังไม่รัน | NOT RUN |
| REQ-002 | SI-04 สแกนผลิต | `scan.functions.ts` | TC-F-01 | ยังไม่รันบนหน้างาน | NOT RUN |
| REQ-003 | SI-04 สแกนทดลอง | `scan-trial.ts` | TC-U-01 ถึง TC-U-03 | QA-03 | PASS ระดับหน่วย |
| REQ-004 | SI-04 QC และแพ็ค | `report-media-validation.ts` | TC-U-04 ถึง TC-U-06 และ TC-F-02, TC-F-03 | หน่วยผ่าน หน้างานยังไม่รัน | PARTIAL |
| REQ-005 | SI-04 คะแนนรวม | `checklistOverall` | TC-U-07, TC-U-08 | QA-03 | PASS ระดับหน่วย |
| REQ-006 | SI-06 | `production-intake.ts` | TC-F-05 | NOT RUN | NOT RUN |
| REQ-007 | SI-06 | `curtain-flow/jobs.ts` | ยังไม่มีเลขเคส | ไม่มีเทส | MISSING TEST |
| REQ-008 | SI-06 | `health.ts` | ยังไม่มีเลขเคสในรอบนี้ | ไม่ได้เรียกตอนเขียน QA-03 | NOT RUN |
| REQ-009 | DISC-02 | route รายงาน | ยังไม่มีเคสรายหน้า | MISSING TEST | MISSING TEST |
| REQ-010 | DISC-02 F-028 | `print-label` route | ยังไม่มีเคส | MISSING TEST | MISSING TEST |
| REQ-011 ถึง REQ-013 | SI-01 | ไฟล์ที่อ้างใน SI-01 | ไม่มีเคสแยก | NOT VERIFIED | NOT VERIFIED |
