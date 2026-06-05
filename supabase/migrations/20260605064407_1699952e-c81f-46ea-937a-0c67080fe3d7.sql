DROP POLICY IF EXISTS "Anyone can insert production logs" ON public.production_logs;
DROP POLICY IF EXISTS "Anyone can read expense categories" ON public.expense_categories;

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'Security: tighten RLS on production_logs and expense_categories',
  'ลบ policy ที่อนุญาตให้ anon insert เข้า production_logs และอ่าน expense_categories แล้วเปลี่ยน scan page ให้ส่ง production log ผ่าน server function (supabaseAdmin) แทน',
  'security',
  ARRAY['src/lib/production-log.functions.ts','src/routes/scan.tsx']
);