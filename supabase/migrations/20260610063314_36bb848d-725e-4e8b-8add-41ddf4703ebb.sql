
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'error',
  source text NOT NULL DEFAULT 'ssr',
  route_path text,
  message text NOT NULL,
  stack text,
  status_code integer,
  request_url text,
  user_agent text,
  notified_at timestamptz
);

CREATE INDEX idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_level_created ON public.error_logs (level, created_at DESC);

GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages error_logs"
  ON public.error_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'เพิ่มตาราง error_logs (Server Logs)',
  'สร้างตาราง error_logs สำหรับบันทึก SSR/route/health error ย้อนหลังเพื่อใช้ในหน้า Server Logs',
  'feature',
  ARRAY['supabase/migrations', 'public.error_logs']
);
