CREATE TABLE public.production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_no text NOT NULL UNIQUE,
  order_no text,
  customer_name text,
  due_date date,
  ship_date date,
  product_type text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  width_cm numeric,
  height_cm numeric,
  side text CHECK (side IN ('L','R') OR side IS NULL),
  fabric_code text,
  rail_code text,
  color_code text,
  motor text,
  accessories jsonb NOT NULL DEFAULT '{}'::jsonb,
  qty integer NOT NULL DEFAULT 1,
  label_rev text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  printed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  source text NOT NULL DEFAULT 'curtain_flow',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.production_jobs TO service_role;

ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages production_jobs"
  ON public.production_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX production_jobs_status_due_idx ON public.production_jobs (status, due_date);
CREATE INDEX production_jobs_order_idx ON public.production_jobs (order_no);

CREATE TRIGGER trg_production_jobs_touch
  BEFORE UPDATE ON public.production_jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'เพิ่มระบบรับงานจาก Curtain Flow + พิมพ์ Label',
  'เพิ่มตาราง production_jobs สำหรับรับใบงานที่ Curtain Flow อนุมัติเช็คสต๊อกแล้ว, รองรับเลข job_no, ออเดอร์, ลูกค้า, ขนาด, สี, ราง, ใบ, ด้าน, วันส่ง, สถานะ 4 ขั้น (pending/in_progress/done/cancelled) เพื่อนำไปขึ้นคิวผลิตและพิมพ์สติ๊กเกอร์ QR',
  'feature',
  ARRAY['supabase/migrations','production_jobs']
);