## เป้าหมาย
สร้างหน้า "พรีวิวตาราง Excel ประวัติผลิต" สำหรับแอดมิน ที่ pivot ข้อมูล production logs ของแต่ละ Job เป็นแถวเดียว แล้วกระจาย ขั้นตอน/พนักงาน/เวลาเริ่ม/เวลาจบ เป็นคอลัมน์ตามลำดับ (ขั้นตอน 1, 2, 3, …) จำนวนคอลัมน์ปรับตามจำนวนขั้นตอนสูงสุดของข้อมูลที่กรองได้ พร้อมส่งออก CSV/XLSX และ Sync เข้า Google Sheets

## หน้าใหม่
- Route: `src/routes/_protected.production-excel.tsx`
- เมนูใน `AdminSidebar.tsx` หมวด "การผลิต" ใต้ "ประวัติงานผลิต" ชื่อ "พรีวิว Excel ผลิต"

## Server functions ใหม่ (`src/lib/features/production-excel.functions.ts`)
1. `adminGetProductionExcel({ token, start, end, category_id?, job_search? })`
   - ดึง production_logs ในช่วงเวลา + join steps/categories/employees
   - จับคู่ start/finish ด้วยตรรกะเดียวกับ `production-monitor.functions.ts` (`pairLogs`)
   - คืน array ของ Job rows: `{ job_id, category_name, started_at, finished_at, steps: [{step_name, employee_name, started_at, finished_at, actual_seconds, target_seconds, exceeded}, ...] }`
   - คืน `max_steps` เพื่อให้ฝั่ง client gen header dynamic
2. `adminSyncProductionExcelToSheets({ token, spreadsheet_id, sheet_name, rows, headers, mode: 'append'|'replace' })`
   - เรียก Google Sheets API ผ่าน gateway `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/{id}/values/{range}:append?valueInputOption=USER_ENTERED`
   - ใช้ `process.env.LOVABLE_API_KEY` + `process.env.GOOGLE_SHEETS_API_KEY` (ชื่อจะถูกตั้งหลังเชื่อม connector)
   - ถ้า mode = 'replace' เรียก `values:clear` ก่อน append

## UI หน้า /production-excel
ใช้ shadcn primitives เดิม (Card, Table, Select, Input, Button, Checkbox, Calendar/Popover, Badge, toast)

โครงสร้าง:
- แถบฟิลเตอร์ด้านบน:
  - ช่วงวันที่ (date range): วันนี้ / 7 วัน / เดือนนี้ / custom
  - หมวดหมู่ (Select)
  - ค้นหา Job (Input — filter client-side ภายในผลลัพธ์ที่ load มา)
  - ปุ่ม "โหลดข้อมูล"
- ตารางพรีวิว:
  - คอลัมน์คงที่: ☑ checkbox / Job / หมวดหมู่ / เวลาเริ่ม / เวลาจบ / จำนวนขั้นตอน
  - คอลัมน์ dynamic ตาม `max_steps`: `ขั้นตอน(n)`, `พนักงาน(n)`, `เริ่ม(n)`, `จบ(n)` — sticky header, scroll แนวนอน
  - คลิกหัวคอลัมน์เพื่อ sort, มี global search input
  - "เลือกทั้งหมด" + checkbox ต่อแถว
- แถบ action ล่าง:
  - "ดาวน์โหลด CSV" / "ดาวน์โหลด XLSX" — ใช้ `xlsx` library (มีอยู่แล้วในโปรเจกต์จาก qc-export/packing-export) แปลงเฉพาะแถวที่เลือก (ถ้าไม่เลือก = ทั้งหมดที่ filter)
  - "ส่งเข้า Google Sheets":
    - Dialog ให้กรอก Spreadsheet ID + Sheet name + เลือก append/replace
    - แสดง loading toast ระหว่างส่ง, success/error toast ตอนจบ

## Google Sheets Connector
- ใช้ Google Sheets connector (gateway-enabled) ที่มีอยู่
- เรียก `standard_connectors--connect` ด้วย `connector_id: "google_sheets"` (รอผู้ใช้กดยืนยันเชื่อม account ของบริษัท)
- หลังเชื่อมเสร็จ secret `GOOGLE_SHEETS_API_KEY` จะ inject เข้า server runtime อัตโนมัติ
- ถ้า server fn พบว่า secret ขาด → ตอบ error ชัดเจน "ยังไม่ได้เชื่อม Google Sheets"

## Export Helper ใหม่
`src/lib/utils/production-excel-export.ts`
- `buildHeaders(maxSteps): string[]`
- `buildRows(jobs, maxSteps): string[][]`
- `downloadCsv(filename, headers, rows)` (Blob + URL.createObjectURL)
- `downloadXlsx(filename, headers, rows)` (ใช้ `xlsx`)

## Migration / DB
ไม่ต้องแก้ schema — อ่านจาก `production_logs`, `steps`, `categories`, `employees` ที่มีอยู่

## System log
INSERT แถวลง `system_logs` หลัง implement: title "เพิ่มหน้าพรีวิว Excel ประวัติผลิต + Sync Google Sheets", paths ครอบไฟล์ที่สร้าง/แก้

## ไฟล์ที่จะสร้าง/แก้
สร้าง:
- `src/routes/_protected.production-excel.tsx`
- `src/lib/features/production-excel.functions.ts`
- `src/lib/utils/production-excel-export.ts`

แก้:
- `src/components/AdminSidebar.tsx` (เพิ่มเมนู)

## ลำดับงาน
1. เรียก `standard_connectors--connect` (google_sheets) — รอผู้ใช้ยืนยัน
2. สร้าง server functions + helper export
3. สร้างหน้า UI + ใส่เมนู
4. INSERT system_logs