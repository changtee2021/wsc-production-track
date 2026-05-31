
# แผนพัฒนา: AI Receipt Scanner + ระบบเบิกค่าใช้จ่าย + รายงานประจำเดือน

ทำครบทั้ง 3 ส่วนในเฟสเดียว: สแกนใบเสร็จด้วย AI → Workflow อนุมัติ 5 สถานะ → แจ้งเตือน LINE → Dashboard รายงานเดือน + VAT + ค่าเสื่อมราคา

---

## 1) โครงสร้างฐานข้อมูล (Migration)

**ตารางใหม่:**

- `expense_categories` — หมวดค่าใช้จ่าย (น้ำมัน, อุปกรณ์, ค่าซ่อม, อาหาร, อื่นๆ) — มีฟิลด์ `keywords[]` ให้ AI ใช้ auto-map
- `expenses` — รายการเบิก 1 ใบเสร็จ = 1 แถว
  - `exp_no` (EXP-YYMM-NNNN auto)
  - `requester_employee_id`, `requester_name`
  - `bill_type` (`cash` | `short_tax` | `full_tax`)
  - `merchant_name`, `tax_id`, `receipt_no`, `receipt_date`
  - `subtotal`, `vat_amount`, `total_amount`
  - `category_id`, `note`
  - `image_paths[]` (รูปใบเสร็จ — เก็บใน private bucket `expense-receipts`)
  - `buyer_match_wsc` (bool — กรณีบิลเต็ม)
  - `linked_office_request_id` (nullable — ผูกกับการเบิกของ office ได้)
  - `ai_extracted` jsonb (raw output จาก AI เก็บไว้ debug)
  - `ai_confidence` numeric
  - `status` (`pending` | `under_review` | `approved` | `rejected` | `paid`)
  - `approver_employee_id`, `approver_name`, `approved_at`
  - `reject_reason`, `paid_at`, `paid_by`
  - `duplicate_of` uuid (nullable — ชี้ใบเสร็จที่ซ้ำ)
- `expense_status_history` — log ทุกการเปลี่ยนสถานะ (who, when, from→to, note)

**Storage bucket:** `expense-receipts` (private, อ่านผ่าน signed URL — pattern เดียวกับ `qc-media`)

**Unique partial index** บน `(merchant_name, receipt_no, receipt_date)` where status != 'rejected' → ใช้ตรวจซ้ำ

**RLS:** block anon ทั้งหมด (server-only ผ่าน `supabaseAdmin` + token เดิม), grant `service_role`

**Seed:** หมวดเริ่มต้น 6 หมวด (อุปกรณ์ออฟฟิศ / ค่าน้ำมัน / ค่าซ่อม / ค่าอาหาร-รับรอง / ค่าขนส่ง / อื่นๆ)

---

## 2) Server Functions

ไฟล์ใหม่ใน `src/lib/`:

- `expense-session.ts` + `expense-token.server.ts` — token แบบเดียวกับ office (pattern เดิม)
- `expenses.functions.ts`:
  - `issueExpenseSession` — เปิด session พนักงาน
  - `expenseScanReceipt` — รับ image_path (อัปโหลดเข้า bucket ก่อน) → เรียก Gemini 2.5 Pro vision → คืน structured JSON (merchant, tax_id, receipt_no, date, subtotal, vat, total, bill_type, suggested_category_id, buyer_match_wsc)
  - `expenseCheckDuplicate` — query หาใบที่ merchant+receipt_no+date ซ้ำ
  - `expenseSubmit` — บันทึก expense (status=pending) พร้อม image_paths
  - `expenseListMine` — รายการของพนักงานคนนั้น
  - `expenseResubmit` — แก้รายการที่ rejected ส่งใหม่
  - `expenseGetSignedUrls` — signed URLs สำหรับรูป
- `expenses-admin.functions.ts`:
  - `adminExpenseList` — filter status/dept/date
  - `adminExpenseOpenReview` — เปลี่ยน pending → under_review (กันแย่งกัน review)
  - `adminExpenseApprove` — เลือก approver_employee_id (พนักงานออฟฟิศ) → status=approved
  - `adminExpenseReject` — ต้องระบุ reason
  - `adminExpenseMarkPaid` — paid + paid_at
  - `adminExpenseBulkApprove` — รับ ids[]
  - `adminExpenseBadgeCounts` — pending count (สำหรับ sidebar badge)
  - `adminExpenseMonthlyReport` — aggregate สำหรับ dashboard
- `line-notify.functions.ts` (เพิ่ม):
  - `notifyExpenseSubmitted` / `notifyExpenseStatusChanged` — ใช้ LINE_CHANNEL_ACCESS_TOKEN + LINE_TARGET_GROUP_ID ที่มีอยู่
- `depreciation.server.ts` — สูตรเส้นตรง: `monthly_dep = (purchase_price - salvage_value) / useful_life_months` ใช้กับ `office_assets`

**AI:** Lovable AI Gateway, model `google/gemini-2.5-pro`, ส่ง image + system prompt ภาษาไทย, ใช้ structured output (Output.object + zod schema). Handle 429/402 → คืน error ให้ UI

---

## 3) หน้าจอ Frontend

**Public (พนักงาน):**

