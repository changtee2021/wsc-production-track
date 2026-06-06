-- A1: fn_touch_updated_at: lock search_path
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- A2: Revoke EXECUTE on SECURITY DEFINER functions from public/anon/authenticated
-- These are trigger helpers or admin-only; should not be callable via Data API
REVOKE EXECUTE ON FUNCTION public.fn_parts_used_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_parts_used_after_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_score_on_finish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_db_usage_stats() FROM PUBLIC, anon, authenticated;

-- A3: Tighten public-bucket SELECT policies — keep CDN /object/public/ access (bypasses RLS)
-- but stop anonymous LIST of all files in the bucket. Restrict to authenticated only.
DROP POLICY IF EXISTS "Banner images are publicly accessible" ON storage.objects;
CREATE POLICY "Banner images list (auth only)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Office assets images are publicly accessible" ON storage.objects;
CREATE POLICY "Office assets list (auth only)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'office-assets');

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Avatars list (auth only)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public read step-images" ON storage.objects;
CREATE POLICY "Step images list (auth only)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'step-images');

-- system_logs audit
INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'ตรวจสอบและปิดช่องโหว่ DB linter',
  'ล็อก search_path ของ fn_touch_updated_at, REVOKE EXECUTE จาก anon/authenticated สำหรับ 4 SECURITY DEFINER functions (trigger helpers + get_db_usage_stats), และปิดสิทธิ์ list ไฟล์ของ public buckets (banners/office-assets/avatars/step-images) — URL /object/public/ ยังใช้ดูรูปได้ตามปกติ',
  'security',
  ARRAY['db:public.fn_touch_updated_at','db:public.fn_parts_used_*','db:public.fn_score_on_finish','db:public.get_db_usage_stats','storage.objects:banners/avatars/step-images/office-assets']
);