# LINE Notification Test (Admin)

## เป้าหมาย
ปุ่มทดสอบส่งข้อความเข้า LINE จากหน้า Admin Dashboard เพื่อยืนยันว่า LINE Messaging API เชื่อมต่อสำเร็จ

## 1. Secrets (ต้องใส่ก่อนใช้งาน)
ขอเพิ่ม 2 ค่าใน Lovable Cloud secrets:
- `LINE_CHANNEL_ACCESS_TOKEN` — Channel access token (long-lived) จาก LINE Developers Console
- `LINE_TARGET_USER_ID` — userId / groupId ปลายทาง (ขึ้นต้นด้วย `U...` หรือ `C...`)

จะเรียก `secrets--add_secret` ก่อนเขียนโค้ดที่ใช้ค่าเหล่านี้

## 2. Server function — `src/lib/line.functions.ts`
สร้าง `adminSendLineTest({ token })`:
- ใช้ `assertAdmin(token)` (pattern เดียวกับ admin functions อื่น)
- อ่าน env ภายใน `.handler()` — ถ้าไม่มีโยน error ภาษาไทยที่อ่านง่าย
- `fetch('https://api.line.me/v2/bot/message/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer ${LINE_CHANNEL_ACCESS_TOKEN}\` }, body: JSON.stringify({ to: LINE_TARGET_USER_ID, messages: [{ type: 'text', text: '🎯 Test Notification from WSC Production Track App! Your LINE integration is working 100% perfectly.' }] }) })`
- ถ้า `!res.ok` → อ่าน body แล้ว throw `LINE API ${status}: ${message}`
- คืน `{ ok: true, sentAt: new Date().toISOString() }`

## 3. UI — เพิ่มการ์ดในหน้า Dashboard
แก้ `src/routes/_protected.dashboard.tsx` เพิ่ม section "ทดสอบการแจ้งเตือน LINE":
- ปุ่ม "ส่งข้อความทดสอบ" (`Button` + icon `Send` จาก lucide)
- ระหว่างกดแสดง `Loader2` หมุน + disabled
- สำเร็จ → `toast.success("ส่งข้อความทดสอบสำเร็จ ✅")`
- ล้มเหลว → `toast.error(msg)` (ใช้ `showError` จาก `admin-helpers.ts`)

## 4. Auto system_logs (กฎโปรเจกต์)
แนบ INSERT log เข้า `system_logs` ผ่าน `supabase--insert`:
- title: "เพิ่มฟีเจอร์ทดสอบส่ง LINE Notification"
- category: `feature`
- paths: `["src/lib/line.functions.ts","src/routes/_protected.dashboard.tsx"]`

## ขอบเขตที่ไม่ทำ
- ไม่ทำหน้าตั้งค่า token ผ่าน UI (ใช้ secret อย่างเดียว)
- ไม่ทำ webhook รับข้อความขาเข้า
- ไม่รองรับ multicast/broadcast — push เดี่ยวเท่านั้น
