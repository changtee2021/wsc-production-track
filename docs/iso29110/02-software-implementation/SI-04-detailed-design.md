# SI-04 แบบละเอียดรายโมดูล

| รายการ | ค่า |
| --- | --- |
| Document ID | SI-04 |
| Document Title | แบบละเอียด |
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
| 0.1 | 3 พฤศจิกายน 2026 | โมดูลหลักที่อ่านฟังก์ชันได้ | PENDING HUMAN INPUT |

| Module | หน้าที่ | กฎที่อ่านได้ | หลักฐาน |
| --- | --- | --- | --- |
| สแกนผลิต | บันทึก start หรือ finish | พนักงานและขั้นต้อง active โน้ตถูกเก็บเมื่อ finish มีการจำกัดความถี่ต่อ IP ในหน่วยความจำของโปรเซส | `src/lib/features/scan.functions.ts` |
| สแกนทดลอง | ลำดับขั้นตามโฟลว์สินค้า | เลนต้องจบก่อนขั้นรวม และคนที่ยังมีงาน running ไปขั้นใหม่ไม่ได้ | `src/lib/scan-trial.ts` |
| QC | บันทึกรายงานตรวจ | ใช้ตัวตรวจสื่อและหมายเหตุร่วมกับแพ็ค แล้วคำนวณคะแนนรวม | `src/lib/features/qc.functions.ts` |
| แพ็ค | บันทึกรายงานแพ็ค | กฎส่งรายงานชุดเดียวกับ QC คนละตาราง | `src/lib/features/packing.functions.ts` |
| รายงานส่งออก | สร้าง CSV | QC แสดงคำว่าผ่าน รวมกรณีมอเตอร์ แพ็คแสดงไม่ผ่าน | `src/lib/utils/qc-export.ts`, `packing-export.ts` |
| รับงาน | รับชุดข้อมูลจากระบบอื่น | ลายเซ็นหรือคีย์ตาม SI-06 | ไฟล์ใต้ `src/routes/api/public/` |
| แอดมิน | เมนูและหน้าสรุป | เมนูประกาศใน `AdminSidebar.tsx` | ไฟล์ route ตาม DISC-02 |

โมดูลซ่อม สต๊อกออฟฟิศ นับสต๊อก และค่าใช้จ่ายมี route แล้ว รอบนี้ไม่ได้เปิดทุกฟังก์ชันบันทึก จึงไม่เขียนกฎธุรกิจเชิงลึกของโมดูลเหล่านั้น สถานะกฎละเอียดเป็น NOT VERIFIED

## Exception

เมื่อ insert รายงานแล้วบันทึกรายการย่อยไม่สำเร็จ โค้ด QC และแพ็คลบหัวรายงานที่เพิ่งใส่ ความสำเร็จของทางลบนี้ขึ้นกับฐานข้อมูล ผลจริงเป็น NOT VERIFIED
