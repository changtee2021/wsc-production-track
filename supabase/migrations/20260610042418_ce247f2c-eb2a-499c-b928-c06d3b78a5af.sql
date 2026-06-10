
-- ============================================
-- Stock Count feature (3 new tables)
-- ============================================

-- inventory_items: master รายการสินค้าที่ใช้นับสต๊อก
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text NOT NULL UNIQUE,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  category text DEFAULT '',
  total_qty numeric(18,4) NOT NULL DEFAULT 0,
  min_qty numeric(18,4) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_items_code_idx ON public.inventory_items (item_code);
CREATE INDEX inventory_items_active_idx ON public.inventory_items (active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT ON public.inventory_items TO anon;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_items read all" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "inventory_items write authenticated" ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER inventory_items_touch BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- stock_count_batches: ชุดการนับ (draft/submitted)
CREATE SEQUENCE public.stock_count_batches_no_seq;
CREATE TABLE public.stock_count_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no bigint NOT NULL DEFAULT nextval('public.stock_count_batches_no_seq'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  note text NOT NULL DEFAULT '',
  counted_by_emp_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  counted_by_emp_code text NOT NULL DEFAULT '',
  counted_by_name text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.stock_count_batches_no_seq OWNED BY public.stock_count_batches.batch_no;
CREATE INDEX stock_count_batches_status_idx ON public.stock_count_batches (status, created_at DESC);
CREATE INDEX stock_count_batches_emp_idx ON public.stock_count_batches (counted_by_emp_code, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_count_batches TO authenticated;
GRANT ALL ON public.stock_count_batches TO service_role;
ALTER TABLE public.stock_count_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_count_batches read all auth" ON public.stock_count_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_count_batches write all auth" ON public.stock_count_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER stock_count_batches_touch BEFORE UPDATE ON public.stock_count_batches
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- stock_counts: รายบรรทัดของการนับ
CREATE TABLE public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.stock_count_batches(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_code text NOT NULL,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  counted_qty numeric(18,4) NOT NULL DEFAULT 0,
  system_qty numeric(18,4) NOT NULL DEFAULT 0,
  variance numeric(18,4) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('match','short','over')),
  note text NOT NULL DEFAULT '',
  counted_by_emp_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  counted_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_counts_batch_idx ON public.stock_counts (batch_id, created_at);
CREATE INDEX stock_counts_item_code_idx ON public.stock_counts (item_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_counts TO authenticated;
GRANT ALL ON public.stock_counts TO service_role;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_counts read all auth" ON public.stock_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_counts write all auth" ON public.stock_counts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- บันทึก system_logs
INSERT INTO public.system_logs (title, summary, category, paths) VALUES (
  'เพิ่มระบบนับสต๊อก (Stock Count)',
  'สร้างตารางใหม่ 3 ตาราง: inventory_items (master สินค้า), stock_count_batches (ชุดการนับ), stock_counts (บรรทัดการนับ) สำหรับฟีเจอร์ตรวจนับสต๊อกของฝั่ง WSC พร้อม Public API ให้ Curtain Flow ดึงรายงาน',
  'feature',
  ARRAY['supabase/migrations']
);
