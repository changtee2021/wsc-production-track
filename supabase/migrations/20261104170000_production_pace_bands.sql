-- fast_seconds is the normal line (green ends). target_seconds is the overtime line (red starts after it).
-- A job before fast_seconds is green, from there through target_seconds is yellow, and past target_seconds is red.
COMMENT ON COLUMN wsc_production.production_standards.fast_seconds IS
  'Normal time in seconds. A job faster than this is green.';
COMMENT ON COLUMN wsc_production.production_standards.target_seconds IS
  'Overtime line in seconds. A job slower than this is red. The span from fast_seconds through this line is yellow.';

ALTER TABLE wsc_production.production_standards
  DROP CONSTRAINT IF EXISTS production_standards_pace_order;
ALTER TABLE wsc_production.production_standards
  ADD CONSTRAINT production_standards_pace_order
  CHECK (fast_seconds IS NULL OR fast_seconds <= target_seconds);

UPDATE wsc_production.production_standards AS ps
SET
  fast_seconds = v.normal_min * 60,
  target_seconds = v.over_min * 60,
  updated_at = now()
FROM wsc_production.steps AS s,
  wsc_production.categories AS c,
  (
    VALUES
      ('1.ม่านปรับแสง', 'ตั้งงาน', 10, 20),
      ('1.ม่านปรับแสง', 'ตัดราง', 1, 2),
      ('1.ม่านปรับแสง', 'เตรียมโซ่', 2, 3),
      ('1.ม่านปรับแสง', 'ประกอบใบม่านปรับแสง', 35, 45),
      ('2.ม่านม้วน', 'ตั้งงาน', 5, 10),
      ('2.ม่านม้วน', 'ตัดผ้า', 15, 60),
      ('2.ม่านม้วน', 'ตัดราง', 1, 2),
      ('2.ม่านม้วน', 'เจาะถ่วงล่าง', 5, 10),
      ('2.ม่านม้วน', 'ประกอบราง', 5, 10),
      ('2.ม่านม้วน', 'เตรียมโซ่', 2, 5),
      ('2.ม่านม้วน', 'ประกอบม่านม้วน', 5, 10),
      ('3.มู่ลี่ไม้', 'ตั้งงาน', 10, 20),
      ('3.มู่ลี่ไม้', 'ตัดใบมู่ลี่ไม้', 4, 6),
      ('3.มู่ลี่ไม้', 'เก็บสี', 6, 10),
      ('3.มู่ลี่ไม้', 'เจาะใบ', 5, 10),
      ('3.มู่ลี่ไม้', 'เจาะถ่วงล่าง', 6, 10),
      ('3.มู่ลี่ไม้', 'ตัดเทปผ้า', 20, 45),
      ('3.มู่ลี่ไม้', 'เตรียมโซ่', 15, 30),
      ('3.มู่ลี่ไม้', 'ตัดราง', 2, 5),
      ('3.มู่ลี่ไม้', 'ประกอบราง', 3, 5),
      ('3.มู่ลี่ไม้', 'บังราง', 2, 5),
      ('3.มู่ลี่ไม้', 'ประกอบมู่ลี่ไม้', 10, 15),
      ('4.มู่ลี่อลูมิเนียม', 'ตั้งงาน', 10, 20),
      ('4.มู่ลี่อลูมิเนียม', 'ตัดราง', 20, 30),
      ('4.มู่ลี่อลูมิเนียม', 'ประกอบราง', 10, 15),
      ('4.มู่ลี่อลูมิเนียม', 'เตรียมโซ่', 12, 25),
      ('4.มู่ลี่อลูมิเนียม', 'ประกอบอลูมิเนียม', 7, 12)
  ) AS v(category_head, step_head, normal_min, over_min)
WHERE ps.step_id = s.id
  AND ps.category_id = c.id
  AND split_part(c.name, ' ', 1) = v.category_head
  AND split_part(s.step_name, ' ', 1) = v.step_head;
