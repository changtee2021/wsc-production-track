
-- QC employees table
CREATE TABLE public.qc_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emp_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qc_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read qc_employees" ON public.qc_employees FOR SELECT USING (true);

-- QC reports
CREATE TABLE public.qc_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  qc_employee_id uuid NOT NULL,
  production_log_id uuid,
  step_id uuid,
  category_id uuid,
  employee_id uuid,
  note text,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qc_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert qc_reports" ON public.qc_reports FOR INSERT WITH CHECK (true);

CREATE INDEX idx_qc_reports_created ON public.qc_reports (created_at DESC);
CREATE INDEX idx_qc_reports_job ON public.qc_reports (job_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('qc-media', 'qc-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read qc-media" ON storage.objects FOR SELECT USING (bucket_id = 'qc-media');
CREATE POLICY "Public upload qc-media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'qc-media');
