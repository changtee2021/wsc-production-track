
CREATE TABLE public.packing_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emp_code text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packing_employees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.packing_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  item_text text NOT NULL,
  item_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packing_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read packing_checklists" ON public.packing_checklists FOR SELECT USING (true);

CREATE TABLE public.packing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  packing_employee_id uuid,
  production_log_id uuid,
  step_id uuid,
  category_id uuid,
  employee_id uuid,
  note text,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_result text,
  summary text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon SELECT packing_reports" ON public.packing_reports AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon write packing_reports" ON public.packing_reports AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.packing_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_report_id uuid NOT NULL,
  checklist_id uuid,
  item_text_snapshot text NOT NULL,
  item_order integer NOT NULL DEFAULT 0,
  is_passed boolean NOT NULL,
  result_tag text,
  remark text,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packing_report_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon SELECT packing_report_items" ON public.packing_report_items AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon write packing_report_items" ON public.packing_report_items AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX idx_packing_reports_job_id ON public.packing_reports(job_id);
CREATE INDEX idx_packing_reports_created_at ON public.packing_reports(created_at DESC);
CREATE INDEX idx_packing_report_items_report_id ON public.packing_report_items(packing_report_id);
CREATE INDEX idx_packing_checklists_category ON public.packing_checklists(category_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('packing-media', 'packing-media', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_logs (title, summary, category, paths) VALUES (
  'เพิ่มแผนกแพ็คของ (Packing) — โครงสร้างฐานข้อมูล',
  'สร้างตาราง packing_employees, packing_checklists, packing_reports, packing_report_items และ storage bucket packing-media (private) ขนานกับ QC',
  'feature',
  ARRAY['supabase/migrations']
);
