
-- Production scoring & leaderboard module
CREATE TABLE public.production_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.steps(id) ON DELETE CASCADE,
  target_seconds integer NOT NULL CHECK (target_seconds > 0),
  fast_seconds integer CHECK (fast_seconds IS NULL OR fast_seconds > 0),
  on_time_points integer NOT NULL DEFAULT 10,
  late_points integer NOT NULL DEFAULT 2,
  bonus_points integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX production_standards_unique
  ON public.production_standards (step_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.production_standards TO anon, authenticated;
GRANT ALL ON public.production_standards TO service_role;
ALTER TABLE public.production_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read standards" ON public.production_standards FOR SELECT USING (true);
CREATE TRIGGER trg_standards_touch BEFORE UPDATE ON public.production_standards
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

CREATE TABLE public.employee_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  step_id uuid NOT NULL REFERENCES public.steps(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  start_log_id uuid REFERENCES public.production_logs(id) ON DELETE SET NULL,
  finish_log_id uuid NOT NULL REFERENCES public.production_logs(id) ON DELETE CASCADE,
  actual_seconds integer NOT NULL,
  target_seconds integer NOT NULL,
  points integer NOT NULL,
  tier text NOT NULL CHECK (tier IN ('bonus','on_time','late')),
  scored_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employee_scores_finish_unique ON public.employee_scores (finish_log_id);
CREATE INDEX employee_scores_emp_time ON public.employee_scores (employee_id, scored_at DESC);
CREATE INDEX employee_scores_step ON public.employee_scores (step_id, scored_at DESC);
GRANT SELECT ON public.employee_scores TO anon, authenticated;
GRANT ALL ON public.employee_scores TO service_role;
ALTER TABLE public.employee_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read scores" ON public.employee_scores FOR SELECT USING (true);

CREATE TABLE public.employee_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  badge_code text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX employee_badges_emp ON public.employee_badges (employee_id, awarded_at DESC);
GRANT SELECT ON public.employee_badges TO anon, authenticated;
GRANT ALL ON public.employee_badges TO service_role;
ALTER TABLE public.employee_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read badges" ON public.employee_badges FOR SELECT USING (true);

-- Auto-scoring trigger
CREATE OR REPLACE FUNCTION public.fn_score_on_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start public.production_logs%ROWTYPE;
  v_std public.production_standards%ROWTYPE;
  v_actual integer;
  v_points integer;
  v_tier text;
BEGIN
  IF NEW.action <> 'finish' OR NEW.employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_start FROM public.production_logs
   WHERE job_id = NEW.job_id AND step_id = NEW.step_id
     AND employee_id = NEW.employee_id AND action = 'start'
     AND created_at <= NEW.created_at
     AND id NOT IN (SELECT start_log_id FROM public.employee_scores WHERE start_log_id IS NOT NULL)
   ORDER BY created_at DESC LIMIT 1;

  IF v_start.id IS NULL THEN RETURN NEW; END IF;

  v_actual := GREATEST(1, EXTRACT(EPOCH FROM (NEW.created_at - v_start.created_at))::int);

  SELECT * INTO v_std FROM public.production_standards
   WHERE step_id = NEW.step_id AND active = true
     AND (category_id = NEW.category_id OR category_id IS NULL)
   ORDER BY (category_id IS NOT NULL) DESC LIMIT 1;

  IF v_std.id IS NULL THEN RETURN NEW; END IF;

  IF v_std.fast_seconds IS NOT NULL AND v_actual <= v_std.fast_seconds THEN
    v_tier := 'bonus'; v_points := v_std.on_time_points + v_std.bonus_points;
  ELSIF v_actual <= v_std.target_seconds THEN
    v_tier := 'on_time'; v_points := v_std.on_time_points;
  ELSE
    v_tier := 'late'; v_points := v_std.late_points;
  END IF;

  INSERT INTO public.employee_scores
    (employee_id, job_id, step_id, category_id, start_log_id, finish_log_id,
     actual_seconds, target_seconds, points, tier)
  VALUES (NEW.employee_id, NEW.job_id, NEW.step_id, NEW.category_id,
          v_start.id, NEW.id, v_actual, v_std.target_seconds, v_points, v_tier)
  ON CONFLICT (finish_log_id) DO NOTHING;

  -- Flash badge: 5 bonus tier in same day
  IF v_tier = 'bonus' THEN
    IF (SELECT COUNT(*) FROM public.employee_scores
         WHERE employee_id = NEW.employee_id AND tier = 'bonus'
           AND scored_at::date = now()::date) >= 5
       AND NOT EXISTS (SELECT 1 FROM public.employee_badges
                        WHERE employee_id = NEW.employee_id AND badge_code = 'flash'
                          AND awarded_at::date = now()::date) THEN
      INSERT INTO public.employee_badges (employee_id, badge_code, meta)
      VALUES (NEW.employee_id, 'flash', jsonb_build_object('date', now()::date));
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_score_on_finish AFTER INSERT ON public.production_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_score_on_finish();

-- system_logs
INSERT INTO public.system_logs (title, summary, category, paths)
VALUES (
  'เพิ่มระบบให้คะแนนพนักงาน (Gamified Scoring)',
  'สร้างตาราง production_standards, employee_scores, employee_badges + trigger คำนวณคะแนนอัตโนมัติเมื่อกด finish เทียบกับเวลามาตรฐาน พร้อมแจก badge ⚡ flash',
  'feature',
  ARRAY['supabase/migrations','public.production_standards','public.employee_scores','public.employee_badges']
);
