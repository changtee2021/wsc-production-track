## ปรับปรุง UI และเพิ่มหน้าต้อนรับ

### สิ่งที่จะทำ

**1. เพิ่มหน้าต้อนรับใหม่ที่ `/` (Welcome screen)**
- สร้างไฟล์ใหม่ `src/routes/welcome.tsx` ไม่ได้ — แต่ย้ายหน้าสแกนปัจจุบันไป `/scan` แทน แล้วทำหน้า `/` (index) เป็นหน้า welcome
- ย้าย `src/routes/index.tsx` ปัจจุบัน → `src/routes/scan.tsx` (มีอยู่แล้วเป็นไฟล์เปล่า ต้องเช็ค) จริง ๆ ตอนนี้มี `src/routes/scan.tsx` อยู่แล้ว — จะตรวจและรวมให้ scan page ใช้ที่ `/scan`
- หน้า `/` ใหม่ประกอบด้วย:
  - รูปพื้นหลังเต็มจอแสดงภาพการทำงานของพนักงาน (ใช้รูป `WP_ALL_Line_บรอดแคสต์_1040x1300_8.png` ที่ผู้ใช้อัปโหลด → คัดลอกไป `src/assets/welcome-hero.png`)
  - Overlay gradient น้ำเงิน → โปร่งใส เพื่อความอ่านง่าย
  - โลโก้ + ชื่อแอป "ProductionTrack" ด้านบน
  - หัวข้อใหญ่ "ยินดีต้อนรับ" + คำอธิบายสั้น "ระบบติดตามการผลิต สแกนเพื่อเริ่มงาน"
  - **Slide-to-enter** ที่ก้นจอ (ใช้ `SlideToConfirm` ที่มีอยู่แล้ว) เลื่อนแล้ว navigate ไป `/scan`
  - ปุ่มเล็ก ๆ เข้าหน้าแอดมิน

**2. ปรับปรุง UI ให้สวยงามขึ้น (คงโทนฟ้า/น้ำเงิน/ขาว)**
- `src/components/AppHeader.tsx`: เพิ่ม gradient (primary → secondary), เลื่อนโลโก้ให้มีวงกลม backdrop, blur
- การ์ด/ปุ่มในหน้าสแกน: เพิ่ม rounded-3xl, soft shadow, gradient subtle บน Job ID card
- เพิ่ม CSS utility class `.glass-card` (white/80 + backdrop-blur + border) สำหรับการ์ดลอยบนรูปพื้นหลัง
- `SlideToConfirm`: เพิ่ม shimmer animation บน track ระหว่างไม่ได้ลาก เพื่อบ่งบอกว่าปัด/เลื่อนได้

**3. การนำทาง**
- AppHeader โลโก้ลิงก์ไป `/` (welcome) แทน
- หน้า welcome → `/scan`
- หน้า scan ปุ่มย้อนกลับเล็ก ๆ ไป `/`

### ไฟล์ที่จะแก้/เพิ่ม
- เพิ่ม: `src/assets/welcome-hero.png` (คัดลอกจาก upload)
- เพิ่ม: `src/components/WelcomeHero.tsx` (optional — หรือทำใน index.tsx เลย)
- แก้: `src/routes/index.tsx` → หน้า welcome ใหม่
- แก้: `src/routes/scan.tsx` → ย้าย logic หน้าสแกนปัจจุบันมาที่นี่
- แก้: `src/components/AppHeader.tsx` → gradient + glass effect
- แก้: `src/components/SlideToConfirm.tsx` → shimmer hint
- แก้: `src/styles.css` → เพิ่ม `--gradient-hero` ที่เข้มขึ้น + utility สำหรับ shimmer

### ไม่กระทบ
- ไม่แตะ schema/database
- ไม่แตะหน้า admin/dashboard logic
- คงโทนสี ฟ้า/น้ำเงิน/ขาว ตามเดิม