- `/expense-scan` — หน้าหลักของฟีเจอร์
  - เลือกพนักงาน (เหมือน `/supplies-request`)
  - ปุ่ม **ถ่ายภาพ** (camera capture) / **อัปโหลด** (PDF/image, รองรับหลายไฟล์)
  - แสดง spinner "กำลังอ่านข้อมูล..." ขณะเรียก AI
  - **Review screen** แบ่ง 2 ส่วน: รูปด้านบน / ฟอร์มที่ AI กรอก (แก้ไขได้ทุกฟิลด์)
  - Badge `bill_type` (เงินสด / ย่อ / เต็ม) เปลี่ยนตามที่ AI ตรวจ
  - แจ้งเตือนสีแดงถ้า duplicate / `buyer_match_wsc=false`
  - เลือกหมวด (AI suggest ไว้แล้ว) + ผูกกับ office_request ได้ (optional dropdown)
  - ปุ่ม "ส่งขออนุมัติ"
- `/expense-mine` — ประวัติของพนักงาน, แสดงสถานะสี, ถ้า rejected กดเข้าไปดูเหตุผล + Re-submit ได้
- ปุ่มที่หน้าแรก (`/`) มุมขวาบน: **"เบิกค่าใช้จ่าย"** (icon Receipt)

**Admin (ผ่าน `_protected`):**

- `/_protected/expenses-dashboard` — Inbox อนุมัติ
  - Filter: status / date / requester / category
  - Card ต่อรายการ: thumbnail รูป + ข้อมูลที่ AI สแกน
  - ปุ่ม Approve (เปิด dialog เลือก `approver_employee_id` จากพนักงานออฟฟิศ) / Reject (กรอกเหตุผล) / Mark Paid
  - **Bulk approve** checkbox + ปุ่ม
  - กดรูปเปิด lightbox เทียบกับฟอร์ม
- `/_protected/expenses-reports` — รายงานประจำเดือน
  - **KPI cards:** ยอดอนุมัติเดือนนี้ / รออนุมัติ / ใบซ้ำที่ถูกบล็อก / ค่าเสื่อมรวมเดือนนี้
  - **Pie chart:** spending by category (Recharts — มีอยู่แล้ว)
  - **Bar chart:** ค่าใช้จ่ายรายเดือนย้อนหลัง 6 เดือน
  - **ตาราง VAT Summary:** Net / VAT / รวม แยกบิลเต็ม
  - **ตารางค่าเสื่อมราคา:** อ่านจาก `office_assets` คำนวณ straight-line
  - **ตาราง Reimbursement:** approved ที่ยังไม่ paid
  - **ปุ่ม Export:** CSV (สำหรับบัญชี) + Print → PDF (window.print + CSS print)
  - Date range picker + filter department
- **Sidebar:** หมวด "ค่าใช้จ่าย" → "Inbox อนุมัติ" (badge แสดง pending) + "รายงานประจำเดือน"

---

## 4) LINE Notifications

ใช้ secret ที่มีอยู่ (`LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TARGET_GROUP_ID`):

- **Submitted:** แจ้งกลุ่มแอดมิน — "เบิกใหม่ EXP-XXXX จาก {ชื่อ} ยอด ฿{total} — {merchant}"
- **Approved/Rejected/Paid:** แจ้งกลุ่ม + (ถ้ามี) DM พนักงาน
- ส่งเฉพาะตอน status เปลี่ยน (เรียกใน `expenses-admin.functions.ts`)

---

## 5) AI Prompt (สรุป)

System prompt ภาษาไทย สั่ง Gemini 2.5 Pro:
- อ่านใบเสร็จไทย คืน JSON ตาม zod schema
- ระบุ `bill_type` จากการมี/ไม่มี Tax ID และคำว่า "ใบกำกับภาษี"
- ถ้าเป็นบิลย่อ → คำนวณ VAT ย้อนกลับ (total × 7/107)
- เช็คชื่อผู้ซื้อมีคำว่า "WSC" หรือ "วิสุทธิ์ศิลป์" → `buyer_match_wsc=true`
- เดาหมวดจาก keywords ของ `expense_categories`
- คืน `ai_confidence` 0-1

---

## รายละเอียดทางเทคนิค

- ใช้ pattern เดียวกับ `office-requests` ทุกอย่าง (token, RLS, server fn, signed URLs)
- AI call ผ่าน `createServerFn` (server-only), ไม่เรียกจาก browser ตรง
- Image upload: browser → `expenseUploadReceipt` server fn → bucket
- Duplicate check: query DB ก่อน submit + แสดง warning ใน UI
- ค่าเสื่อม: คำนวณตอน query report ไม่เก็บ snapshot
- `system_logs` insert ทุก migration + ฟีเจอร์ใหม่ตามกฎ memory

---

## ไฟล์ที่จะสร้าง/แก้

**สร้างใหม่:**
- `supabase/migrations/XXX_expense_scanner.sql`
- `src/lib/expense-session.ts`, `expense-token.server.ts`
- `src/lib/expenses.functions.ts`, `expenses-admin.functions.ts`
- `src/lib/line-notify.functions.ts` (ถ้ายังไม่มี helper)
- `src/lib/depreciation.server.ts`
- `src/routes/expense-scan.tsx`, `expense-mine.tsx`
- `src/routes/_protected.expenses-dashboard.tsx`
- `src/routes/_protected.expenses-reports.tsx`

**แก้:**
- `src/routes/index.tsx` — ปุ่ม "เบิกค่าใช้จ่าย" มุมขวาบน
- `src/components/AdminSidebar.tsx` — เพิ่มหมวด "ค่าใช้จ่าย" + badge
- `src/routes/_protected.tsx` — title routes ใหม่

---

หลังอนุมัติแผน ผมจะเริ่มจาก migration → server functions → UI → LINE → reports ตามลำดับ
