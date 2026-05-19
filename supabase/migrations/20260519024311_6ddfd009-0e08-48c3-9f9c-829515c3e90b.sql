
-- 1) qc_checklists master
CREATE TABLE public.qc_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  item_text text NOT NULL CHECK (char_length(item_text) BETWEEN 1 AND 500),
  item_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qc_checklists_category_order ON public.qc_checklists(category_id, item_order);

ALTER TABLE public.qc_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read qc_checklists" ON public.qc_checklists FOR SELECT USING (true);

-- 2) extend qc_reports with overall result and summary
ALTER TABLE public.qc_reports
  ADD COLUMN overall_result text CHECK (overall_result IN ('pass','fail')),
  ADD COLUMN summary text;

-- 3) qc_report_items
CREATE TABLE public.qc_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_report_id uuid NOT NULL REFERENCES public.qc_reports(id) ON DELETE CASCADE,
  checklist_id uuid REFERENCES public.qc_checklists(id) ON DELETE SET NULL,
  item_text_snapshot text NOT NULL,
  item_order integer NOT NULL DEFAULT 0,
  is_passed boolean NOT NULL,
  remark text,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qc_report_items_report ON public.qc_report_items(qc_report_id, item_order);

ALTER TABLE public.qc_report_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert qc_report_items" ON public.qc_report_items FOR INSERT WITH CHECK (true);
