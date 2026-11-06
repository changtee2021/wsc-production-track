# SI-05 ส่วนต่อผู้ใช้

| รายการ | ค่า |
| --- | --- |
| Document ID | SI-05 |
| Document Title | ส่วนต่อผู้ใช้ |
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
| 0.1 | 3 พฤศจิกายน 2026 | บัญชีเส้นทาง ไม่มีภาพหน้าจอที่อ้างว่าถ่ายครบ | PENDING HUMAN INPUT |

ไม่มีภาพหน้าจอแนบในเอกสารนี้ ภาพที่ยังไม่ได้เก็บต้องไม่ถูกอ้างว่าเป็นภาพจริง

## Routes

บัญชีหน้าอยู่ที่ `DISC-02` เมนูแอดมินเรียงกลุ่มใน `src/components/AdminSidebar.tsx` ได้แก่ ภาพรวม การผลิต Work Instructions QC แพ็คของ ซ่อมบำรุง สต๊อกออฟฟิศ นับสต๊อก ค่าใช้จ่าย พนักงาน และอัพเดต

กลุ่มคลังสินค้าถูกคอมเมนต์ไว้

## Role-based views

ผู้ไม่มีโทเคนแอดมินเปิดเส้น `_protected` จากเบราว์เซอร์แล้วจะถูกส่งไป `/admin` หน้างาน QC และแพ็คคนละเส้นทางกับแอดมิน

## Screenshot Capture Checklist

| รหัส | หน้า | สถานะภาพ |
| --- | --- | --- |
| UI-01 | `/admin` | NOT CAPTURED |
| UI-02 | `/dashboard` | NOT CAPTURED ในชุดนี้ |
| UI-03 | `/scan` | NOT CAPTURED |
| UI-04 | `/qc` | NOT CAPTURED |
| UI-05 | `/packing` | NOT CAPTURED |
| UI-06 | `/iso-29110` | เคยเปิดในเครื่องพัฒนาระหว่างจัดเอกสาร ยังไม่ได้แนบไฟล์ภาพในโฟลเดอร์นี้ |

ช่องว่าง โหลดไม่ได้ และสิทธิ์ไม่พอ ต้องถ่ายแยกเมื่อมีข้อมูลตัวอย่างที่ไม่ใช่ข้อมูลผลิตจริง
