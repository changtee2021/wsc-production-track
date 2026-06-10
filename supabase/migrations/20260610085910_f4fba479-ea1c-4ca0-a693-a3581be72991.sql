
-- feedbacks: block direct SELECT for anon/authenticated
CREATE POLICY "Block anon/auth direct read of feedbacks"
  ON public.feedbacks AS RESTRICTIVE FOR SELECT
  TO anon, authenticated
  USING (false);

-- production_jobs
CREATE POLICY "Block anon/auth direct read of production_jobs"
  ON public.production_jobs AS RESTRICTIVE FOR SELECT
  TO anon, authenticated
  USING (false);

-- ticket_comments
CREATE POLICY "Block anon/auth direct read of ticket_comments"
  ON public.ticket_comments AS RESTRICTIVE FOR SELECT
  TO anon, authenticated
  USING (false);

-- feedback-media bucket: block direct object read
CREATE POLICY "Block anon/auth read of feedback-media objects"
  ON storage.objects AS RESTRICTIVE FOR SELECT
  TO anon, authenticated
  USING (bucket_id <> 'feedback-media');
