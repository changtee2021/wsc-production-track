-- 1. Explicit restrictive SELECT policies (RLS already enabled with no policy = deny,
-- but add explicit policies for clarity and to satisfy the linter)
CREATE POLICY "Block anon SELECT production_logs" ON public.production_logs
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "Block anon SELECT qc_reports" ON public.qc_reports
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "Block anon SELECT qc_report_items" ON public.qc_report_items
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);

-- 2. Block direct writes to qc_reports / qc_report_items from anon
-- (writes happen via supabaseAdmin server fns which bypass RLS)
CREATE POLICY "Block anon write qc_reports" ON public.qc_reports
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Block anon write qc_report_items" ON public.qc_report_items
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. Constrain note_image_url on production_logs to our Supabase storage origin
-- to prevent SSRF / admin-IP leakage via attacker-controlled URLs
ALTER TABLE public.production_logs
  ADD CONSTRAINT note_image_url_origin_check
  CHECK (
    note_image_url IS NULL
    OR note_image_url LIKE 'https://ylipwbnoyipzqfivmpjk.supabase.co/storage/v1/object/public/log-notes/%'
  );

-- 4. Explicit deny INSERT/UPDATE/DELETE on qc-media + log-notes buckets for anon
-- (no policy already means deny, but make it explicit so it can't be loosened by accident)
CREATE POLICY "Block anon write qc-media" ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'qc-media') WITH CHECK (bucket_id <> 'qc-media');

CREATE POLICY "Block anon write log-notes" ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'log-notes') WITH CHECK (bucket_id <> 'log-notes');