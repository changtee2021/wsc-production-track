
-- ====== ASSETS ======
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'machine', -- machine | equipment | tool
  location text,
  brand text,
  model text,
  serial_no text,
  purchase_date date,
  purchase_price numeric,
  vendor text,
  warranty_until date,
  note text,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon assets" ON public.assets AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ====== SPARE PARTS ======
CREATE TABLE public.spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'ชิ้น',
  stock_qty integer NOT NULL DEFAULT 0,
  min_qty integer NOT NULL DEFAULT 0,
  location_bin text,
  unit_cost numeric,
  image_url text,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon spare_parts" ON public.spare_parts AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ====== TICKETS ======
CREATE SEQUENCE IF NOT EXISTS public.maintenance_ticket_seq;

CREATE TABLE public.maintenance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text UNIQUE NOT NULL DEFAULT ('MT-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.maintenance_ticket_seq')::text, 4, '0')),
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  reporter_name text NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  problem_text text NOT NULL,
  problem_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority text NOT NULL DEFAULT 'normal', -- low | normal | high
  status text NOT NULL DEFAULT 'open', -- open | in_progress | done | cancelled
  assignee_name text,
  started_at timestamptz,
  done_at timestamptz,
  fix_method text,
  fix_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon tickets" ON public.maintenance_tickets AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX idx_mt_status ON public.maintenance_tickets(status);
CREATE INDEX idx_mt_asset ON public.maintenance_tickets(asset_id);
CREATE INDEX idx_mt_reported_at ON public.maintenance_tickets(reported_at DESC);

-- ====== PARTS USED ======
CREATE TABLE public.maintenance_parts_used (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  spare_part_id uuid NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_parts_used ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon parts_used" ON public.maintenance_parts_used AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX idx_mpu_ticket ON public.maintenance_parts_used(ticket_id);

-- ====== MOVEMENTS ======
CREATE TABLE public.spare_part_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_part_id uuid NOT NULL REFERENCES public.spare_parts(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL, -- issue | restock | adjust
  ticket_id uuid REFERENCES public.maintenance_tickets(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spare_part_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon movements" ON public.spare_part_movements AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX idx_spm_part ON public.spare_part_movements(spare_part_id);

-- ====== TRIGGER: parts_used auto-deduct stock + log movement ======
CREATE OR REPLACE FUNCTION public.fn_parts_used_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.spare_parts SET stock_qty = stock_qty - NEW.qty, updated_at = now() WHERE id = NEW.spare_part_id;
  INSERT INTO public.spare_part_movements (spare_part_id, delta, reason, ticket_id, note)
  VALUES (NEW.spare_part_id, -NEW.qty, 'issue', NEW.ticket_id, NEW.note);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_parts_used_after_insert
AFTER INSERT ON public.maintenance_parts_used
FOR EACH ROW EXECUTE FUNCTION public.fn_parts_used_after_insert();

CREATE OR REPLACE FUNCTION public.fn_parts_used_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.spare_parts SET stock_qty = stock_qty + OLD.qty, updated_at = now() WHERE id = OLD.spare_part_id;
  INSERT INTO public.spare_part_movements (spare_part_id, delta, reason, ticket_id, note)
  VALUES (OLD.spare_part_id, OLD.qty, 'return', OLD.ticket_id, 'ยกเลิกการเบิก');
  RETURN OLD;
END $$;

CREATE TRIGGER trg_parts_used_after_delete
AFTER DELETE ON public.maintenance_parts_used
FOR EACH ROW EXECUTE FUNCTION public.fn_parts_used_after_delete();

-- ====== updated_at triggers ======
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_assets_touch BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
CREATE TRIGGER trg_spare_parts_touch BEFORE UPDATE ON public.spare_parts FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
CREATE TRIGGER trg_tickets_touch BEFORE UPDATE ON public.maintenance_tickets FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- ====== STORAGE BUCKET ======
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-media', 'maintenance-media', false)
ON CONFLICT (id) DO NOTHING;

-- ====== SYSTEM LOG ======
INSERT INTO public.system_logs (title, summary, category, paths) VALUES (
  'เพิ่มโมดูล "เจ้าหนูแจ้งซ่อม"',
  'สร้างตาราง assets, spare_parts, maintenance_tickets, maintenance_parts_used, spare_part_movements พร้อม trigger ตัดสต๊อกอัตโนมัติเมื่อเบิกอะไหล่ และสร้าง storage bucket maintenance-media (private)',
  'feature',
  ARRAY[
    'supabase/migrations',
    'public.assets',
    'public.spare_parts',
    'public.maintenance_tickets',
    'public.maintenance_parts_used',
    'public.spare_part_movements',
    'storage.maintenance-media'
  ]
);
