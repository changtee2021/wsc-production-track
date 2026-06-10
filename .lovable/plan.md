## เป้าหมาย

เพิ่มปุ่ม Feedback ลอยมุมขวาล่างทุกหน้า เมื่อกดเปิด dialog ให้แนบรูป/แคปหน้าจอ + เลือก priority/category ได้ และยกระดับหน้า `/feedback-admin` เดิมให้เป็นระบบ Ticket เต็มรูปแบบ (5 สถานะ + เลขตั๋วอัตโนมัติ + เธรดคอมเมนต์ของแอดมิน) — อิงต้นแบบจากโปรเจกต์ Curtain Flow แต่ปรับให้เข้ากับระบบ token ปัจจุบัน (ผู้แจ้งไม่ต้อง login, ส่งทางเดียว)

## ขั้นที่ 1 — Database

ขยายตาราง `feedbacks` เดิม + เพิ่ม `ticket_comments` + bucket `feedback-media` (private)

```sql
-- feedbacks: เพิ่มคอลัมน์ใหม่ (เก็บข้อมูลเดิมไว้)
ALTER TABLE public.feedbacks
  ADD COLUMN ticket_no    bigserial,
  ADD COLUMN priority     text NOT NULL DEFAULT 'normal'
             CHECK (priority IN ('low','normal','high','critical')),
  ADD COLUMN page_path    text DEFAULT '',
  ADD COLUMN image_paths  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN assignee_name text DEFAULT '',
  ADD COLUMN closed_at    timestamptz;

-- ขยาย enum สถานะเป็น 5 ขั้น (open/in_progress/qa/resolved/closed)
ALTER TABLE public.feedbacks DROP CONSTRAINT feedbacks_status_check;
UPDATE public.feedbacks SET status='open' WHERE status='new';
UPDATE public.feedbacks SET status='in_progress' WHERE status='read';
UPDATE public.feedbacks SET status='closed' WHERE status='done';
ALTER TABLE public.feedbacks
  ALTER COLUMN status SET DEFAULT 'open',
  ADD CONSTRAINT feedbacks_status_check
    CHECK (status IN ('open','in_progress','qa','resolved','closed'));

-- ticket_comments
CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'แอดมิน',
  author_role text NOT NULL DEFAULT 'admin', -- admin | system
  body text NOT NULL DEFAULT '',
  image_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages comments" ON public.ticket_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX ticket_comments_ticket_idx ON public.ticket_comments (ticket_id, created_at);
```

- Storage bucket `feedback-media` (private) — ผ่าน `supabase--storage_create_bucket`
- โครงไฟล์ใน bucket: `anon/<timestamp>-<uuid>.png` (ฝั่งคอมเมนต์แอดมินใช้ `admin/...`)

## ขั้นที่ 2 — Server Functions

ปรับ `src/lib/features/feedback.functions.ts`:

- `submitFeedback` (เดิม) — เพิ่มฟิลด์ `priority`, `page_path`, `image_paths` (ผู้แจ้งอัปโหลดผ่าน service role server fn `uploadFeedback