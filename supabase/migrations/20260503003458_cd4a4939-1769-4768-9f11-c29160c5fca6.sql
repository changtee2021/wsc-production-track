
ALTER TABLE public.production_logs
  ADD COLUMN note TEXT,
  ADD COLUMN note_image_url TEXT;

INSERT INTO storage.buckets (id, name, public) VALUES ('log-notes', 'log-notes', true);

CREATE POLICY "Anyone can read log-notes" ON storage.objects FOR SELECT USING (bucket_id = 'log-notes');
CREATE POLICY "Anyone can upload log-notes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'log-notes');
