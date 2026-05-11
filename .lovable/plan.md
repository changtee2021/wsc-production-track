## ปัญหา
แบนเนอร์ 3 รูปยังโหลดมาได้ (เห็นเป็น 3 dots) แต่ภาพไม่แสดง เพราะ `Carousel` (shadcn) ไม่ส่ง `h-full` ลงไปที่ wrapper ภายใน — ตัว `<div className="overflow-hidden">` ของ embla จึงสูง 0 ทำให้ `CarouselItem` ที่ใช้ `h-full` ไม่มีความสูงจริง รูปเลยถูกซ่อน

## แก้

แก้ที่ `src/routes/index.tsx` โดยไม่แตะ `components/ui/carousel.tsx`:

1. ห่อ `<Carousel>` ใน `<div className="absolute inset-0">` เพื่อกำหนดกรอบความสูงชัดเจน
2. เพิ่ม `[&>div]:h-full` ให้ `<Carousel>` (ส่ง h-full ทะลุไป embla wrapper)
3. ให้ `CarouselContent` มี `h-full` (เดิมมีอยู่แล้ว) และ `CarouselItem` คง `h-full`
4. ตรวจ `<img>` ยังเป็น `absolute inset-0 h-full w-full object-cover` ตามเดิม

ผลลัพธ์: รูปแบนเนอร์กลับมาแสดงเต็มจอเหมือนเดิม dots/SlideToConfirm/header ยังลอยอยู่ด้านบน