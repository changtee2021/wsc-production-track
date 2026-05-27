## ปัญหา

วิดีโอใน QC report (และหน้าอื่นที่ใช้รูปแบบเดียวกัน) **กดเปิดแล้ว dialog ว่างเปล่า / โหลดไม่ขึ้น**

### สาเหตุที่แท้จริง

ตรวจ DB แล้วพบว่าวิดีโอที่บันทึกล่าสุดทั้งหมดเป็นไฟล์ `.mov` (ถ่ายจาก iPhone, codec HEVC/H.265):
- `video/89e990f1-...mov`
- `video/b159db30-...mov`
- `video/db59e1ed-...mov`

Chrome / Edge บน Windows **ไม่รองรับ codec HEVC** เลยเล่นไม่ได้ และโค้ดปัจจุบันไม่มี `onError` handler บน `<video>` ทำให้ dialog ดูเหมือนว่าง (จริงๆ มี `<video>` อยู่แต่ render ไม่ออก)

Storage / signed URL / RLS ทำงานปกติ — ปัญหาอยู่ที่ฝั่ง browser playback ล้วนๆ

## สิ่งที่จะทำ

### 1. เพิ่ม VideoPlayer component กลาง (`src/components/MediaLightbox.tsx`)
- ใช้ `<video onError={...}>` จับ error
- ถ้าเล่นไม่ได้ → แสดง fallback UI:
  - ข้อความ "เบราว์เซอร์นี้ไม่รองรับวิดีโอรูปแบบนี้ (มักเป็น .mov จาก iPhone)"
  - ปุ่ม **เปิดในแท็บใหม่** (เปิด signed URL ตรง — VLC/QuickTime/Player ในเครื่องเปิดได้)
  - ปุ่ม **ดาวน์โหลด** (force download ด้วย `download` attribute)
- เพิ่มปุ่ม "เปิดในแท็บใหม่" ใน lightbox เสมอ (ไม่ต้องรอ error) สำหรับ video — เป็น escape hatch ที่ใช้ได้ทุกกรณี

### 2. ใช้ component นี้ใน 3 หน้า lightbox ที่เกี่ยวข้อง
- `src/routes/_protected.qc-reports.tsx`
- `src/routes/_protected.packing-reports.tsx`
- `src/routes/_protected.job-lookup.tsx`

### 3. เตือนตอนอัปโหลด .mov ใน qc.tsx / packing.tsx / maintenance.tsx
- ก่อนอัปโหลด ตรวจ `file.type === "video/quicktime"` หรือนามสกุล `.mov`
- แสดง toast: "ไฟล์ .mov อาจเล่นไม่ได้บนคอมพิวเตอร์ Windows แนะนำให้ถ่ายเป็น MP4 (ตั้งค่ากล้อง iPhone → รูปแบบ → เข้ากันได้สูงสุด)"
- ไม่บล็อกการอัปโหลด (ผู้ใช้บางคนยังอย