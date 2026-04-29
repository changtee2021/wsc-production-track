
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nationality TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.production_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  step_id UUID NOT NULL REFERENCES public.steps(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('start','finish')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_logs_created_at ON public.production_logs(created_at DESC);
CREATE INDEX idx_production_logs_job_id ON public.production_logs(job_id);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;

-- Public read for employees & steps (workers need to see them on scan page)
CREATE POLICY "Anyone can read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Anyone can read steps" ON public.steps FOR SELECT USING (true);

-- Public insert for production_logs (workers submit without login)
CREATE POLICY "Anyone can insert production logs" ON public.production_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read production logs" ON public.production_logs FOR SELECT USING (true);

-- Seed sample data
INSERT INTO public.employees (name, nationality) VALUES
  ('Somchai P.', 'Thai'),
  ('Aung Min', 'Burmese'),
  ('Souk K.', 'Lao'),
  ('Dara S.', 'Khmer');

INSERT INTO public.steps (step_name, description, icon) VALUES
  ('Set up', 'Initial machine setup', 'Settings'),
  ('Insert blinds', 'Insert blind components', 'Layers'),
  ('Cutting', 'Cut materials to size', 'Scissors'),
  ('Assembly', 'Assemble the unit', 'Wrench'),
  ('Quality Check', 'Final QC inspection', 'CheckCircle'),
  ('Packaging', 'Pack for shipment', 'Package');
