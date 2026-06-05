-- Defense-in-depth restrictive write blocks
CREATE POLICY "Block anon write employees" ON public.employees
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Block anon write production_logs" ON public.production_logs
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Remove public read access on operational/perf data (server-only via supabaseAdmin)
DROP POLICY IF EXISTS "Anyone can read scores" ON public.employee_scores;
DROP POLICY IF EXISTS "Anyone can read badges" ON public.employee_badges;
DROP POLICY IF EXISTS "Anyone can read standards" ON public.production_standards;

CREATE POLICY "Block anon SELECT employee_scores" ON public.employee_scores
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon SELECT employee_badges" ON public.employee_badges
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon SELECT production_standards" ON public.production_standards
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'Security: tighten RLS on employees, production_logs, scoring tables',
  'เพิ่ม restrictive write block บน employees และ production_logs และปิดการอ่าน employee_scores/employee_badges/production_standards จาก anon — ทุกการเข้าถึงไปผ่าน server functions (supabaseAdmin) แล้ว',
  'security',
  ARRAY['supabase/migrations']
);