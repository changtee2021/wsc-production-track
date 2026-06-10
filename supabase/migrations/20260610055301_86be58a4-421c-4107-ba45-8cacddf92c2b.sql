
-- 1) feedbacks: add columns
ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS ticket_no bigserial,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS page_path text DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignee_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.feedbacks
  DROP CONSTRAINT IF EXISTS feedbacks_priority_check;
ALTER TABLE public.feedbacks
  ADD CONSTRAINT feedbacks_priority_check
    CHECK (priority IN ('low','normal','high','critical'));

-- 2) status workflow 5 ขั้น (migrate ข้อมูลเดิมก่อน)
ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_status_check;
UPDATE public.feedbacks SET status='open' WHERE status='new';
UPDATE public.feedbacks SET status='in_progress' WHERE status='read';
UPDATE public.feedbacks SET status='closed' WHERE status='done';
ALTER TABLE public.feedbacks ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE public.feedbacks
  ADD CONSTRAINT feedbacks_status_check
    CHECK (status IN ('open','in_progress','qa','resolved','closed'));

-- 3) ticket_comments
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'แอดมิน',
  author_role text NOT NULL DEFAULT 'admin',
  body text NOT NULL DEFAULT '',
  image_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages ticket comments" ON public.ticket_comments;
CREATE POLICY "service role manages ticket comments" ON public.ticket_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx
  ON public.ticket_comments (ticket_id, created_at);

-- 4) system log
INSERT INTO public.system_logs (title, summary, category, paths) VALUES
('Ticket System: ขยาย feedbacks + เพิ่ม ticket_comments',
 'เพิ่มเลขตั๋ว/ความสำคัญ/แนบรูป/สถานะ 5 ขั้น (open→in_progress→qa→resolved→closed) พร้อมเธรดคอมเมนต์แอดมินในแต่ละตั๋ว',
 'feature',
 ARRAY['supabase/migrations','src/lib/features/feedback.functions.ts']);
