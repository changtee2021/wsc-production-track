
# แผน 2 ส่วน

## ส่วน A — ไอเดียฟีเจอร์เพิ่มเติมสำหรับโรงงานผลิต

แบ่งเป็น 5 กลุ่ม เรียงตาม ROI / ความเหมาะสมกับฐานข้อมูลที่มีอยู่:

### 1. การผลิต & ประสิทธิภาพ (Production)
- **OEE Dashboard** — คำนวณ Availability × Performance × Quality ต่อเครื่อง/พนักงาน/วัน (ใช้ `production_logs` + `qc_reports` + `maintenance_tickets` ที่มีอยู่)
- **ใบสั่งผลิต (Work Order)** — ผูกหลาย job_id เป็นใบสั่งเดียว มีลูกค้า/กำหนดส่ง/จำนวน/สถานะ พร้อม progress bar อัตโนมัติจาก step ที่ปิด
- **Bottleneck Alert** — ตรวจจับ step ที่ใช้เวลาเกิน std_duration_minutes เกิน X% แจ้ง LINE
- **Shift Planner** — ตารางกะ เช้า/บ่าย/ดึก ผูกพนักงาน → คำนวณ workload และส่ง LINE เตือนก่อนเข้ากะ
- **Job Timeline / Gantt** — ดูไหลของแต่ละ job ผ่าน step ทั้งหมดในรูป Gantt

### 2. คุณภาพ & ของเสีย (Quality)
- **Defect Catalog** — บันทึก defect type (รอย, ขาด, สีเพี้ยน ฯลฯ) + Pareto chart หาสาเหตุหลัก
- **Rework Tracking** — เมื่อ QC fail สร้าง rework ticket อัตโนมัติ ติดตามจน pass
- **First Pass Yield (FPY)** — % ที่ผ่านครั้งแรกต่อ step / ต่อพนักงาน

### 3. ซ่อมบำรุง & สินทรัพย์ (Maintenance)
- **Preventive Maintenance (PM) Schedule** — กำหนดรอบ PM ต่อเครื่อง (ทุก X ชม. ใช้งาน หรือทุกเดือน) แจ้งเตือนล่วงหน้า
- **MTBF / MTTR** — เวลาเฉลี่ยระหว่างเสีย และเวลาซ่อม ต่อเครื่อง
- **QR Code ติดเครื่อง** — สแกนปุ๊บเปิดประวัติซ่อม + แจ้งซ่อมได้เลย (มีอยู่บางส่วนแล้ว ขยายเพิ่ม)
- **Low-stock alert ของอะไหล่** — auto-PR เมื่อ spare_parts.stock_qty ≤ min_qty

### 4. คน & ความปลอดภัย (People & Safety)
- **Time Clock / เช็คอินด้วย QR + selfie** — บันทึกเข้า-ออกงานจริง
- **Training & Skill Matrix** — ใครทำ step ไหนได้บ้าง พร้อมวันหมดอายุใบรับรอง
- **Safety Incident** — บันทึกอุบัติเหตุ/near miss + รูป + การแก้ไข
- **Daily Toolbox Talk** — หัวข้อความปลอดภัยประจำวัน + ลงชื่อ ack

### 5. การเงิน & คลังสินค้า (Finance & Inventory)
- **PO / ใบสั่งซื้อ** — ขั้นตอนก่อนรับสินค้า ผูกกับ `expenses` ที่มี
- **Budget vs Actual** — งบประมาณรายเดือน เทียบยอด expenses จริง
- **Inventory เต็มรูป** — วัตถุดิบ + สินค้าระหว่างผลิต (WIP) + สินค้าสำเร็จรูป (FG)
- **Cost per Job** — คำนวณต้นทุนจริงต่อ job (คน + อะไหล่ + ค่าใช้จ่าย)

> เลือกเฟสได้ตามต้องการ ผมแนะนำเริ่มจาก **OEE + Work Order + PM Schedule + Defect Catalog** ก่อน เพราะใช้ข้อมูลที่มีอยู่และเห็นผลเร็ว

---

## ส่วน B — อัปเกรด AI Chatbot ให้ตอบได้ครบทุกโมดูล

### ปัญหาปัจจุบัน
`buildContext()` ใน `src/lib/ai-admin.functions.ts` รู้แค่ 30 วันของ:
- production_logs, qc_reports, employees, steps, categories

**ไม่รู้:** packing, maintenance tickets, spare parts, office supplies/requests, office assets, expenses, announcements, asset depreciation

### แนวทาง: Tool-Calling Agent
เลิกยัด context ทุกอย่างเป็น JSON ก้อนใหญ่ (เปลือง token + ตอบไม่ตรง) → ใช้ **AI SDK + tool calling** ให้ Gemini เลือก query ที่ต้องการเอง

### โครงสร้างใหม่

