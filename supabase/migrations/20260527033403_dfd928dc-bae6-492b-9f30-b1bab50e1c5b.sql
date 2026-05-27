-- Block anon/authenticated SELECT on packing_employees (mirror qc_employees)
CREATE POLICY "Block anon SELECT packing_employees"
ON public.packing_employees
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "Block anon write packing_employees"
ON public.packing_employees
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Block anon/authenticated writes on packing-media bucket
CREATE POLICY "Block anon write packing-media"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (bucket_id <> 'packing-media')
WITH CHECK (bucket_id <> 'packing-media');

-- Block anon/authenticated writes on maintenance-media bucket
CREATE POLICY "Block anon write maintenance-media"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (bucket_id <> 'maintenance-media')
WITH CHECK (bucket_id <> 'maintenance-media');

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'แก้ช่องโหว่ความปลอดภัย',
  'เพิ่ม RLS บล็อก anon/authenticated อ่าน packing_employees และเพิ่ม storage policy บล็อกการเขียนลง bucket packing-media และ maintenance-media',
  'security',
  ARRAY['supabase/migrations', 'storage.objects', 'public.packing_employees']
);