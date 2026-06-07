
-- Add explicit RESTRICTIVE SELECT-blocking policies on tables whose ALL RESTRICTIVE policy
-- doesn't actually cover SELECT in Supabase RLS. service_role bypasses RLS so admin code keeps working.
CREATE POLICY "Block anon select assets" ON public.assets AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select maintenance_tickets" ON public.maintenance_tickets AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select maintenance_parts_used" ON public.maintenance_parts_used AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select office_requests" ON public.office_requests AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select office_request_items" ON public.office_request_items AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select office_assets" ON public.office_assets AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select office_stock_movements" ON public.office_stock_movements AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select spare_parts" ON public.spare_parts AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon select spare_part_movements" ON public.spare_part_movements AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

INSERT INTO public.system_logs (title, summary, category, paths) VALUES (
  'เพิ่ม RLS ปิดสิทธิ์อ่านบน 9 ตารางสำคัญ',
  'เพิ่ม RESTRICTIVE SELECT policy USING(false) สำหรับ anon/authenticated บน assets, maintenance_tickets, maintenance_parts_used, office_requests/items/assets/stock_movements, spare_parts, spare_part_movements ปิดช่องที่ ALL policy ไม่ครอบคลุม SELECT',
  'security',
  ARRAY['supabase/migrations']
);
