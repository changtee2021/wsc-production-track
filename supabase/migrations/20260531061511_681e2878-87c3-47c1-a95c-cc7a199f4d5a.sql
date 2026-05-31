
-- Sequence for EXP-YYMM-NNNN
CREATE SEQUENCE IF NOT EXISTS public.expense_seq START 1;

-- 1) Expense categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  keywords text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.expense_categories TO anon, authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read expense categories" ON public.expense_categories FOR SELECT USING (true);
CREATE POLICY "Block anon write expense_categories" ON public.expense_categories AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 2) Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exp_no text NOT NULL DEFAULT ('EXP-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.expense_seq')::text, 4, '0')),
  requester_employee_id uuid,
  requester_name text NOT NULL,
  bill_type text NOT NULL DEFAULT 'cash', -- cash | short_tax | full_tax
  merchant_name text,
  tax_id text,
  receipt_no text,
  receipt_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  category_id uuid REFERENCES public.expense_categories(id),
  note text,
  image_paths text[] NOT NULL DEFAULT '{}',
  buyer_match_wsc boolean NOT NULL DEFAULT false,
  linked_office_request_id uuid,
  ai_extracted jsonb,
  ai_confidence numeric,
  status text NOT NULL DEFAULT 'pending', -- pending | under_review | approved | rejected | paid
  approver_employee_id uuid,
  approver_name text,
  approved_at timestamptz,
  reject_reason text,
  paid_at timestamptz,
  paid_by text,
  duplicate_of uuid REFERENCES public.expenses(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_requester ON public.expenses(requester_employee_id);
CREATE INDEX idx_expenses_created ON public.expenses(created_at DESC);
CREATE UNIQUE INDEX uniq_expenses_dedupe ON public.expenses(lower(merchant_name), receipt_no, receipt_date)
  WHERE status <> 'rejected' AND merchant_name IS NOT NULL AND receipt_no IS NOT NULL AND receipt_date IS NOT NULL;

CREATE TRIGGER trg_expenses_touch BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon expenses" ON public.expenses AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3) Status history
CREATE TABLE public.expense_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_history_expense ON public.expense_status_history(expense_id);
GRANT ALL ON public.expense_status_history TO service_role;
ALTER TABLE public.expense_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block anon expense_history" ON public.expense_status_history AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 4) Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', false)
  ON CONFLICT (id) DO NOTHING;

-- 5) Seed categories
INSERT INTO public.expense_categories (name, keywords, sort_order) VALUES
  ('อุปกรณ์ออฟฟิศ', ARRAY['ปากกา','กระดาษ','หมึก','สมุด','แฟ้ม','คลิป','เครื่องเขียน','office'], 1),
  ('ค่าน้ำมัน', ARRAY['น้ำมัน','ปตท','บางจาก','เชลล์','esso','shell','ptt','caltex','gasoline','diesel','เบนซิน','ดีเซล'], 2),
  ('ค่าซ่อม/อะไหล่', ARRAY['อะไหล่','ซ่อม','spare','repair','น็อต','สกรู'], 3),
  ('ค่าอาหาร/รับรอง', ARRAY['อาหาร','ร้านอาหาร','food','restaurant','กาแฟ','coffee','เครื่องดื่ม'], 4),
  ('ค่าขนส่ง', ARRAY['ขนส่ง','kerry','flash','j&t','ไปรษณีย์','ems','ค่าส่ง','transport','delivery'], 5),
  ('อื่นๆ', ARRAY[]::text[], 99)
ON CONFLICT (name) DO NOTHING;
