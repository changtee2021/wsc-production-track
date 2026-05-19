-- Lock down QC write paths: only server-side admin (service role) and
-- signed upload URLs can write. Drop the permissive public-INSERT policies.

DROP POLICY IF EXISTS "Anyone can insert qc_reports" ON public.qc_reports;
DROP POLICY IF EXISTS "Anyone can insert qc_report_items" ON public.qc_report_items;
DROP POLICY IF EXISTS "Public upload qc-media" ON storage.objects;