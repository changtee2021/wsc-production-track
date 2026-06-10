
CREATE TABLE public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_name TEXT,
  from_emp_code TEXT,
  from_phone TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','done')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.feedbacks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback" ON public.feedbacks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Service role manages feedback" ON public.feedbacks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX feedbacks_status_idx ON public.feedbacks (status, created_at DESC);

CREATE TRIGGER trg_feedbacks_touch
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

INSERT INTO public.system_logs (title, summary, category, paths) VALUES
('Group C — Feedback: เพิ่มตาราง feedbacks',
 'สร้างตาราง feedbacks เก็บความคิดเห็น/ปัญหาที่พนักงานส่งเข้ามา รองรับหมวด/สถานะ/หมายเหตุแอดมิน',
 'feature',
 ARRAY['supabase/migrations']);
