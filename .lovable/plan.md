## เกิดอะไรขึ้น

จากรูป error คือหน้า `/scan` ยังมีการ insert ลง `production_logs` ด้วยสิทธิ์หน้าเว็บโดยตรง ทำให้โดน RLS บล็อก (`new row violates row-level security policy`) แทนที่จะวิ่งผ่าน server function ที่เพิ่งแก้ไว้

ในโค้ดปัจจุบันเห็นว่า `src/routes/scan.tsx` ถูกแก้ให้ใช้ `submitProductionLog` แล้ว และมี log บันทึกการแก้เมื่อ 07:16 ดังนั้นความเป็นไปได้หลักคือ preview/มือถือยังเปิด bundle เก่าหรือ service/cache เก่าที่ยังไม่ได้โหลดโค้ดใหม่

## แผนแก้

1. ตรวจ build/runtime signal ของ server function `submitProductionLog` ว่าถูกเรียกได้จริงและไม่มี error ฝั่ง server
2. ถ้า function ใช้ได้ ให้บังคับให้หน้า `/scan` โหลดโค้ดใหม่ชัดเจน เช่นเพิ่มการเปลี่ยนแปลงเล็กน้อยที่ทำให้ preview rebuild และตรวจว่าไม่มี direct insert เหลือ
3. ถ้ายังมี direct insert จาก production/published URL ให้ปรับ route ให้ใช้ server function อย่างเดียว และไม่ import/use write path ผ่าน browser client สำหรับ `production_logs`
4. เพิ่ม `system_logs` ภาษาไทยหลังแก้ ตามกฎโปรเจกต์
5. ทดสอบด้วยสัญญาณที่เกี่ยวข้อง: network/console หรือ server function logs เพื่อยืนยันว่า error RLS ไม่กลับมา