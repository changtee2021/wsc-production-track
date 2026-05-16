## เป้าหมาย
ปรับ `/dashboard` 4 จุด: ย้ายตำแหน่งเซกชัน, ลดขนาดตัวอักษรใน pie, ขยายชุดสี, เพิ่มความสามารถพับ/กางหัวข้อ

## รายละเอียด

### 1. ย้ายลำดับเซกชัน
ย้าย **F. รายงานรายหมวดหมู่ — จำนวนชุด + เวลาเฉลี่ย/ขั้นตอน (รายวัน)** (บรรทัด ~1505–1600) ขึ้นไปไว้ **ก่อน** เซกชัน **รายงานรายพนักงาน × ขั้นตอน** (บรรทัด ~1258) — เลื่อน JSX block ทั้งก้อนไม่แก้ logic

### 2. ขยายชุดสี (CHART_COLORS)
ขยาย `CHART_COLORS` (บรรทัด 85–92) จาก 6 สี → 16+ สี ครอบคลุม hue ทั่ววงล้อ เพื่อไม่ให้ slice ซ้ำสีในชาร์ตที่มี step/พนักงาน 8–12 ตัว เช่น:
```ts
const CHART_COLORS = [
  "oklch(0.55 0.22 256)", // blue
  "oklch(0.65 0.20 145)", // green
  "oklch(0.70 0.18 60)",  // amber
  "oklch(0.60 0.24 25)",  // red-orange
  "oklch(0.55 0.22 310)", // magenta
  "oklch(0.65 0.18 190)", // teal
  "oklch(0.60 0.20 90)",  // yellow-green
  "oklch(0.50 0.22 280)", // purple
  "oklch(0.65 0.20 15)",  // red
  "oklch(0.55 0.18 220)", // sky
  "oklch(0.60 0.20 170)", // emerald
  "oklch(0.65 0.22 45)",  // orange
  "oklch(0.50 0.20 340)", // pink
  "oklch(0.55 0.18 130)", // lime
  "oklch(0.45 0.15 260)", // indigo deep
  "oklch(0.70 0.15 105)", // olive
];
```

### 3. ปรับ font size ใน pie chart labels
ทุก `<Pie label={...}>` ใน 4 เซกชัน (categoryDayReport ×2, stepBreakdownByCategory ×2):
- เปลี่ยน label จาก string function → custom render function ที่คืน `<text>` ด้วย `fontSize={10}` (จาก default 12–14)
- ตัด/wrap ชื่อยาวเป็น 2 บรรทัด: ถ้า name length > 12 → split เป็น 2 `<tspan>` (บรรทัดแรกชื่อ, บรรทัดสองค่า)
- ตัวอย่าง:
```tsx
label={({ cx, cy, midAngle, outerRadius, name, value }) => {
  const RAD = Math.PI / 180;
  const r = outerRadius + 18;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fontSize={10} textAnchor={x > cx ? "start" : "end"} fill="currentColor">
      <tspan x={x} dy="0">{name}</tspan>
      <tspan x={x} dy="12">{value}{suffix}</tspan>
    </text>
  );
}}
```
ใช้ helper function เดียวสร้าง label renderer (รับ `suffix` เช่น `" น."` หรือ `""`) เพื่อ DRY

### 4. หัวข้อพับ/กางได้
ใช้ `Collapsible` (`@/components/ui/collapsible` — มีอยู่แล้ว) ครอบทุก `<Card>` ระดับเซกชัน:
- เซกชันทั้งหมดที่จะครอบ: ตาราง ranking, Over-Standard, Histogram, By-Step matrix, 3D, 3E, MoM, F (categoryDayReport), และอื่นๆ ระดับเดียวกัน
- pattern:
  ```tsx
  <Collapsible defaultOpen>
    <Card>
      <CollapsibleTrigger asChild>
        <CardHeader className="cursor-pointer flex-row items-center justify-between">
          <CardTitle>...</CardTitle>
          <ChevronDown className="h-5 w-5 transition-transform data-[state=closed]:-rotate-90" />
        </CardHeader>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent>...</CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>
  ```
- `defaultOpen` → กางทุกหัวข้อตอนเข้าหน้า, ผู้ใช้กดหุบเอง
- import `ChevronDown` จาก `lucide-react` (น่าจะมีอยู่แล้ว)

## ไฟล์ที่แก้
- `src/routes/_protected.dashboard.tsx` (ไฟล์เดียว)

## ไม่แตะ
- โลจิกข้อมูล (`filtered`, `scopedSessions`, `categoryDayReport`, `stepBreakdownByCategory`)
- ฟิลเตอร์, export Excel, header
