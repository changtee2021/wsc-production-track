CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL CHECK (category IN ('feature','bugfix','security','ui','refactor')),
  version text,
  paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX system_logs_created_at_idx ON public.system_logs (created_at DESC);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon SELECT system_logs"
  ON public.system_logs FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "Block anon write system_logs"
  ON public.system_logs FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

INSERT INTO public.system_logs (title, summary, category, paths) VALUES
  ('เพิ่มหน้า LogUpdate', 'สร้างตาราง system_logs, server functions, หน้า admin /logs-update สำหรับดูประวัติการอัปเดตแอป พร้อม badge NEW ที่ sidebar และ dialog แจ้งเตือนอัตโนมัติเมื่อมี log ใหม่', 'feature', ARRAY['supabase/migrations','src/lib/system-logs.functions.ts','src/routes/_protected.logs-update.tsx','src/components/AdminSidebar.tsx']);