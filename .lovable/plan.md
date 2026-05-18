## 1) แก้บั๊ก: ส่ง QC report แล้วไม่ขึ้นในหน้ารายงาน

**สาเหตุ:** ตาราง `qc_reports` ไม่มี foreign key ไปยัง `qc_employees`, `employees`, `steps`, `categories`, `production_logs` ตอนสร้าง migration ครั้งก่อน — แต่หน้า admin (`adminFetchQcReports`) ใช้ embedded select `qc_employees(name, emp_code), employees(name), steps(step_name), categories(name)` ซึ่ง PostgREST ต้องมี FK ถึงจะ join ได้ จึง throw `Could not find a relationship between 'qc_reports' and 'qc_employees'` ทำให้ทั้งหน้ารายงานพังและดูเหมือนข้อมูลไม่เข้า (จริงๆ insert สำเร็จแล้ว)

**แก้ด้วย migration:** เพิ่ม FK constraints บน `qc_reports`:
- `qc_employee_id` → `qc_employees(id)` ON DELETE RESTRICT
- `employee_id` → `employees(id)` ON DELETE SET NULL
- `step_id` → `steps(id)` ON DELETE SET NULL
- `category_id` → `categories(id)` ON DELETE SET NULL
- (ไม่ทำ FK กับ `production_logs` เพราะ table นั้นไม่มี RLS SELECT — ไม่จำเป็น)

หลัง migration PostgREST จะ refresh schema cache อัตโนมัติและ join ใช้ได้

---

## 2) AI Chatbot ผู้ช่วยแอดมิน (มุมขวาล่าง หน้า Dashboard)

**ขอบเขต**
- แสดงเฉพาะหน้า `/dashboard` (หลัง admin login)
- ปุ่มลอยมุมขวาล่าง กดเปิด popover/sheet chat
- ตอบเฉพาะเรื่องในแอป (พนักงาน, ขั้นตอน, หมวดหมู่, จำนวนชุด, เวลาเฉลี่ย, QC reports) — นอกเรื่องตอบปฏิเสธสั้นๆ
- 2 โหมด: **ถาม-ตอบสรุป** และ **ช่วยวางแผนการทำงาน**

**ควบคุม token / โควต้า**
- ใช้ Lovable AI Gateway (`google/gemini-3-flash-preview` — ฟรีและถูก)
- `max_tokens: 400` ต่อคำตอบ, system prompt บังคับให้สั้น กระชับ เป็น bullet
- เก็บประวัติแชทใน memory (ไม่ persist) — ส่งแค่ 6 ข้อความล่าสุดเข้า context
- จำกัด **20 ข้อความ/แอดมิน/วัน** (เก็บ count ใน localStorage + ตรวจที่ server ผ่าน in-memory counter เบาๆ)
- จัดการ error 402 (เครดิตหมด) และ 429 (rate limit) แสดง toast ชัดเจน

**Data context (สำคัญ)**
- ไม่ส่งทั้ง DB เข้า AI — server function `aiAdminAsk` จะดึง **สรุปย่อ** จาก Supabase ก่อน (เช่น top employees, totals ของ 30 วันล่าสุด, รายการ QC open) แล้วฝังเป็น context JSON สั้นๆ ใน system prompt
- ถ้า user ถามถึงพนักงานคนใดเฉพาะ → query targeted แล้วใส่ใน context

**ไฟล์ที่จะสร้าง/แก้**
- migration ใหม่ — เพิ่ม FK บน `qc_reports`
- `src/lib/ai-admin.functions.ts` — server fn `aiAdminAsk({ token, messages, mode })` เรียก Lovable AI Gateway + ดึง context จาก Supabase
- `src/components/AdminAiAssistant.tsx` — floating button + chat panel (toggle, รายการข้อความ, input, mode switch "ถาม-ตอบ" / "วางแผน", react-markdown render)
- แก้ `src/routes/_protected.dashboard.tsx` — mount `<AdminAiAssistant />`

**System prompt (ภาษาไทย)**
> คุณคือผู้ช่วยแอดมินของระบบติดตามการผลิตม่าน WSC ตอบเฉพาะเรื่องเกี่ยวกับข้อมูลในแอปนี้เท่านั้น (พนักงาน, ขั้นตอนผลิต, จำนวนชุด, เวลา, QC) ตอบสั้น กระชับ ใช้ bullet ไม่เกิน 6 บรรทัด ถ้าถามนอกเรื่องให้ปฏิเสธสั้นๆ

---

## คำถามที่อยากยืนยันก่อนลงมือ

1. Limit 20 ข้อความ/วัน ok ไหม? หรืออยากให้มากกว่านี้ / ไม่จำกัด?
2. โหมด "วางแผน" — ให้ AI แนะนำการจัดคน/ลำดับงานจากข้อมูล 30 วันล่าสุดพอไหม หรืออยากให้เลือกช่วงเวลาเอง?
3. แชทให้รีเซ็ตทุกครั้งที่ปิดหน้า (in-memory) หรือเก็บประวัติไว้ใน localStorage?
