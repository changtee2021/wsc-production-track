## เป้าหมาย

- เพิ่มปุ่ม "นับสต๊อก" ในหน้าแรก (`/`) ต่อจากปุ่ม "แพ็คของ"
- ตั้งรหัสผ่าน `wscstock123` ก่อนเข้าหน้า `/stock-count` ครั้งแรก (จำสถานะ unlock ใน localStorage)

## ขั้นตอน

### 1. ปุ่มในหน้าแรก

- แก้ไข `src/routes/index.tsx`
- เพิ่ม `<Link to="/stock-count">` พร้อม `<Button>` ในช่องปุ่มล่าง ต่อจาก "แพ็คของ"
- ใช้สไตล์ ghost + backdrop-blur คล้ายปุ่ม QC หรือแพ็คของ เพื่อความสอดคล้อง

### 2. รหัสผ่านก่อนเข้าหน้าสต๊อก

- แก้ไข `src/routes/stock-count.tsx`
- ก่อนแสดง `StockCountWorkbench` ให้ตรวจสอบว่าผู้ใช้ปลดล็อกแล้วหรือยัง
- ถ้ายังไม่ปลดล็อก แสดงหน้ากรอกรหัสผ่าน:
  - ช่องกรอกรหัส (type=password หรือ plain text ตาม UX ที่เหมาะสม)
  - ปุ่ม "เข้าใช้งาน"
  - ถ้ากรอกถูก (`wscstock123`) → บันทึก flag ลง `localStorage` และแสดง `StockCountWorkbench`
  - ถ้ากรอกผิด → แสดงข้อความเตือน "รหัสผ่านไม่ถูกต้อง"
- ใช้ key `wsc_stock_unlocked` ใน localStorage

### 3. ไม่ต้องเปลี่ยน backend

- ไม่ต้องแก้ server function, migration, หรือ RLS
- รหัสผ่านเป็น client-side gate เท่านั้น

## ไฟล์ที่แก้

- `src/routes/index.tsx` — เพิ่มปุ่ม
- `src/routes/stock-count.tsx` — เพิ่ม passcode gate component
