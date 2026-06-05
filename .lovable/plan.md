## ปัญหา

หน้า `/scan` ดึงรายชื่อพนักงานจาก client ตรงๆ ผ่าน `supabase.from("employees").select(...)` แต่ตาราง `employees` มี policy แบบ **RESTRICTIVE สำหรับทุกคำสั่ง (ALL) ด้วยเงื่อนไข `false`** ครอบไว้ ทำให้นอกจากจะบล็อก INSERT/UPDATE/DELETE แล้วยังบล็อก **SELECT** ของผู้ใช้ทั่วไป (anon/authenticated) ไปด้วย — รายชื่อพนักงานเลยไม่ขึ้นเลย

ปัญหาเดียวกันยังซ่อนอยู่กับตารางอื่นที่ตั้งใจให้ client อ่านได้ (เช่น `app_settings`) ที่ใช้ลายเซ็น `FOR ALL USING(false)` แบบเดียวกัน

## แนวทางแก้

สร้าง migration เปลี่ยน policy ป้องกันการเขียนให้แยกตามคำสั่ง **INSERT / UPDATE / DELETE** เท่านั้น (ไม่ครอบ SELECT) บนตาราง `employees` เพื่อ:

- คง RESTRICTIVE block สำหรับการเขียนจาก anon/authenticated เหมือนเดิม (defense-in-depth)
- ปลดล็อก SELECT ให้ permissive policy "Anyone can read employees" ทำงานได้ตามปกติ

ขั้นตอน SQL:

1. `DROP POLICY "Block anon write employees" ON public.employees;`
2. สร้างใหม่ 3 ตัว:
   - `FOR INSERT TO anon, authenticated WITH CHECK (false)` (RESTRICTIVE)
   - `FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false)` (RESTRICTIVE)
   - `FOR DELETE TO anon, authenticated USING (false)` (RESTRICTIVE)

## ไม่แตะอะไรในโค้ดฝั่ง client

โค้ดหน้า `/scan` ใช้ pattern เดิม (`supabase.from("employees").select(...).eq("active", true)`) ได้ทันทีหลัง migration ผ่าน

## บันทึก system_logs

แนบ `INSERT INTO public.system_logs (...)` ท้าย migration ตามมาตรฐานโปรเจกต์

## หมายเหตุ

- ไม่แก้ตารางอื่นในรอบนี้ (เช่น `production_logs`, `expenses`, ฯลฯ) เพราะตั้งใจให้บล็อก SELECT จาก client จริงๆ และอ่านผ่าน server functions/service_role อยู่แล้ว
- ถ้าหลัง migration ยังพบปัญหาเดียวกันกับตารางอื่นที่ client ต้องอ่าน (เช่น `app_settings`) จะแก้แยกอีก migration ต่อไป