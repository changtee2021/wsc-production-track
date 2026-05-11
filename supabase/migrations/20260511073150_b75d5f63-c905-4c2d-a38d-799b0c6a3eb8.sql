
-- Drop permissive write policies on admin tables
DROP POLICY IF EXISTS "Anyone can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can update employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can delete employees" ON public.employees;

DROP POLICY IF EXISTS "Anyone can insert steps" ON public.steps;
DROP POLICY IF EXISTS "Anyone can update steps" ON public.steps;
DROP POLICY IF EXISTS "Anyone can delete steps" ON public.steps;

DROP POLICY IF EXISTS "Anyone can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can update categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can delete categories" ON public.categories;

-- Lock down storage write policies for admin buckets (avatars, step-images).
-- Service-role (used by server functions) bypasses RLS so admin uploads still work.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    -- Drop any policy that targets avatars or step-images write ops
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Recreate storage policies: public read on all 3 buckets, public insert only on log-notes
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Public read step-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'step-images');

CREATE POLICY "Public read log-notes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'log-notes');

CREATE POLICY "Public insert log-notes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'log-notes');
