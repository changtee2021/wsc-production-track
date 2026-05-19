CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon SELECT app_settings" ON public.app_settings
  AS PERMISSIVE FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Block anon write app_settings" ON public.app_settings
  AS PERMISSIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO public.app_settings (key, value) VALUES
  ('line_daily_send_time', '{"time":"08:30","enabled":true}'::jsonb),
  ('line_daily_last_sent_date', '{"date":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_logs (title, summary, category, paths) VALUES (
  'เพิ่มตั้งเวลา daily auto-send LINE',
  'เพิ่มตาราง app_settings เก็บเวลาส่งสรุปประจำวัน + endpoint สำหรับ pg_cron + UI ตั้งเวลาในหน้า LogUpdate',
  'feature',
  ARRAY['src/lib/line.functions.ts','src/lib/line.server.ts','src/lib/line-schedule.functions.ts','src/routes/api/public/hooks/line-daily-send.ts','src/routes/_protected.logs-update.tsx']
);