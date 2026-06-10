
-- Lock down inventory_items: only service_role (server functions) may access
DROP POLICY IF EXISTS "inventory_items read all" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items write authenticated" ON public.inventory_items;

CREATE POLICY "inventory_items block anon"
  ON public.inventory_items AS RESTRICTIVE FOR ALL
  TO anon USING (false) WITH CHECK (false);

CREATE POLICY "inventory_items block authenticated"
  ON public.inventory_items AS RESTRICTIVE FOR ALL
  TO authenticated USING (false) WITH CHECK (false);

-- Lock down stock_count_batches
DROP POLICY IF EXISTS "stock_count_batches read all auth" ON public.stock_count_batches;
DROP POLICY IF EXISTS "stock_count_batches write all auth" ON public.stock_count_batches;

CREATE POLICY "stock_count_batches block anon"
  ON public.stock_count_batches AS RESTRICTIVE FOR ALL
  TO anon USING (false) WITH CHECK (false);

CREATE POLICY "stock_count_batches block authenticated"
  ON public.stock_count_batches AS RESTRICTIVE FOR ALL
  TO authenticated USING (false) WITH CHECK (false);

-- Lock down stock_counts
DROP POLICY IF EXISTS "stock_counts read all auth" ON public.stock_counts;
DROP POLICY IF EXISTS "stock_counts write all auth" ON public.stock_counts;

CREATE POLICY "stock_counts block anon"
  ON public.stock_counts AS RESTRICTIVE FOR ALL
  TO anon USING (false) WITH CHECK (false);

CREATE POLICY "stock_counts block authenticated"
  ON public.stock_counts AS RESTRICTIVE FOR ALL
  TO authenticated USING (false) WITH CHECK (false);

-- Record change to system_logs
INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'ปิดสิทธิ์ authenticated บน inventory & stock count',
  'ลบ policy แบบ permissive ของ role authenticated/anon บน inventory_items, stock_count_batches, stock_counts และเพิ่ม RESTRICTIVE block — เข้าถึงผ่าน service_role (server functions) เท่านั้น เพื่อปิดช่องโหว่ที่สแกนเจอ',
  'security',
  ARRAY['supabase/migrations']
);
