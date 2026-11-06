-- A floor set can be confirmed before the clock starts.
-- held = the list is locked and the next station still waits.
-- batch_id groups the jobs confirmed together so admin can withdraw the set.

DO $$
DECLARE
  sch text;
  conname text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['wp_production', 'wsc_production'] LOOP
    EXECUTE format(
      'ALTER TABLE %I.scan_trial_runs ADD COLUMN IF NOT EXISTS batch_id uuid',
      sch
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS scan_trial_runs_batch_id_idx ON %I.scan_trial_runs (batch_id)',
      sch
    );
    FOR conname IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = sch
        AND t.relname = 'scan_trial_runs'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%%status%%'
    LOOP
      EXECUTE format('ALTER TABLE %I.scan_trial_runs DROP CONSTRAINT %I', sch, conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE %I.scan_trial_runs ADD CONSTRAINT scan_trial_runs_status_check CHECK (status IN (''held'', ''running'', ''done''))',
      sch
    );
  END LOOP;
END $$;
