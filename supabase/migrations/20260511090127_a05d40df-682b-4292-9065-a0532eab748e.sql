-- Banner table
CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read home banners"
  ON public.home_banners FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert home banners"
  ON public.home_banners FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update home banners"
  ON public.home_banners FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete home banners"
  ON public.home_banners FOR DELETE
  TO authenticated
  USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Banner images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "Authenticated can upload banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Authenticated can update banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners');

CREATE POLICY "Authenticated can delete banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners');