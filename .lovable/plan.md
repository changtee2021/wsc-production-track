## ปรับปรุงฟีเจอร์ QC

### 1. บังคับกฎ "ไม่ผ่าน" (frontend `src/routes/qc.tsx`)
- เพิ่ม validation ใน `handleSubmit`: ทุกข้อที่ `is_passed === false` ต้อง
  - มี `remark.trim()` (มีอยู่แล้ว) **และ**
  - มี `media.length >= 1` (รูปหรือวิดีโออย่างน้อย 1)
- แสดง toast พร้อมระบุข้อที่ขาด (เลขลำดับ)
- ใน `ChecklistItemCard` เมื่อกด "ไม่ผ่าน":
  - เพิ่ม helper text สีแดงใต้ช่องสื่อ "ต้องแนบรูป/วิดีโออย่างน้อย 1 รายการ" เมื่อ `media.length === 0`
  - ทำกรอบช่องอัปโหลด/textarea เป็นสี destructive เมื่อยังไม่ครบ
- ปุ่มส่งรายงาน disable เมื่อมีข้อ fail ที่ยังขาด remark หรือ media (เพิ่มเงื่อนไขใน `useMemo` ที่คำนวณ submit-ready)

### 2. ส่งออก CSV/Excel ใน `src/routes/_protected.qc-reports.tsx`
- เพิ่มปุ่ม "ส่งออก CSV" ที่ header (ใช้ข้อมูล `reports` ที่กรองแล้วในปัจจุบัน)
- สร้าง helper `src/lib/qc-export.ts` ฟังก์ชัน `exportQcReportsCsv(reports)`:
  - 1 แถว = 1 รายการเช็คลิสต์ (flatten `items`)
  - คอลัมน์: `report_id`, `created_at`, `job_id`, `category`, `step`, `qc_employee`, `overall_result`, `overall_summary`, `item_order`, `item_text`, `item_result(ผ่าน/ไม่ผ่าน)`, `item_remark`, `item_media_count`, `item_media_urls` (คั่นด้วย `;`)
  - Encode UTF-8 + BOM (`\uFEFF`) เพื่อให้ Excel อ่านภาษาไทยถูก
  - escape เครื่องหมาย `"` และ `,` ตามมาตรฐาน CSV
  - ชื่อไฟล์: `qc-reports-YYYYMMDD-HHmm.csv`
- ไม่ต้องเพิ่ม dependency (CSV ล้วน, Excel เปิดได้ตรง ๆ)

### 3. UI รายการรายข้อแบบขยาย/ยุบ (mobile-friendly) ใน `_protected.qc-reports.tsx`
- ใช้ shadcn `Accordion` (`type="multiple"`) ครอบ `items` ในแต่ละ report
- หัว accordion: ลำดับ + ไอคอน ✓/✗ + ข้อความเช็คลิสต์ (truncate) + badge จำนวนสื่อ
- ยุบเริ่มต้น; ของที่ `is_passed === false` ให้ขยายอัตโนมัติ (`defaultValue`)
- เนื้อหา: หมายเหตุ + grid สื่อ (รูปกดเปิด lightbox/วิดีโอเล่นในตัว)
- ปรับ grid สื่อจาก 4 คอลัมน์ → `grid-cols-3 sm:grid-cols-4` และเพิ่ม `aspect-square object-cover` ให้ thumbnail สม่ำเสมอบนมือถือ
- เพิ่ม simple lightbox: คลิกรูป → เปิด `Dialog` แสดงเต็มจอ (reuse shadcn `Dialog`)

### ไฟล์ที่แก้
- `src/routes/qc.tsx` — validation + UI hint
- `src/routes/_protected.qc-reports.tsx` — ปุ่ม export + accordion + lightbox
- `src/lib/qc-export.ts` (ใหม่) — CSV builder

### นอกขอบเขต
- ไม่มีการเปลี่ยน schema ฐานข้อมูล (กฎบังคับเป็น client-side; ของเดิม server ก็รับ media array อยู่แล้ว)
- ไม่แตะ admin panel/sidebar
