-- Why: the admin dashboard reads production_logs newest-first, in pages
-- (ORDER BY created_at DESC, id DESC + range). Only the primary key existed, so
-- every page re-sorted the whole table (~80k rows) and the dashboard hung on
-- "loading". This composite index serves both the ordering and the time-window
-- filters (created_at >= / <) used by the dashboard.
CREATE INDEX IF NOT EXISTS production_logs_created_at_id_idx
  ON wsc_production.production_logs (created_at DESC, id DESC);
