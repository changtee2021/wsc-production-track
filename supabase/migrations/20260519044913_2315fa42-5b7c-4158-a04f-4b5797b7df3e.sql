-- Make sensitive storage buckets private; reads now go through signed URLs
UPDATE storage.buckets SET public = false WHERE id IN ('qc-media', 'log-notes');

-- Drop public SELECT policies on those buckets
DROP POLICY IF EXISTS "Public read qc-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read log-notes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read log-notes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read qc-media" ON storage.objects;

-- Relax the URL-shape CHECK on production_logs.note_image_url so new rows
-- can store either a storage path (preferred) or an old public URL.
ALTER TABLE public.production_logs
  DROP CONSTRAINT IF EXISTS note_image_url_origin_check;
ALTER TABLE public.production_logs
  ADD CONSTRAINT note_image_url_origin_check
  CHECK (
    note_image_url IS NULL
    OR length(note_image_url) <= 2000
  );