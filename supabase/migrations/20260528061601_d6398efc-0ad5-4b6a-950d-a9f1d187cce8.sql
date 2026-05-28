CREATE TABLE public.office_asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_useful_life_months integer NOT NULL DEFAULT 36 CHECK (default_useful_life_months > 0 AND default_useful_life_months <= 600),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.office_asset_categories TO anon, authenticated;
GRANT ALL ON public.office_asset_categories TO service_role;

ALTER TABLE public.office_asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read office asset categories"
  ON public.office_asset_categories FOR SELECT USING (true);

CREATE POLICY "Block anon write office_asset_categories"
  ON public.office_asset_categories AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE SEQUENCE IF NOT EXISTS public.office_asset_seq START 1;

CREATE TABLE public.office_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('OFF-' || lpad(nextval('public.office_asset_seq')::text, 4, '0')),
  name text NOT NULL,
  category_id uuid REFERENCES public.office_asset_categories(id) ON DELETE SET NULL,
  brand text,
  model text,
  serial_no text,
  vendor text,
  purchase_date date,
  purchase_price numeric(14,2),
  salvage_value numeric(14,2) NOT NULL DEFAULT 0,
  useful_life_months integer CHECK (useful_life_months IS NULL OR (useful_life_months > 0 AND useful_life_months <= 600)),
  warranty_until date,
  location text,
  assignee text,
  image_url text,
  note text,
  status text NOT NULL DEFAULT 'in_use' CHECK (status IN ('in_use','repair','retired','lost')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_office_assets_category ON public.office_assets(category_id);
CREATE INDEX idx_office_assets_status ON public.office_assets(status);
CREATE INDEX idx_office_assets_active ON public.office_assets(active);

GRANT ALL ON public.office_assets TO service_role;
GRANT USAGE ON SEQUENCE public.office_asset_seq TO service_role;

ALTER TABLE public.office_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon office_assets"
  ON public.office_assets AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_office_assets_updated_at
  BEFORE UPDATE ON public.office_assets
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

CREATE TRIGGER trg_office_asset_categories_updated_at
  BEFORE UPDATE ON public.office_asset_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('office-assets', 'office-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Office assets images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'office-assets');

INSERT INTO public.office_asset_categories (name, default_useful_life_months, sort_order) VALUES
  ('เครื่องเขียน', 36, 10),
  ('กระดาษ/วัสดุสิ้นเปลือง', 12, 20),
  ('อุปกรณ์ไฟฟ้า', 60, 30),
  ('เฟอร์นิเจอร์', 60, 40),
  ('คอมพิวเตอร์/IT', 36, 50),
  ('เครื่องใช้สำนักงาน', 60, 60),
  ('อื่นๆ', 36, 99)
ON CONFLICT (name) DO NOTHING;