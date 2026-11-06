# WSC Production Track — เอกสารเตรียม ISO/IEC 29110

ชุดนี้เป็นร่างจากซอร์สวันที่ 3 พฤศจิกายน 2026 สำหรับโปรไฟล์ Basic ของ ISO/IEC 29110 กระบวนการ Project Management และ Software Implementation

สถานะรวม: **ยังไม่พร้อมตรวจประเมิน และยังไม่ได้รับการรับรอง**

การจับคู่มาตรฐานเป็น Preliminary Mapping เพราะรอบนี้ไม่ได้เปิดฉบับเต็มของ ISO/IEC 29110-5-1-2:2025

## Project Summary

เว็บแอปติดตามงานผลิต อยู่ที่ repo `changtee2021/wsc-production-track` HEAD ตอนสำรวจ `8951f84` ข้อมูลชี้ไปที่ schema `wsc_production` รายละเอียดอยู่ใน `00-system-analysis/01-system-discovery.md`

Working tree ตอนสำรวจมีรายการที่ยังไม่ commit 17 รายการ เอกสารนี้จึงยังไม่ใช่ baseline ที่ปิดแล้ว

## Documentation Index

| กลุ่ม | ไฟล์ |
| --- | --- |
| สำรวจระบบ | `00-system-analysis/01-system-discovery.md`, `02-feature-inventory.md`, `03-business-workflows.md` |
| บริหารโครงการ | `01-project-management/PM-01` ถึง `PM-08` |
| สร้างซอฟต์แวร์ | `02-software-implementation/SI-01` ถึง `SI-06` |
| คุณภาพ | `03-quality-assurance/QA-01` ถึง `QA-08` |
| ปฏิบัติการ | `04-operations/OPS-01` ถึง `OPS-06` |
| เตรียมตรวจ | `05-audit/AUDIT-01` ถึง `AUDIT-08` |
| รอบที่ 2 | `06-round2/R2-01-auth-schema-rls-review.md`, `06-round2/R2-02-in-app-doc-conflicts.md`, `NEXT-ACTIONS.md` |

ทะเบียนชื่อเอกสารอยู่ที่ `05-audit/AUDIT-06-document-register.md`

## Evidence Availability

| มีหลักฐาน | ยังไม่มีหรือยังไม่พิสูจน์ |
| --- | --- |
| โครงสร้างแอป route เมนู และ API ที่อ่านจากไฟล์ | ลายเซ็นอนุมัติและรับมอบ |
| เทสที่รันได้ 24 ข้อผ่าน เมื่อ 3 พ.ย. 2026 รอบที่ 2 ดู QA-07 | ผลรันสแกน QC แพ็คบนหน้างาน และผลเรียกตัวจัดการคำขอจริง |
| ประวัติ Git และเอกสารวิธี deploy | ใบสำรองและผลซ้อมกู้คืน |
| กฎส่งรายงาน QC และแพ็คในโค้ด | แคตตาล็อกฐานจริงและ RLS |

## Completion Status

ทุกไฟล์ในโฟลเดอร์นี้เป็น DRAFT รุ่น 0.1 ผู้ทบทวนและผู้อนุมัติยังว่าง

## Outstanding Actions

รายการ G-01 ถึง G-14 ใน `05-audit/AUDIT-02-gap-analysis.md`

ลำดับที่ควรทำก่อนคือเลือกรุ่นอ้างอิงระหว่างหน้าแอปกับโฟลเดอร์นี้ ลายเซ็นรับขอบเขต ผลทดสอบหน้างานสามเคส ใบสำรอง และ commit ของเอกสารชุดนี้ รายละเอียดแยกงานคนกับงานผู้ช่วยอยู่ที่ `NEXT-ACTIONS.md`

## Human Review Checklist

- [ ] ชื่อเจ้าของโครงการและทีมใน `AUDIT-05`
- [ ] ยืนยันว่าข้อกำหนด SI-01 ตรงงานที่ใช้จริง
- [ ] ลงนาม PM-08 ถ้าตรวจแล้วรับได้ พร้อมเงื่อนไขที่ยังเปิด
- [ ] เลือกชุดเดียวเป็นรุ่นอ้างอิงหลังอ่าน R2-02 หน้าในแอปยังไม่ได้ถูกแก้ให้ตรงกัน

## Certification Preparation Status

ยังไม่ยื่นหน่วยรับรอง เหตุผลอยู่ใน `AUDIT-07` และ `AUDIT-02`
