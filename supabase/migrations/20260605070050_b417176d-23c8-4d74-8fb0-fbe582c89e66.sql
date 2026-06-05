
-- Block writes on tables that already block reads
CREATE POLICY "block_all_writes_anon_auth" ON public.employee_badges
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "block_all_writes_anon_auth" ON public.employee_scores
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "block_all_writes_anon_auth" ON public.production_standards
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Block reads on expense_categories
CREATE POLICY "block_all_select_anon_auth" ON public.expense_categories
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (false);

-- Block direct storage reads on expense-receipts bucket
CREATE POLICY "block_select_expense_receipts"
  ON storage.objects AS RESTRICTIVE
  FOR SELECT TO anon, authenticated
  USING (bucket_id <> 'expense-receipts');

-- Log
INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'Security: เพิ่ม RESTRICTIVE policies',
  'เพิ่มนโยบายป้องกันการเขียน employee_badges/employee_scores/production_standards, ป้องกันการอ่าน expense_categories และบล็อกการอ่านบักเก็ต expense-receipts โดยตรงจาก anon/authenticated เพื่อ defense-in-depth',
  'security',
  ARRAY['supabase/migrations']
);
