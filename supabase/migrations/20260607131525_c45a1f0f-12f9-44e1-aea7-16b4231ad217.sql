
CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.policies TO anon, authenticated;
GRANT ALL ON public.policies TO service_role;

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies_public_read"
  ON public.policies
  AS PERMISSIVE
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "policies_block_client_write"
  ON public.policies
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER trg_policies_touch
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

INSERT INTO public.policies (key, title, content) VALUES
('terms',
 'ข้อกำหนดการใช้งานสำหรับพนักงาน',
$md$# ข้อกำหนดการใช้งานสำหรับพนักงาน

โปรดอ่านและปฏิบัติตามก่อนใช้งานระบบ WSC ProductionTrack

## 1. ขอบเขตการใช้งาน
ระบบนี้ใช้สำหรับบันทึกการทำงานในสายการผลิต, QC, แพ็คของ, แจ้งซ่อม และเบิกอุปกรณ์ของบริษัทเท่านั้น

## 2. ความถูกต้องของข้อมูล
- สแกนงานตามจริง ตามขั้นตอนการทำงาน
- **ห้ามสแกนแทนผู้อื่น** หรือให้ผู้อื่นสแกนแทนตัวเอง
- **ห้ามสแกนงานที่ยังไม่ได้ทำ** หรือทำไม่เสร็จจริง

## 3. รูปถ่ายและหลักฐาน
- รูปต้องชัดเจน ตรงกับงานจริง
- ห้ามใช้รูปเก่า รูปงานอื่น หรือรูปที่ดัดแปลง

## 4. ความรับผิดชอบ
การบันทึกข้อมูลเท็จถือเป็นความผิดทางวินัย อาจถูกพิจารณาโทษตามระเบียบบริษัท

## 5. ความเป็นส่วนตัว (PDPA)
ระบบเก็บเฉพาะข้อมูลที่จำเป็น เช่น รหัสพนักงาน, เวลา, รูปงาน เพื่อใช้ในการบริหารจัดการการผลิตเท่านั้น

## 6. การติดต่อ
หากพบปัญหาการใช้งาน ให้แจ้งหัวหน้างานหรือฝ่ายไอทีทันที$md$),
('admin_policy',
 'ข้อกำหนดสำหรับผู้ดูแลระบบ',
$md$# ข้อกำหนดสำหรับผู้ดูแลระบบ (แอดมิน / หัวหน้า)

## 1. สิทธิ์การเข้าถึง
- รหัสผ่านแอดมิน/หัวหน้าแผนกเป็นความลับ **ห้ามแชร์** หรือให้พนักงานทั่วไปใช้
- ออกจากระบบทุกครั้งหลังเลิกใช้งาน โดยเฉพาะเมื่อใช้บนเครื่องร่วม

## 2. การแก้ไขข้อมูล
การลบหรือแก้ไขรายงาน, มาตรฐานเวลา, สต็อก, ค่าใช้จ่าย ต้องมีเหตุผลและถูกบันทึกไว้ใน system_logs โดยอัตโนมัติ

## 3. การจัดการพนักงาน
- เพิ่ม/ปิดสิทธิ์พนักงานให้ตรงกับสถานะจริง
- อัปเดตทันทีเมื่อมีการลาออก โอนย้าย หรือเปลี่ยนแผนก

## 4. ข้อมูลส่วนบุคคล (PDPA)
ข้อมูลพนักงานและลูกค้าใช้เพื่อการทำงานเท่านั้น **ห้ามนำออกนอกบริษัท** หรือเปิดเผยให้บุคคลภายนอก

## 5. การส่งออกข้อมูล
ไฟล์ export (CSV/PDF/Excel) ต้องเก็บในที่ปลอดภัย และลบเมื่อหมดความจำเป็น

## 6. การบำรุงรักษาระบบ
- ตรวจสอบ system_logs อย่างน้อยเดือนละครั้ง
- รายงานปัญหาความปลอดภัยให้ผู้ดูแลระบบทันทีเมื่อพบ

## 7. ความรับผิดชอบ
แอดมินรับผิดชอบต่อการกระทำทุกอย่างที่เกิดขึ้นผ่านบัญชีของตน$md$);

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'R.08 — เพิ่มหน้านโยบาย/ข้อกำหนด',
  'สร้างตาราง public.policies + RLS (public read, write-blocked) พร้อม seed 2 รายการ (terms, admin_policy) สำหรับหน้าฝั่งสแกน (/terms) และฝั่งแอดมิน (/admin-policy) พร้อม editor ที่ /manage-policies',
  'feature',
  ARRAY['supabase/migrations/policies', 'src/routes/terms.tsx', 'src/routes/_protected.admin-policy.tsx', 'src/routes/_protected.manage-policies.tsx', 'src/lib/features/policies.functions.ts']
);