**1. แทนที่ `aiAdminAsk` ด้วย streaming chat route** `src/routes/api/ai-admin-chat.ts`
- ใช้ `streamText` จาก `ai` package + Lovable AI Gateway provider
- model: `google/gemini-3-flash-preview` (เร็ว) หรือ `google/gemini-2.5-flash` (สมดุล)
- ตรวจ admin token ใน body ก่อน stream
- เก็บโควต้า 30 ข้อความ/วัน/token (เพิ่มจาก 20)

**2. กำหนด tools (~12 ตัว) ใน `src/lib/ai-admin-tools.server.ts`**
- `getProductionSummary({days})` — สรุป logs (ของเดิม)
- `getEmployeeStats({days, limit})` — ranking, avg time
- `getStepStats({days})` — bottleneck
- `getQcSummary({days, status?})` — open/resolved + รายการล่าสุด
- `getPackingSummary({days})` — รายงานแพ็คของ
- `getMaintenanceTickets({status?, days})` — รายการแจ้งซ่อม + MTTR
- `getSparePartsLowStock()` — อะไหล่ใกล้หมด
- `getOfficeStockLow()` — supplies ใกล้หมด
- `getOfficeRequests({status?, days})` — การเบิกของ
- `getExpensesSummary({month?, status?})` — สรุปค่าใช้จ่าย + VAT
- `getAssetDepreciation({month})` — ค่าเสื่อมตามสูตรเส้นตรง (เรียก `depreciation.server.ts`)
- `searchJob({jobId})` — รวม logs + qc + packing ของ job เดียว
- `getAnnouncements()` — ประกาศที่ active

ทุก tool ใช้ `supabaseAdmin` + zod input schema + ส่งกลับเฉพาะ field ที่ใช้ตอบ (compact)

**3. System prompt ใหม่**
```
คุณคือผู้ช่วยแอดมิน WSC ProductionTrack
ใช้ tools ที่มีเพื่อดึงข้อมูลก่อนตอบ — ห้ามเดา ห้ามแต่งตัวเลข
ถ้าผู้ใช้ถามนอกขอบเขตแอป ตอบว่า "ตอบได้เฉพาะเรื่องในระบบ WSC"
ตอบเป็นภาษาไทย กระชับ ใช้ bullet/ตาราง markdown
หากเป็นโหมด plan: ให้คำแนะนำเชิงปฏิบัติพร้อมตัวเลขสนับสนุน
```

**4. Frontend: `AdminAiAssistant.tsx`**
- เปลี่ยนเป็น `useChat` จาก `@ai-sdk/react` + `DefaultChatTransport`
- เพิ่ม markdown rendering (`react-markdown` + `remark-gfm`) — ตอนนี้แสดง plain text
- แสดง tool-call status เล็ก ๆ ใต้ข้อความ ("🔍 กำลังดึงข้อมูลซ่อมบำรุง...")
- เพิ่ม suggestion ใหม่ครอบคลุมทุกโมดูล:
  - "อะไหล่ตัวไหนใกล้หมด"
  - "ค่าใช้จ่ายเดือนนี้รวมเท่าไหร่ VAT เท่าไหร่"
  - "ใบแจ้งซ่อมที่ยังไม่ปิดมีกี่ใบ"
  - "job XYZ ตอนนี้ถึงขั้นตอนไหน"
- ใช้ `stopWhen: stepCountIs(50)` เพื่อให้เรียกหลาย tool ได้

**5. Performance & ความปลอดภัย**
- ทุก tool query มี `.limit()` ป้องกันดึงเกิน
- cache ระดับ request: ถ้า tool เดียวเรียกซ้ำใน turn เดียว ใช้ผลเดิม
- log การเรียก tool ลง console สำหรับ debug

### ไฟล์ที่ต้องสร้าง / แก้
- สร้าง: `src/routes/api/ai-admin-chat.ts` (streaming route)
- สร้าง: `src/lib/ai-admin-tools.server.ts` (tool definitions)
- สร้าง: `src/lib/ai-gateway.server.ts` (provider helper ตาม best practice)
- แก้: `src/components/AdminAiAssistant.tsx` (เปลี่ยนเป็น useChat + markdown)
- ลบ/ยุบ: `src/lib/ai-admin.functions.ts` (เก็บไว้เป็น fallback ก่อน หรือลบ)
- แพ็กเกจที่ต้องเพิ่ม: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `react-markdown`, `remark-gfm`
- บันทึก `system_logs` อัตโนมัติหลัง deploy

---

## คำถามก่อนเริ่ม

1. **ส่วน A:** อยากให้ผม implement ฟีเจอร์ใดบ้างต่อจากแผนนี้ (เลือกได้หลายข้อ) หรือยังแค่อยากเก็บไอเดียไว้?
2. **ส่วน B:** ทำเลยใช่ไหม? และต้องการ markdown rendering + streaming หรือเก็บ UI ปัจจุบัน (ไม่ stream) แค่ขยาย tools?
