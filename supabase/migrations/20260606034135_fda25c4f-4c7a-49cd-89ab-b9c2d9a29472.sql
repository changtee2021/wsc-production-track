-- Remove SELECT policies entirely; public bucket CDN URLs bypass RLS so images still load.
DROP POLICY IF EXISTS "Banner images list (auth only)" ON storage.objects;
DROP POLICY IF EXISTS "Office assets list (auth only)" ON storage.objects;
DROP POLICY IF EXISTS "Avatars list (auth only)" ON storage.objects;
DROP POLICY IF EXISTS "Step images list (auth only)" ON storage.objects;

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'ปิด list ไฟล์ของ public buckets ทั้งหมด',
  'ลบ SELECT policy ของ banners/office-assets/avatars/step-images — รูปยังโชว์ผ่าน /object/public/ URL ได้ตามปกติ (bypass RLS) แต่ห้าม list ไฟล์ทั้ง bucket แล้ว',
  'security',
  ARRAY['storage.objects']
);