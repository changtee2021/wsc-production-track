# AUDIT-02 ช่องว่าง

| รายการ | ค่า |
| --- | --- |
| Document ID | AUDIT-02 |
| Document Title | ช่องว่างของหลักฐาน |
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
| 0.1 | 3 พฤศจิกายน 2026 | ช่องว่างจากเอกสารในโฟลเดอร์นี้ | PENDING HUMAN INPUT |
| 0.2 | 3 พฤศจิกายน 2026 | เติมผลอ่านซอร์สรอบที่ 2 และผล `npm test` 24 ข้อ ไม่ได้ปิดช่องที่ยังไม่มีหลักฐานคนทำ | PENDING HUMAN INPUT |

| Gap ID | Missing Evidence | ISO Process | Priority | Recommended Action | Responsible Role | Status |
| --- | --- | --- | --- | --- | --- | --- |
| G-01 | ลายเซ็นขอบเขตและรับมอบ | PM ปิดโครงการ, SI ยืนยัน | CRITICAL | กรอก PM-02 และ PM-08 | Approver | ACTION REQUIRED |
| G-02 | ผลรันสแกน QC แพ็คบนงานตัวอย่าง | SI ทดสอบ | CRITICAL | ทำ TC-F-01 ถึง TC-F-03 นอกข้อมูลผลิตจริง | Tester และผู้ใช้หน้างาน | ACTION REQUIRED |
| G-03 | ใบสำรองและผลซ้อมกู้คืน | PM ทำตามแผน | HIGH | รันสำรองในหน้าต่างที่ผู้ดูแลกำหนด แล้วกรอก OPS-06 แบบฟอร์มยังว่าง | System Administrator | ACTION REQUIRED |
| G-04 | commit ที่ปิดเอกสารรุ่นนี้ | PM โครงแบบ | HIGH | commit เฉพาะชุดเอกสารเมื่อได้รับคำสั่ง | Developer | ACTION REQUIRED |
| G-05 | ชั่วโมงและชื่อทีม | PM วางแผน | MEDIUM | กรอก PM-03 และ PM-04 จากบันทึกจริง | Project Manager | PENDING HUMAN INPUT |
| G-06 | เทสที่ตัวจัดการคำขอ API สแกน QC และแพ็คเขียนข้อมูล | SI สร้างและทดสอบ | HIGH | แยกจุดรับฐานจำลองเมื่อได้รับอนุญาต รายละเอียดอยู่ใน QA-07 | Developer | PARTIAL เทสโทเคนปลอม 4 ข้อผ่าน ตัวจัดการคำขอยังโหลดไม่ได้ |
| G-07 | คนที่สองทวนสอบเอกสาร | PM และ SI ทวนสอบ | HIGH | ผู้ที่ไม่ได้เขียนชุดนี้อ่าน QA-06 | Reviewer | ACTION REQUIRED |
| G-08 | ภาพหน้าจอ | SI ส่วนต่อผู้ใช้ | LOW | ถ่ายตาม SI-05 | Tester | ACTION REQUIRED |
| G-09 | แคตตาล็อกฐานจริงและ RLS ที่มีผล | SI ข้อมูล | MEDIUM | ให้ผู้ดูแลฐานเทียบ R2-01 กับ `pg_policies` ของ `wsc_production` | System Administrator | PARTIAL อ่านไฟล์แล้ว ฐานจริงยัง NOT VERIFIED |
| G-10 | ฉบับมาตรฐาน 2025 ที่ใช้จับข้อย่อย | การตรวจ | MEDIUM | ให้ผู้ตรวจประเมินยืนยันฉบับ | Approver และหน่วยรับรอง | NOT VERIFIED |
| G-11 | หน้าแอดมินถูกกันที่เบราว์เซอร์ | SI สิทธิ์ | HIGH | ให้คนตัดสินว่าจะย้ายการตรวจไปฝั่งเซิร์ฟเวอร์หรือไม่ ยังไม่ได้แก้โค้ด | Developer หลังได้รับอนุญาต | ACTION REQUIRED หลักฐานอยู่ใน R2-01 ข้อ C-AUTH-01 |
| G-12 | `submitProductionLog` ไม่ตรวจโทเคนแผนก และเซิร์ฟเวอร์ใช้ service role | SI สิทธิ์ | HIGH | ให้คนตัดสินทางแก้ก่อนลงมือ ยังไม่ได้แก้โค้ด | Developer หลังได้รับอนุญาต | ACTION REQUIRED หลักฐานอยู่ใน R2-01 ข้อ C-AUTH-02 |
| G-13 | ชนิดตารางและ migration ส่วนใหญ่ชี้ `public` ขณะที่ค่าสคีมาในโค้ดคือ `wsc_production` | SI ข้อมูล | MEDIUM | ยืนยันพร้อม G-09 | System Administrator | NOT VERIFIED |
| G-14 | หน้า `/iso-29110` ขัดกับโฟลเดอร์นี้หลายจุด | PM โครงแบบ | HIGH | เลือกชุดเดียวตาม R2-02 | หัวหน้าฝ่ายผลิตและ Developer | ACTION REQUIRED |

G-01 ถึง G-05, G-07, G-08 และ G-10 ยังเปิดเหมือนรอบ 0.1 ไม่มีลายเซ็น ผลหน้างาน หรือใบสำรองใหม่

ชุดนี้ยังไม่พร้อมให้สรุปว่าตรวจผ่าน
