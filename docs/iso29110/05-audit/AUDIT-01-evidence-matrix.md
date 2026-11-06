# AUDIT-01 ตารางหลักฐานเบื้องต้น

| รายการ | ค่า |
| --- | --- |
| Document ID | AUDIT-01 |
| Document Title | ตารางหลักฐานเบื้องต้นตามโปรไฟล์ Basic |
| Project Name | WSC Production Track |
| Version | 0.2 |
| Created Date | 3 พฤศจิกายน 2026 |
| Prepared By | ที่ปรึกษาจัดทำจากซอร์ส |
| Reviewed By | PENDING HUMAN INPUT |
| Approved By | PENDING HUMAN INPUT |
| Document Status | DRAFT — Preliminary Mapping |

## Revision History

| Version | Date | Description | Approved By |
| --- | --- | --- | --- |
| 0.1 | 3 พฤศจิกายน 2026 | จับคู่กิจกรรมหลัก ไม่ได้อ้างว่าครอบทุกประโยคของมาตรฐาน | PENDING HUMAN INPUT |
| 0.2 | 3 พฤศจิกายน 2026 | เติมหลักฐานที่อ่านและรันได้ในรอบที่ 2 ไม่ได้เปลี่ยนแถวที่ยังไม่มีคนลงนามหรือยังไม่รันหน้างาน | PENDING HUMAN INPUT |

รอบนี้ไม่ได้เปิดฉบับเต็มของ ISO/IEC 29110-5-1-2:2025 จากแหล่งมาตรฐาน จึงห้ามอ่านตารางนี้ว่าเป็นการตรวจอย่างเป็นทางการครบทุกข้อ ผู้ตรวจประเมินต้องยืนยันข้อย่อยอีกครั้ง

สถานะ: AVAILABLE มีของให้อ่าน, PARTIAL มีบางส่วน, MISSING ยังไม่มี, NOT VERIFIED ยังไม่ได้พิสูจน์

| กระบวนการ | กิจกรรม | หลักฐานในชุดนี้ | สถานะ |
| --- | --- | --- | --- |
| Project Management | วางแผน | PM-01 ถึง PM-05, PM-07 | PARTIAL ยังไม่มีการอนุมัติ |
| Project Management | ทำตามแผน | PM-06, Git, OPS-06 | PARTIAL ไม่มีใบคำขอที่อนุมัติ และแบบสำรองยังไม่ได้กรอก |
| Project Management | ประเมินและควบคุม | PM-05, PM-06 | PARTIAL |
| Project Management | ปิดโครงการ | PM-08 | MISSING ลายเซ็น |
| Software Implementation | เริ่มทำ | SI-02, ซอร์สที่มีอยู่ | PARTIAL |
| Software Implementation | วิเคราะห์ความต้องการ | SI-01 | PARTIAL เป็นพฤติกรรมจากโค้ด ยังไม่มีการยืนยัน |
| Software Implementation | ออกแบบ | SI-02 ถึง SI-06, R2-01 | PARTIAL พบข้อขัดแย้งสคีมาและ RLS ในไฟล์ แคตตาล็อกจริงยัง NOT VERIFIED |
| Software Implementation | สร้างซอฟต์แวร์ | ซอร์ส, QA-03, QA-07 | PARTIAL เทสที่รันได้ 24 ข้อ ตัวจัดการคำขอ API สแกน QC และแพ็คยังไม่ถูกเรียก |
| Software Implementation | รวมและทดสอบ | QA-01 ถึง QA-03, QA-08 | PARTIAL งานพื้นโรงงานยัง NOT RUN แบบฟอร์มว่างอยู่ที่ QA-08 |
| Software Implementation | ประกอบผลิตภัณฑ์และส่งมอบ | OPS-01 ถึง OPS-05, PM-08 | PARTIAL ยังไม่รับมอบ |

หน้า ISO ในแอปที่ `/iso-29110` เป็นอีกชุดเอกสาร จุดที่ขัดกับโฟลเดอร์นี้ถูกเขียนไว้ใน R2-02 แล้ว และหน้าในแอปยังไม่ได้ถูกแก้ในรอบนี้ ให้ใช้หลักฐานซอร์สและสถานะ PENDING ในโฟลเดอร์นี้ก่อนจนกว่าผู้มีอำนาจจะเลือกรุ่น
