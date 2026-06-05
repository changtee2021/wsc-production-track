## ปัญหา

Panel **"พนักงานฝ่ายผลิต"** ในหน้า `/manage` แสดง "ยังไม่มีพนักงาน" ทั้งที่ในฐานข้อมูลมี 30 คน เพราะ `EmployeesPanel` ใน `src/routes/_protected.manage.tsx` ดึงข้อมูลผ่าน browser client ตรงๆ (`supabase.from("employees").select("*")`) ซึ่งพึ่งพา RLS — ไม่สอดคล้องกับ panel แผนกอื่น (QC, แพ็ค, ช่างซ่อม, ออฟฟิศ) ที่ใช้ admin server function (`supabaseAdmin`) อ่านผ่าน service_role อย่างปลอดภัย

## แนวทางแก้

ทำให้ EmployeesPanel โหลดข้อมูลผ่าน server function เหมือนแผนกอื่น

### 1. เพิ่ม `adminListEmployees` ใน `src/lib/admin.functions.ts`

วางถัดจาก `adminDeleteEmployee` (รอบๆ บรรทัด 121–145) ใช้รูปแบบเดียวกับ `adminListQcEmployees`:

```ts
export const adminListEmployees = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, emp_code, nationality, avatar_url, active")
      .order("name");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
```

### 2. แก้ `EmployeesPanel` ใน `src/routes/_protected.manage.tsx`

- เพิ่ม `adminListEmployees` ใน import จาก `@/lib/admin.functions`
- เพิ่ม `const list = useServerFn(adminListEmployees);`
- เปลี่ยน `load()` จาก
  ```ts
  const { data, error } = await supabase.from("employees").select("*").order("name");
  ```
  เป็น
  ```ts
  try {
    const { rows } = await list({ data: { token: requireToken() } });
    setItems((rows as Employee[]) ?? []);
  } catch (e) { showError(e); }
  ```
- เอา `import { supabase } from "@/integrations/supabase/client"` ออก **เฉพาะกรณี**ที่ไฟล์ไม่ได้ใช้ที่อื่นในไฟล์เดียวกัน (เช็คก่อนลบ)

## บันทึก system_logs

แนบ INSERT แถวลง `public.system_logs` (category=`fix`) อธิบายว่าได้เปลี่ยน EmployeesPanel ให้โหลดผ่าน server function

## ผลลัพธ์

- Panel "พนักงานฝ่ายผลิต" แสดงรายชื่อพนักงานทั้ง 30 คนได้ทันทีเหมือนเดิม
- พฤติกรรมสอดคล้องกับ QC / แพ็ค / ช่างซ่อม / ออฟฟิศ ที่ใช้ admin token
- ไม่ต้องพึ่ง RLS policy ของตาราง `employees` อีก