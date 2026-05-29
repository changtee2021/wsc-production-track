
-- 1) Add stock columns to office_assets
ALTER TABLE public.office_assets
  ADD COLUMN IF NOT EXISTS stock_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'ชิ้น';

-- 2) Sequence for request number
CREATE SEQUENCE IF NOT EXISTS public.office_request_seq;

-- 3) office_requests
CREATE TABLE IF NOT EXISTS public.office_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  req_no text NOT NULL DEFAULT ('REQ-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.office_request_seq')::text, 4, '0')),
  requester_employee_id uuid,
  requester_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  approver_employee_id uuid,
  approver_name text,
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.office_requests TO service_role;
ALTER TABLE public.office_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon office_requests" ON public.office_requests
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 4) office_request_items
CREATE TABLE IF NOT EXISTS public.office_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.office_requests(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL,
  asset_name_snapshot text NOT NULL,
  unit_price_snapshot numeric NOT NULL DEFAULT 0,
  qty integer NOT NULL CHECK (qty >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.office_request_items TO service_role;
ALTER TABLE public.office_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon office_request_items" ON public.office_request_items
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 5) office_stock_movements
CREATE TABLE IF NOT EXISTS public.office_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  request_id uuid,
  unit_price_snapshot numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.office_stock_movements TO service_role;
ALTER TABLE public.office_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon office_stock_movements" ON public.office_stock_movements
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 6) Indexes
CREATE INDEX IF NOT EXISTS idx_office_requests_status ON public.office_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_request_items_request ON public.office_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_office_movements_asset ON public.office_stock_movements(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_movements_created ON public.office_stock_movements(created_at DESC);

-- 7) updated_at trigger
DROP TRIGGER IF EXISTS trg_office_requests_updated ON public.office_requests;
CREATE TRIGGER trg_office_requests_updated BEFORE UPDATE ON public.office_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- 8) Log
INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'ระบบเบิกอุปกรณ์ออฟฟิศ (B2)',
  'เพิ่มฟลว์เบิก-อนุมัติ-ตัดสต๊อก: เพิ่มคอลัมน์ stock_qty/min_qty/unit ใน office_assets, สร้างตาราง office_requests, office_request_items, office_stock_movements พร้อม RLS RESTRICTIVE',
  'feature',
  ARRAY['supabase/migrations','office_assets','office_requests','office_request_items','office_stock_movements']
);
