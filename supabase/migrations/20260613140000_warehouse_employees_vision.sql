-- Warehouse floor employees + vision checklist items

-- wp_production
CREATE TABLE IF NOT EXISTS wp_production.wh_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emp_code text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wh_employees_emp_code_uq
  ON wp_production.wh_employees (emp_code) WHERE emp_code <> '';

CREATE TABLE IF NOT EXISTS wp_production.wh_vision_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wp_production.wh_receipts
  ADD COLUMN IF NOT EXISTS vision_checks jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO wp_production.wh_vision_check_items (label, required, sort_order)
SELECT v.label, v.required, v.sort_order
FROM (VALUES
  ('สภาพกล่องสมบูรณ์ ไม่บุบ', true, 1),
  ('ฉลาก/บาร์โค้ดชัดเจน อ่านได้', true, 2),
  ('จำนวนกล่องตรงกับใบส่งของ', true, 3),
  ('ไม่พบความเสียหายจากน้ำ/ความชื้น', true, 4)
) AS v(label, required, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM wp_production.wh_vision_check_items LIMIT 1);

INSERT INTO wp_production.wh_settings (key, value)
VALUES ('vision', '{"enabled":true,"require_all_before_confirm":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- wsc_production
CREATE TABLE IF NOT EXISTS wsc_production.wh_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emp_code text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wh_employees_emp_code_uq
  ON wsc_production.wh_employees (emp_code) WHERE emp_code <> '';

CREATE TABLE IF NOT EXISTS wsc_production.wh_vision_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wsc_production.wh_receipts
  ADD COLUMN IF NOT EXISTS vision_checks jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO wsc_production.wh_vision_check_items (label, required, sort_order)
SELECT v.label, v.required, v.sort_order
FROM (VALUES
  ('สภาพกล่องสมบูรณ์ ไม่บุบ', true, 1),
  ('ฉลาก/บาร์โค้ดชัดเจน อ่านได้', true, 2),
  ('จำนวนกล่องตรงกับใบส่งของ', true, 3),
  ('ไม่พบความเสียหายจากน้ำ/ความชื้น', true, 4)
) AS v(label, required, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM wsc_production.wh_vision_check_items LIMIT 1);

INSERT INTO wsc_production.wh_settings (key, value)
VALUES ('vision', '{"enabled":true,"require_all_before_confirm":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
