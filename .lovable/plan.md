## เป้าหมาย
แสดงรหัสเวอร์ชันแอปในรูปแบบ `APP-QC-000 R.00 bfd 06.06.26` โดย:
- `R.00 → R.01 → R.02 …` รันเพิ่มทุกครั้งที่มีการอัปเดตแอป
- `bfd DD.MM.YY` = วันที่อัปเดตล่าสุด (เริ่มที่ `06.06.26`)
- ค่ามาจากไฟล์เดียว ผมจะแก้ให้อัตโนมัติทุกครั้งที่แก้โค้ด/เพิ่มฟีเจอร์

## ไฟล์ที่จะสร้าง/แก้

### 1. สร้าง `src/lib/utils/version.ts` (single source of truth)
```ts
export const APP_VERSION = {
  code: "APP-QC-000",
  revision: "R.00",
  date: "06.06.26", // DD.MM.YY
} as const;

export const APP_VERSION_STRING =
  `${APP_VERSION.code} ${APP_VERSION.revision} bfd ${APP_VERSION.date}`;
```

### 2. สร้าง `src/components/AppVersion.tsx`
คอมโพเนนต์เล็ก ๆ แสดงข้อความเวอร์ชัน รับ `className` ปรับสีได้ ใช้ `text-xs text-muted-foreground tracking-wide` เป็นค่าเริ่มต้น

### 3. แสดงผล 3 จุด
- **หน้าแรก (`src/routes/index.tsx`)** — ใต้ข้อความ `WSC ProductionTrack` ใน hero header (บรรทัด ~128) ใช้สีอ่อนบนพื้น hero
- **Admin sidebar (`src/components/AdminSidebar.tsx`)** — เพิ่ม `<SidebarFooter>` ล่างสุด ก่อนปิด `<Sidebar>` ซ่อนเมื่อ collapsed
- **ทุกหน้าที่ไม่ใช่แอดมิน** — เพิ่ม `<footer>` ใน `src/routes/__root.tsx` (RootComponent) แสดงเฉพาะเมื่อ path ไม่ขึ้นต้นด้วย admin layout (`/dashboard`, `/manage`, `/logs`, `/storage`, `/qc-summary`, `/qc-reports`, `/packing-summary`, `/packing-reports`, `/expenses-*`, `/supplies-admin`, `/supplies-dashboard`, `/supplies-reports`, `/maintenance-admin`, `/maintenance-master`, `/job-lookup`, `/logs-update`) — กล่าวอีกอย่าง: ทุก route ที่ matched กับ `_protected` layout ให้ซ่อน เพราะ admin มี sidebar footer อยู่แล้ว
  - ใช้ `useRouterState({ select: s => s.matches })` ตรวจว่ามี match id ที่มี `_protected` หรือไม่
  - footer style: `text-center text-[10px] text-muted-foreground py-2`

## กฎการรันเลขในอนาคต
ทุกครั้งที่ผมแก้โค้ด/เพิ่มฟีเจอร์/แก้บั๊ก (event ที่บันทึก system_logs อยู่แล้ว) จะ:
1. เปิด `src/lib/utils/version.ts`
2. บวก `revision` ทีละ 1 (`R.00` → `R.01` → … → `R.99` → `R.100`)
3. อัปเดต `date` เป็นวันปัจจุบันรูปแบบ `DD.MM.YY`
4. แนบไปกับ commit/migration เดียวกัน

## สิ่งที่จะ**ไม่**ทำ
- ไม่ดึงจาก git commit (รัน runtime ไม่ได้)
- ไม่ดึงจาก system_logs (ทำให้ทุกหน้ายิง query เพิ่ม)
- ไม่แตะ `_protected.tsx`, sidebar layout, หรือ business logic อื่น
