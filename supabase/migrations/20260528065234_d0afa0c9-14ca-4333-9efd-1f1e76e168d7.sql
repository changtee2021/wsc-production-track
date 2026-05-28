CREATE TABLE public.office_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  emp_code text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.office_employees TO service_role;

ALTER TABLE public.office_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon SELECT office_employees"
  ON public.office_employees AS RESTRICTIVE FOR SELECT
  TO anon, authenticated USING (false);

CREATE POLICY "Block anon write office_employees"
  ON public.office_employees AS RESTRICTIVE FOR ALL
  TO anon, authenticated USING (false) WITH CHECK (false);