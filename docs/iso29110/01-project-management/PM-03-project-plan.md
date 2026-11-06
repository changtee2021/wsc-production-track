# PM-03 แผนโครงการ

| รายการ | ค่า |
| --- | --- |
| Document ID | PM-03 |
| Document Title | แผนโครงการ |
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
| 0.1 | 3 พฤศจิกายน 2026 | ร่าง วันในอดีตที่ไม่มีหลักฐานถูกเว้น | PENDING HUMAN INPUT |

## Goals

คงระบบที่บันทึกงานผลิต QC และแพ็คให้ใช้งานต่อ และมีหลักฐานการเปลี่ยนรุ่นใน Git

## Organization

โครงสร้างชื่อคนเป็น **PENDING HUMAN INPUT** ดูช่องใน `PM-04`

## Schedule

| เหตุการณ์ | วันที่ในหลักฐาน | สถานะ |
| --- | --- | --- |
| Commit เทมเพลต | 1 ม.ค. 2025 `929a9a4` | มีใน Git ไม่ใช่วันเริ่มธุรกิจ |
| แผน go-live ในเอกสาร | 13–14 มิ.ย. 2026 และให้พนักงานใช้ 15 มิ.ย. 2026 | เอกสาร `docs/WSC-MONDAY-GO-LIVE-TONIGHT.md` ช่องตรวจยังไม่ติ๊ก จึงยังไม่นับว่าเสร็จ |
| สำรวจและร่างเอกสาร ISO ชุดนี้ | 3 พ.ย. 2026 | เกิดขึ้นในรอบจัดเอกสารนี้ |

ชั่วโมงทำงานและวันเริ่มจ้างเป็น **PENDING HUMAN INPUT** ห้ามใส่ตัวเลขที่ไม่มีใบลงเวลา

## Milestones ที่ยังเปิด

| รหัส | งาน | สถานะ |
| --- | --- | --- |
| M-1 | ผู้มีอำนาจยืนยัน PM-02 | ACTION REQUIRED |
| M-2 | รันงานสแกน QC แพ็คบนพื้นที่ใช้จริงแล้วบันทึกผล | ACTION REQUIRED |
| M-3 | บันทึกการสำรองและซ้อมกู้คืน | ACTION REQUIRED |
| M-4 | ปัก baseline เอกสารนี้กับ commit | ACTION REQUIRED |

## Quality Activities

มี `npm test` สำหรับกฎสแกนทดลองและกฎส่งรายงาน ยังไม่มีเทสการเขียนฐานข้อมูล ดู `QA-03`

## Configuration Management

ดู `PM-07`

## Change Management

การเปลี่ยนที่เห็นได้คือ commit และ pull request ใน Git ยังไม่มีสมุดคำขอที่ผู้ใช้ลงนาม ดู `PM-06`

## Verification and Validation

การทวนสอบจากซอร์สทำในเอกสารชุดนี้ การยืนยันโดยผู้ใช้เป็น PENDING ดู `QA-06`

## Closure Criteria

ปิดโครงการเมื่อ `PM-08` มีลายเซ็นและรายการค้างถูกบันทึกตามจริง ตอนนี้ยังไม่ปิด
