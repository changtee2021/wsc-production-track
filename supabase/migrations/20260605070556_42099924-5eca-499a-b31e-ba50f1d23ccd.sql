
DROP POLICY IF EXISTS "Block anon write employees" ON public.employees;

CREATE POLICY "Block anon insert employees" ON public.employees
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Block anon update employees" ON public.employees
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Block anon delete employees" ON public.employees
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'แก้ RLS employees ให้ /scan โหลดพนักงานได้',
  'แทน RESTRICTIVE FOR ALL USING(false) ด้วย policy แยกตาม INSERT/UPDATE/DELETE เพื่อไม่ให้บล็อก SELECT ของ anon/authenticated หน้า /scan จะดึงรายชื่อพนักงานได้ตามปกติ',
  'security',
  ARRAY['supabase/migrations']
);
