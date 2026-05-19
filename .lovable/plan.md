## เป้าหมาย
1. เปลี่ยน Top-nav ของหน้าแอดมินเป็น **Sidebar ซ้าย** (ย่อเป็นไอคอนได้)
2. **แตกไฟล์ใหญ่** ที่เริ่มบวมและ **รวมโค้ดซ้ำ** เพื่อให้ดูแลง่ายเมื่อข้อมูล/ฟีเจอร์โต
3. ไม่เปลี่ยนพฤติกรรม/business logic เลย — refactor ล้วน

---

## ส่วนที่ 1 — Admin Sidebar

ไฟล์ใหม่:
- `src/components/AdminSidebar.tsx` — ใช้ shadcn `Sidebar` (collapsible="icon"), เมนู: Dashboard, History, QC, Manage, Storage. ไฮไลต์เมนูปัจจุบันด้วย `useRouterState`, แสดง tooltip ตอนย่อ

แก้:
- `src/routes/_protected.tsx`
  - ห่อด้วย `SidebarProvider` + `AdminSidebar` + `SidebarInset`
  - Header เหลือ: `SidebarTrigger` (ซ้าย) + ชื่อหน้าปัจจุบัน + ปุ่ม **Logout** (ขวา)
  - ลบปุ่มเมนูทั้งหมดออกจาก `AppHeader`

มือถือ: shadcn sidebar เปิดเป็น drawer อัตโนมัติเมื่อจอเล็ก

---

## ส่วนที่ 2 — Refactor โครงไฟล์

### 2.1 แตก `_protected.manage.tsx` (1460 บรรทัด)
ย้าย panel แต่ละตัวเป็นไฟล์ใน `src/components/manage/`:
- `CategoriesPanel.tsx`
- `EmployeesPanel.tsx` (+ `EmployeeEditor`)
- `StepsPanel.tsx` (+ `StepEditor`)
- `BannersPanel.tsx`
- `AnnouncementsPanel.tsx`
- `QcEmployeesPanel.tsx`

`_protected.manage.tsx` เหลือเฉพาะ route + Tabs ที่ประกอบ panel เหล่านี้

### 2.2 แตก `_protected.dashboard.tsx` (1931 บรรทัด)
- `src/components/dashboard/` — `StatCard.tsx`, `ChartCard.tsx`, `PctBadge.tsx`, `EmptyChart.tsx`, `MultiSelectGroup.tsx`, `Section.tsx`
- `src/lib/dashboard-utils.ts` — `CHART_COLORS`, `makePieLabel`, helpers คำนวณ aggregation
- `_protected.dashboard.tsx` เหลือเฉพาะ container + state + composition

### 2.3 รวมโค้ดซ้ำ → `src/lib/admin-helpers.ts`
ย้าย `requireToken()` + `showError()` ที่ซ้ำกันใน manage/dashboard/qc-reports/storage มาไฟล์เดียว, รวม `formatBytes()` (จาก storage), `formatDuration()`, badge ตัวช่วยต่างๆ

### 2.4 แตก `src/lib/admin.functions.ts` (613 บรรทัด)
แบ่งตามโดเมน — *แค่ย้ายฟังก์ชัน ไม่แก้ลายเซ็น* เพื่อไม่กระทบฝั่ง client:
- `src/lib/admin/auth.functions.ts` — verifyAdminPassword, checkAdminToken
- `src/lib/admin/categories.functions.ts`
- `src/lib/admin/employees.functions.ts`
- `src/lib/admin/steps.functions.ts`
- `src/lib/admin/banners.functions.ts`
- `src/lib/admin/announcements.functions.ts`
- `src/lib/admin/qc.functions.ts` — qc employees + checklists + reports
- `src/lib/admin/logs.functions.ts` — adminFetchLogs

`src/lib/admin.functions.ts` กลายเป็น **barrel re-export** เพื่อ import path เดิมยังใช้ได้ (ไม่ต้องแก้ทุกหน้าจอ)

### 2.5 จัด type
สร้าง `src/lib/admin-types.ts` รวบ interface ที่ใช้ร่วมกัน (Employee, Step, Category, Banner, Announcement, QcEmp) แทนการประกาศซ้ำในแต่ละไฟล์

---

## ขอบเขตที่ "ไม่ทำ" ในรอบนี้
- ไม่แก้ schema / index ฐานข้อมูล (ถ้าต้องการตอนหลังค่อยทำแยก migration)
- ไม่เปลี่ยน business logic, request/response, RLS
- ไม่แตะ `qc.tsx` (mobile inspector) เพราะเป็นหน้าผู้ใช้ ไม่ใช่ admin

---

## ผลลัพธ์ที่คาดหวัง
- หน้า admin มี sidebar ซ้ายตามภาพมาตรฐาน shadcn — toggle ได้, มือถือเป็น drawer
- ไม่มีไฟล์ route ใหญ่เกิน ~400 บรรทัด
- ลด duplicate ของ `requireToken` / `showError` / format helpers
- Import path เดิม (`@/lib/admin.functions`) ยังใช้ได้เพราะมี barrel
- Type-check และ build ผ่าน, พฤติกรรมเดิมทุกอย่าง
