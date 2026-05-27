CREATE TABLE public.maintenance_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emp_code text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.maintenance_employees TO service_role;

ALTER TABLE public.maintenance_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon SELECT maintenance_employees"
ON public.maintenance_employees
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "Block anon write maintenance_employees"
ON public.maintenance_employees
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'เพิ่มตารางช่างซ่อม',
  'สร้างตาราง maintenance_employees สำหรับเก็บรายชื่อช่างซ่อม/พนักงานแผนกซ่อม พร้อม RLS บล็อกการเข้าถึงโดยตรง (ใช้ผ่าน server function เท่านั้น)',
  'feature',
  ARRAY['public.maintenance_employees', 'supabase/migrations']
);