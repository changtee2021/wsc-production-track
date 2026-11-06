# PM-01 ภาพรวมโครงการ

| รายการ | ค่า |
| --- | --- |
| Document ID | PM-01 |
| Document Title | ภาพรวมโครงการ |
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
| 0.1 | 3 พฤศจิกายน 2026 | ร่างจากซอร์สและเอกสาร go-live | PENDING HUMAN INPUT |

## Background

มีเว็บแอปชื่อ WSC Production Track ในคลัง `changtee2021/wsc-production-track` ใช้บันทึกและติดตามงานผลิต รวม QC แพ็คของ และงานสนับสนุนที่มี route จริงตาม `DISC-02`

ปัญหาธุรกิจตั้งต้นที่เจ้าของโครงการเล่าไว้ในงานเอกสารนี้ยังไม่มีเอกสารลงนาม จึงเป็น **PENDING HUMAN INPUT** ไม่เขียนเป็นข้อเท็จจริงว่าเคยเกิดการไม่สแกน

## Objectives

วัตถุประสงค์ที่พิสูจน์ได้จากของที่มีอยู่: ระบบบันทึกสถานะงานผลิตผ่านการสแกนและมีรายงาน QC กับแพ็ค

วัตถุประสงค์เชิงธุรกิจที่ผู้บริหารต้องการเป็น **PENDING HUMAN INPUT**

## Scope

ในขอบเขตตามซอร์สปัจจุบัน: ฟังก์ชัน F-001 ถึง F-030 ใน `DISC-02`

นอกเมนูที่ใช้งาน: โมดูลคลังสินค้า F-031 มีโค้ดแต่เมนูถูกซ่อน

## Users

บทบาทที่โค้ดแยกโทเคนได้: แอดมิน, QC, แพ็ค, ซ่อม, สต๊อก, ค่าใช้จ่าย, พนักงานออฟฟิศ, ผู้ตรวจ WI

หลักฐาน: ไฟล์ใต้ `src/lib/auth/`

ชื่อตำแหน่งในบริษัท เช่น ผู้สั่งการหรือหัวหน้าฝ่ายผลิต เป็น **PENDING HUMAN INPUT**

## Constraints

- ข้อมูลอยู่ schema ที่ตั้งค่าได้ ค่าเริ่มต้น `wsc_production` บนโปรเจกต์ Supabase ที่ระบุใน `.env.example`
- เอกสาร deploy ระบุโฮสต์ Vercel
- ชุดนี้เป็นซอฟต์แวร์ใช้ภายในตามคำชี้แจงเจ้าของโครงการ การยืนยันว่าไม่มีการขายลิขสิทธิ์เป็น **PENDING HUMAN INPUT**

## Exclusions

การรับรอง ISO ยังไม่เกิด เอกสารนี้ไม่ใช่ใบรับรอง
