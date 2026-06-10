
ALTER TABLE public.inventory_items RENAME COLUMN min_qty TO min_safety_stock;
ALTER TABLE public.inventory_items RENAME COLUMN notes TO note;
ALTER TABLE public.inventory_items ADD COLUMN max_stock_level numeric(18,4) NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN location text;
ALTER TABLE public.inventory_items ADD COLUMN image_url text;
ALTER TABLE public.inventory_items ALTER COLUMN note DROP NOT NULL;
ALTER TABLE public.inventory_items ALTER COLUMN note DROP DEFAULT;
ALTER TABLE public.inventory_items ALTER COLUMN category DROP DEFAULT;
INSERT INTO public.system_logs (title, summary, category, paths) VALUES (
  'ปรับฟิลด์ inventory_items ให้ครบ',
  'เพิ่มฟิลด์ min_safety_stock, max_stock_level, location, image_url, note สำหรับระบบนับสต๊อก',
  'feature',
  ARRAY['supabase/migrations']
);
