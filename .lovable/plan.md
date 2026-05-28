## เป้าหมาย
แก้ปัญหากดเล่นวิดีโอไม่ได้บนมือถือ/iOS Safari และปรับ thumbnail ทุกจุดให้โหลดเบาขึ้น

## ไฟล์ที่จะแก้

### 1. `src/components/MediaLightbox.tsx` (ตัวเล่นใน Modal)
- ถอด `autoPlay` ออก (iOS Safari บล็อก autoplay มี audio)
- เพิ่ม `preload="metadata"`
- เพิ่ม `onPointerDownCapture={(e) => e.stopPropagation()}` กัน Radix Dialog ดักจับ touch
- คง `controls`, `playsInline`, `key={src}`, `onError` ไว้

### 2. Thumbnail `<video>` ในไฟล์ต่อไปนี้ — เติม `preload="metadata" muted playsInline` ให้ครบทุกจุด
- `src/routes/_protected.qc-reports.tsx` (2 จุด: บรรทัด 406, 517)
- `src/routes/_protected.packing-reports.tsx` (2 จุด: 406, 517)
- `src/routes/_protected.job-lookup.tsx` (1 จุด: 644)
- `src/routes/qc.tsx` (2 จุด: 835, 1045) — มี `muted` แล้ว เติม `preload="metadata" playsInline`
- `src/routes/packing.tsx` (2 จุด: 431, 499) — มี `muted` แล้ว เติม `preload="metadata" playsInline`

ไม่แตะ `QrScannerDialog.tsx` (ใช้สำหรับสแกน QR ไม่ใช่ media)

## หลังแก้
- รัน `bunx tsc --noEmit` ตรวจ TS
- INSERT `system_logs` (category: `fix`, summary ภาษาไทย, paths รายชื่อไฟล์ที่แก้)

## หมายเหตุ (ไม่ทำในรอบนี้)
ระบบ transcode `.mov`/HEVC → MP4/H.264 ฝั่ง server (FFmpeg) ยังไม่ทำ — runtime ของ Cloudflare Worker รัน FFmpeg ไม่ได้ ต้องใช้บริการภายนอกหรือย้ายไปประมวลผลที่อื่น ค่อยคุยแยกถ้าต้องการ
