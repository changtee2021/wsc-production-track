-- Add new columns
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS emp_code TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS employees_emp_code_unique
  ON public.employees (emp_code) WHERE emp_code IS NOT NULL;

ALTER TABLE public.steps
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS std_duration_minutes INTEGER;

-- Storage buckets (public read for both)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('step-images', 'step-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policies
DO $$ BEGIN
  CREATE POLICY "Public read avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read step-images" ON storage.objects
    FOR SELECT USING (bucket_id = 'step-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow public uploads (admin gate is application-level via password)
DO $$ BEGIN
  CREATE POLICY "Public upload avatars" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public upload step-images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'step-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public update avatars" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public update step-images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'step-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public delete avatars" ON storage.objects
    FOR DELETE USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public delete step-images" ON storage.objects
    FOR DELETE USING (bucket_id = 'step-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow updates on employees and steps for admin operations (admin gate at app level)
DO $$ BEGIN
  CREATE POLICY "Anyone can insert employees" ON public.employees FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anyone can update employees" ON public.employees FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anyone can delete employees" ON public.employees FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert steps" ON public.steps FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anyone can update steps" ON public.steps FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anyone can delete steps" ON public.steps FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;