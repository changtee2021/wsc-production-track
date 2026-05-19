## ปัญหาบน iOS Safari ปัจจุบัน

ไฟล์ `src/components/QrScannerDialog.tsx` ใช้ `html5-qrcode` แบบ enumerate device IDs ซึ่งบน iOS มักจะติดปัญหา:

1. **iOS Safari ไม่คืน `label` ของกล้องจนกว่าจะอนุญาต permission** ทำให้ regex หา "back/rear/environment" ไม่เจอ และเปิดกล้องหน้าหรือเปิดไม่ติดเลย
2. **`<video>` ที่ไม่มี `playsInline`** บน iOS จะถูกบังคับเล่นแบบ fullscreen → preview ไม่โผล่ใน dialog → ดูเหมือนสแกนไม่ติด
3. **เปิดกล้องตอน dialog ยัง animate อยู่** บางครั้ง iOS ปฏิเสธ getUserMedia เพราะ container ยังไม่ visible
4. **ไม่ได้ใช้ native `BarcodeDetector` API** ที่ iOS 17+ Safari รองรับแล้ว ทำให้ใช้ JS scan ตลอดเวลา ช้า + กิน CPU + แบตร้อน
5. **ไม่มี fallback** เวลากล้องเปิดไม่ติด ผู้ใช้ติดอยู่หน้าจอดำ

## สิ่งที่จะทำ (เฉพาะไฟล์ `QrScannerDialog.tsx`)

### 1. เปลี่ยนวิธีเลือกกล้อง — ใช้ `facingMode` แทน device ID
แทนที่จะ `getCameras()` → match label → ใช้ id ตรง ๆ จะส่ง constraint:
```ts
{ facingMode: { ideal: "environment" } }
```
ให้ `Html5Qrcode.start()` ซึ่งทั้ง iOS Safari และ Android Chrome เคารพ และจะคืนค่ากล้องหลังเป็น default ทันที โดยไม่ต้องอ่าน label

ปุ่ม "สลับกล้อง" ยังใช้งานได้ — กดสลับระหว่าง `environment` ↔ `user`

### 2. บังคับ `playsInline` + `muted` + `autoplay` บน video element
ใช้ MutationObserver หรือ effect หลัง start เพื่อ set:
```ts
video.setAttribute('playsinline', 'true');
video.setAttribute('webkit-playsinline', 'true');
video.muted = true;
video.autoplay = true;
```
แก้ปัญหา iOS เปิด fullscreen / ไม่เล่น preview

### 3. ลองใช้ native `BarcodeDetector` ก่อน (เร็วกว่า html5-qrcode มากบน iOS 17+)
ก่อน fallback ไป html5-qrcode:
- ตรวจ `'BarcodeDetector' in window` และ `BarcodeDetector.getSupportedFormats()` มี `qr_code`
- ถ้ามี: เปิด `getUserMedia` เอง + ใส่ใน `<video playsInline>` แล้ว loop `requestAnimationFrame` เรียก `detector.detect(video)` ทุก ~200ms
- ถ้าไม่มี (iOS < 17, Android เก่า): fallback `Html5Qrcode` แบบใหม่ที่ใช้ facingMode

### 4. เพิ่ม delay หลัง dialog เปิดเต็มที่ก่อนเรียก camera (300ms แทน 50ms)
และตรวจว่า `#qr-scan-region` มีขนาด > 0 จริง ๆ ก่อน start เพื่อให้ iOS ไม่ปฏิเสธ

### 5. ปุ่ม fallback "ถ่ายภาพ QR แทน"
เพิ่ม `<input type="file" accept="image/*" capture="environment">` ที่ใช้ `Html5Qrcode.scanFile()` decode รูปจาก Camera app — แก้กรณีที่ permission กล้องโดน user block หรือ browser อื่นที่ไม่รองรับ live scan (เช่น Line in-app browser, FB browser บน iOS)

### 6. ข้อความ error ให้ชัดขึ้น
แยกเคส: `NotAllowedError` → "กรุณาอนุญาตให้เข้าถึงกล้องในการตั้งค่า Safari", `NotFoundError` → "ไม่พบกล้อง", `NotReadableError` → "กล้องถูกใช้งานโดยแอปอื่นอยู่"

## ไฟล์ที่จะแก้
- `src/components/QrScannerDialog.tsx` (ไฟล์เดียว — โค้ดสแกนถูก isolate อยู่ที่นี่ทั้งหมด ใช้ใน worker home และ QC zone)

## ไม่แตะ
- ระบบสแกนของ worker / QC flow อื่น ๆ ที่เรียก `<QrScannerDialog />` — API props เดิม (`open`, `onOpenChange`, `onScanned`) คงเหมือนเดิม
