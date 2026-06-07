
-- Write-block RESTRICTIVE policies (INSERT/UPDATE/DELETE) for tables with public SELECT
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['announcements','categories','home_banners','packing_checklists','qc_checklists','steps','office_asset_categories']
  LOOP
    EXECUTE format('CREATE POLICY "Block anon insert %1$s" ON public.%1$I AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);', t);
    EXECUTE format('CREATE POLICY "Block anon update %1$s" ON public.%1$I AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);', t);
    EXECUTE format('CREATE POLICY "Block anon delete %1$s" ON public.%1$I AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);', t);
  END LOOP;
END $$;

-- Drop old ALL policy on office_asset_categories now that explicit per-cmd ones exist
DROP POLICY IF EXISTS "Block anon write office_asset_categories" ON public.office_asset_categories;

-- Explicit RESTRICTIVE SELECT block for expenses and expense_status_history (already have ALL)
CREATE POLICY "Block anon SELECT expenses" ON public.expenses
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "Block anon SELECT expense_status_history" ON public.expense_status_history
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

-- Log the change
INSERT INTO public.system_logs (title, summary, category, version, paths)
VALUES (
  'ปิดช่องโหว่ RLS 9 ตาราง + ปิด endpoint cron',
  'เพิ่ม RESTRICTIVE policies บล็อก INSERT/UPDATE/DELETE บน 7 ตารางที่อ่านสาธารณะ (announcements, categories, home_banners, packing_checklists, qc_checklists, steps, office_asset_categories) และเพิ่ม RESTRICTIVE SELECT block บน expenses กับ expense_status_history',
  'security',
  'R.07',
  ARRAY['supabase/migrations']
);
