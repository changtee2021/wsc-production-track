## เพิ่ม fade สีน้ำเงินเข้มที่ด้านล่างหน้าแรก

แก้ที่ `src/routes/index.tsx` เท่านั้น

เพิ่ม overlay `<div>` ภายใน `<section>` ของแบนเนอร์ วางก่อน header/dots/SlideToConfirm เพื่อให้ปุ่มยังกดได้:

```tsx
<div
  aria-hidden
  className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-1/4 bg-gradient-to-t from-primary via-primary/70 to-transparent"
/>
```

- ใช้ `from-primary` (สีน้ำเงินเข้มของธีม) ไล่ขึ้นเป็นโปร่งใส
- สูง `h-1/4` (1/4 ของจอ) ตามที่ขอ
- `pointer-events-none` ไม่บังการสไลด์
- `z-[5]` อยู่เหนือรูปแต่ใต้ header/dots/SlideToConfirm (z-10)

ผลลัพธ์: ครึ่งล่างของแบนเนอร์ค่อยๆ จางเป็นสีน้ำเงินเข้ม ทำให้ SlideToConfirm และ dots อ่านง่ายขึ้น