# 02 บัญชีฟังก์ชัน

| รายการ | ค่า |
| --- | --- |
| Document ID | DISC-02 |
| Document Title | บัญชีฟังก์ชัน |
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
| 0.1 | 3 พฤศจิกายน 2026 | ร่างจาก route และเมนูที่พบ | PENDING HUMAN INPUT |

สถานะในตารางนี้หมายถึงมีไฟล์ route หรือเมนูในซอร์ส ไม่ได้หมายความว่าผู้ใช้ยืนยันแล้ว

เมนูแอดมินอ้าง `src/components/AdminSidebar.tsx` หน้างานอ้างไฟล์ใต้ `src/routes/`

| Feature ID | Module | Function | User Role | Source Reference | Status |
| --- | --- | --- | --- | --- | --- |
| F-001 | Administration | เข้าหลังบ้านแอดมิน | แอดมิน | `src/routes/admin.tsx`, `src/routes/_protected.tsx` | IMPLEMENTED |
| F-002 | Production Tracking | Dashboard | แอดมิน | `/dashboard` | IMPLEMENTED |
| F-003 | Production Tracking | Monitor Live | แอดมิน | `/production-dashboard` | IMPLEMENTED |
| F-004 | Production Tracking | ค้นหา Job | แอดมิน | `/job-lookup` | IMPLEMENTED |
| F-005 | Scanning | โฟลว์สแกนโหมดสถานี | แอดมิน | `/scan-flow` | IMPLEMENTED |
| F-006 | Scanning | แอปทดลองสแกน | แอดมินและหน้างาน | `/scan-trial`, `src/lib/scan-trial.ts` | IMPLEMENTED |
| F-007 | Scanning | ออเดอร์เข้าไลน์ | แอดมิน | `/trial-releases` | IMPLEMENTED |
| F-008 | Scanning | สแกนบันทึกเริ่มและจบขั้น | พนักงานผลิต | `src/routes/scan.tsx`, `src/lib/features/scan.functions.ts` | IMPLEMENTED |
| F-009 | Production Management | คิวผลิต | แอดมิน | `/production-queue` | IMPLEMENTED |
| F-010 | Production Management | ประวัติงานผลิต | แอดมิน | `/logs` | IMPLEMENTED |
| F-011 | Reporting | พรีวิว Excel ผลิต | แอดมิน | `/production-excel` | IMPLEMENTED |
| F-012 | Production Management | เวลามาตรฐานและไฟแดง | แอดมิน | `/production-standards` | IMPLEMENTED |
| F-013 | Settings | ตั้งค่าการผลิต | แอดมิน | `/production-setup` | IMPLEMENTED |
| F-014 | Work Instructions | ภาพรวมและคลัง WI | แอดมิน | `/wi`, `/wi/library` | IMPLEMENTED |
| F-015 | Quality | รายงานและสรุป QC | แอดมิน | `/qc-reports`, `/qc-summary` | IMPLEMENTED |
| F-016 | Quality | บันทึก QC หน้างาน | พนักงาน QC | `src/routes/qc.tsx`, `src/lib/features/qc.functions.ts` | IMPLEMENTED |
| F-017 | Packing | รายงานและสรุปแพ็ค | แอดมิน | `/packing-reports`, `/packing-summary` | IMPLEMENTED |
| F-018 | Packing | บันทึกแพ็คหน้างาน | พนักงานแพ็ค | `src/routes/packing.tsx`, `src/lib/features/packing.functions.ts` | IMPLEMENTED |
| F-019 | Maintenance | สรุปงานซ่อมและอะไหล่ | แอดมิน | `/maintenance-admin`, `/maintenance-master` | IMPLEMENTED |
| F-020 | Maintenance | หน้างานซ่อม | พนักงานซ่อม | `src/routes/maintenance.tsx` | IMPLEMENTED |
| F-021 | Office stock | เบิกสต๊อกออฟฟิศและค่าเสื่อม | แอดมิน | `/supplies-dashboard`, `/supplies-admin`, `/supplies-reports` | IMPLEMENTED |
| F-022 | Stock count | นับสต๊อกและรายงาน | แอดมินและหน้างาน | `/stock-count-inventory`, `src/routes/stock-count.tsx` | IMPLEMENTED |
| F-023 | Expenses | เบิกค่าใช้จ่ายและรายงานเดือน | แอดมินและหน้างาน | `/expenses-dashboard`, `src/routes/expense-scan.tsx` | IMPLEMENTED |
| F-024 | Employee Management | จัดการพนักงาน | แอดมิน | `/manage` | IMPLEMENTED |
| F-025 | Administration | ประกาศ ความคิดเห็น พื้นที่ไฟล์ ข้อกำหนด | แอดมิน | `/control`, `/feedback-admin`, `/storage`, `/admin-policy` | IMPLEMENTED |
| F-026 | Administration | หน้า ISO 29110 ในแอป | แอดมิน | `/iso-29110` | IMPLEMENTED |
| F-027 | Administration | LogUpdate และ Server Logs | แอดมิน | `/logs-update`, `/server-logs` | IMPLEMENTED |
| F-028 | Labels | พิมพ์แท็กตามเลขงาน | แอดมิน | `src/routes/_protected.print-label.$jobNo.tsx` | IMPLEMENTED |
| F-029 | Integration | รับออเดอร์ที่อนุมัติแล้ว | ระบบ backoffice | `src/routes/api/public/production-intake.ts` | IMPLEMENTED |
| F-030 | Integration | สุขภาพระบบ | ผู้ดูแล | `src/routes/api/public/health.ts` | IMPLEMENTED |
| F-031 | Warehouse | หน้าคลังสินค้า | NOT VERIFIED ว่าใครใช้ | `src/routes/warehouse*.tsx` | PARTIALLY IMPLEMENTED |

F-031 มีไฟล์ route แต่เมนูแอดมินถูกคอมเมนต์ไว้ พร้อมข้อความว่าโมดูลยังไม่ใช้งาน (`AdminSidebar.tsx`) จึงไม่นับว่าเป็นฟังก์ชันที่เปิดใช้ในเมนูปัจจุบัน

ฟังก์ชันที่ไม่ได้พบ route ไม่ถูกใส่ในตารางนี้
