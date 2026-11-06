# SI-03 แบบข้อมูล

| รายการ | ค่า |
| --- | --- |
| Document ID | SI-03 |
| Document Title | แบบข้อมูล |
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
| 0.1 | 3 พฤศจิกายน 2026 | บัญชีตารางจากไฟล์ไทป์ ไม่ได้สอบถามฐานจริง | PENDING HUMAN INPUT |

## Overview

ไคลเอนต์เซิร์ฟเวอร์ใช้ schema จาก `SUPABASE_SCHEMA` ค่าเริ่มต้น `wsc_production` ไฟล์ `src/integrations/supabase/types.ts` วางตารางใต้คีย์ `public`

**Conflict:** ชื่อคีย์ในไฟล์ไทป์กับชื่อ schema ตอนรันไม่ตรงกัน การมีตารางเหล่านี้จริงใน `wsc_production` เป็น **NOT VERIFIED**

ไม่มีข้อมูลแถวจริงในเอกสารนี้

## Table Inventory

ตารางที่พบในไฟล์ไทป์และเกี่ยวกับงานที่เมนูเปิดใช้:

`announcements`, `app_settings`, `assets`, `categories`, `employee_badges`, `employee_scores`, `employees`, `error_logs`, `expense_categories`, `expense_status_history`, `expenses`, `feedbacks`, `home_banners`, `inventory_items`, `maintenance_employees`, `maintenance_parts_used`, `maintenance_tickets`, `office_asset_categories`, `office_assets`, `office_employees`, `office_request_items`, `office_requests`, `office_stock_movements`, `packing_checklists`, `packing_employees`, `packing_report_items`, `packing_reports`, `policies`, `production_jobs`, `production_logs`, `production_standards`, `qc_checklists`, `qc_employees`, `qc_report_items`, `qc_reports`, `spare_part_movements`, `spare_parts`, `steps`, `stock_count_batches`, `stock_counts`, `system_logs`, `ticket_comments`, `scan_trial_releases`

`src/routes/api/public/migration-export.ts` มีรายชื่อตารางชุดส่งออกที่ยาวกว่านี้ รวมตารางคลัง `wh_*` รายชื่อนั้นเป็นของตัวส่งออก ไม่ได้แปลว่าเมนูคลังเปิดใช้งาน

## Keys and Policies

คีย์และความสัมพันธ์อยู่ในไฟล์ไทป์ช่วง Relationships รอบนี้ไม่ได้ถอดทุกคู่ จึงยังไม่วาด ER ที่อ้างว่าครบ

นโยบาย RLS ของฐานจริงเป็น **NOT VERIFIED** เพราะไม่ได้เปิดนโยบายจากเซิร์ฟเวอร์ฐานข้อมูล

## Data Lifecycle

`production_logs` ถูก insert จาก `submitProductionLog` ไม่พบคำสั่งลบ log ในฟังก์ชันนั้น การห้ามแก้ย้อนหลังทั้งตารางเป็น NOT VERIFIED
