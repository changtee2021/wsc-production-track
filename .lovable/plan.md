## ปัญหา

หน้า `/scan` กดเริ่ม/เสร็จงานไม่สำเร็จ เพราะตาราง `production_logs` มีแค่ RESTRICTIVE policy บล็อก write ทั้งหมด — ไม่มี permissive INSERT policy แล้ว (ถูกถอดออกตอน lock down ครั้งก่อน) ทำให้ `supabase.from("production_logs").insert(...)` จาก browser client ถูก RLS ปฏิเสธ → toast แสดง error message จาก Postgres

(`employees` แก้ไปแล้วในรอบที่ผ่านมา — รายชื่อขึ้นปกติ ปัญหานี้คือ insert ลง `production_logs` ต่างหาก)

## แนวทางแก้ — ใช้ server function เหมือนรายงาน QC/Packing

ไม่เปิด RLS ใหม่ให้ anon เขียนตรง ๆ แต่ทำ server fn ที่ validate แล้วเขียนผ่าน `supabaseAdmin`

### 1. สร้าง `src/lib/scan.functions.ts`

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const NOTE_IMG_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/log-notes/`;

const payload = z.object({
  job_id: z.string().min(1).max(200),
  employee_id: z.string().uuid(),
  step_id: z.string().uuid(),
  category_id: z.string().uuid(),
  action: z.enum(["start", "finish"]),
  note: z.string().trim().max(2000).nullable().optional(),
  note_image_url: z.string().url().max(1000).nullable().optional()
    .refine((u) => !u || u.startsWith(NOTE_IMG_PREFIX), "invalid note_image_url origin"),
});

export const submitProductionLog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => payload.parse(d))
  .handler(async ({ data }) => {
    // ตรวจว่าพนักงาน + step + category ยัง active จริง
    const [emp, step, cat] = await Promise.all([
      supabaseAdmin.from("employees").select("id, active").eq("id", data.employee_id).maybeSingle(),
      supabaseAdmin.from("steps").select("id, active").eq("id", data.step_id).maybeSingle(),
      supabaseAdmin.from("categories").select("id").eq("id", data.category_id).maybeSingle(),
    ]);
    if (!emp.data?.active) throw new Error("ไม่พบพนักงาน หรือพนักงานถูกปิดใช้งาน");
    if (!step.data?.active) throw new Error("ไม่พบขั้นตอน หรือถูกปิดใช้งาน");
    if (!cat.data) throw new Error("ไม่พบหมวดหมู่");

    const { error } = await supabaseAdmin.from("production_logs").insert({
      job_id: data.job_id,
      employee_id: data.employee_id,
      step_id: data.step_id,
      category_id: data.category_id,
      action: data.action,
      note: data.action === "finish" ? (data.note ?? null) : null,
      note_image_url: data.action === "finish" ? (data.note_image_url ?? null) : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

### 2. แก้ `src/routes/scan.tsx` `submit()`

- `import { submitProductionLog } from "@/lib/scan.functions";`
- เพิ่ม `const submitLog = useServerFn(submitProductionLog);`
- ใน `submit(action)` แทนที่บล็อค `supabase.from("production_logs").insert(...)` ด้วย
  ```ts
  try {
    await submitLog({ data: {
      job_id, employee_id: employeeId, step_id: stepId, category_id: categoryId,
      action,
      note: action === "finish" && hasIssue ? note.trim() : null,
      note_image_url: action === "finish" && hasIssue ? (noteImage?.path ?? null) : null,
    }});
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
    setSubmitting(null);
    return;
  }
  ```

### 3. system_logs

INSERT แถวลง `public.system_logs` (category=`bugfix`) ระบุว่าได้สลับ /scan ไปใช้ server fn เพื่อหลีกเลี่ยง RLS

## ผลลัพธ์

- กดเริ่ม/เสร็จงานในหน้า /scan ทำงานได้ปกติ
- RLS ของ `production_logs` ยังคงล็อกแน่น — write ต้องผ่าน server fn เท่านั้น
- เข้ากับแพทเทิร์น QC/Packing/Office ที่มีอยู่