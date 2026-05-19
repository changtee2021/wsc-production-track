## แผนแก้ iOS QR Scanner Compatibility

### ข้อจำกัดสำคัญของ iOS
- เว็บไซต์/เว็บแอป **ไม่สามารถกดอนุญาตกล้องแทนผู้ใช้ หรือเปิดกล้องอัตโนมัติโดยไม่ผ่าน permission prompt ได้** เพราะเป็นข้อจำกัดความปลอดภัยของ iOS/Safari
- เว็บไซต์ **ไม่สามารถพาผู้ใช้ไปเปิดสิทธิ์กล้องใน Settings อัตโนมัติได้** แบบ native app; ทำได้เพียงแสดงคำแนะนำที่ชัดเจนและให้ผู้ใช้กดอนุญาตเอง
- สิ่งที่แก้ได้คือทำให้การขอสิทธิ์เกิดจาก user gesture ชัดเจนขึ้น, ลด constraint ที่ iOS เก่าไม่รองรับ, และมีโหมด fallback ที่เปิดกล้องติดง่ายกว่า

### สิ่งที่จะปรับใน `src/components/QrScannerDialog.tsx`
1. **เพิ่ม iOS legacy compatibility mode**
   - ตรวจ iOS/Safari และถ้า live camera เปิดไม่สำเร็จ จะ retry แบบขั้นบันไดโดยลดความยากของ camera constraints
   - ลำดับ retry เช่น:
     1. `facingMode: { ideal: "environment" }` + 1280x720
     2. `facingMode: "environment"` แบบไม่กำหนด resolution
     3. `video: true` ให้ iOS เลือกกล้องเอง
     4. fallback ไป html5-qrcode แบบ fps ต่ำ/qrbox เล็กลง

2. **ปรับ fps / qrbox สำหรับ iOS เก่า**
   - ลด fps เหลือประมาณ 5–7 fps บน legacy mode เพื่อลด CPU และเพิ่มเสถียรภาพ
   - ปรับ `qrbox` ให้ไม่ใหญ่เกินไปบนหน้าจอ iPhone และคำนวณจากขนาด container จริง
   - ลด/ถอด `aspectRatio` ใน fallback บางเคส เพราะ iOS เก่าบางตัว reject constraint ได้ง่าย

3. **เปลี่ยน flow การเปิดกล้องให้ผูกกับการกดปุ่มชัดเจนขึ้น**
   - ถ้าเปิดทันทีตอน dialog แสดงแล้ว iOS ปฏิเสธ จะขึ้นปุ่ม **“เปิดกล้องอีกครั้ง”** เพื่อให้การเรียก `getUserMedia()` เกิดจากการกดของผู้ใช้โดยตรง
   - ยังคงพยายาม auto-start เมื่อ dialog เปิด แต่ถ้าล้มเหลวจะไม่ปล่อยหน้าจอดำเฉย ๆ

4. **เพิ่ม permission preflight และข้อความแนะนำเฉพาะ iOS**
   - ตรวจ `navigator.mediaDevices` / secure context / permission state เท่าที่ browser รองรับ
   - แยกข้อความสำหรับ:
     - ยังไม่ได้อนุญาตกล้อง
     - ผู้ใช้กด Block
     - เปิดจาก in-app browser เช่น LINE/Facebook ที่มักจำกัดกล้อง
     - ไม่มี `navigator.mediaDevices` หรือไม่ได้เปิดผ่าน HTTPS
   - เพิ่มข้อความแนะนำสั้น ๆ เช่น “แตะ AA/เมนูเบราว์เซอร์ > Website Settings > Camera > Allow” หรือ “เปิดใน Safari” เมื่อจำเป็น

5. **ปรับ fallback ถ่ายภาพ QR ให้เด่นและใช้งานต่อได้**
   - เมื่อ live camera เปิดไม่ติด จะแสดง fallback “ถ่ายภาพ QR แทน” เป็นทางเลือกหลัก
   - หลังเลือกไฟล์แล้ว decode ไม่ได้ จะคืนสถานะให้กดเปิดกล้องใหม่ได้ ไม่ค้างจอดำ

### ผลลัพธ์ที่คาดหวัง
- iOS รุ่นเก่า/เบราว์เซอร์ในแอปมีโอกาสเปิดกล้องติดมากขึ้นจาก retry แบบขั้นบันได
- ถ้าระบบ iOS บล็อก permission จริง ผู้ใช้จะเห็นสาเหตุและทางแก้ทันทีแทนจอดำ
- ยังไม่สามารถ bypass permission ของ iOS ได้ แต่จะลดโอกาส “กดแล้วไม่เกิดอะไรขึ้น” ให้มากที่สุด