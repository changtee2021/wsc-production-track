-- Shop-floor scan progress for orders already sent to the line.
-- One row per job and step so the office list can show who finished when.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['wp_production', 'wsc_production'] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.scan_trial_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id text NOT NULL CHECK (char_length(btrim(job_id)) BETWEEN 1 AND 80),
        flow text NOT NULL CHECK (flow IN ('roller', 'wood', 'aluminum', 'shade')),
        step text NOT NULL CHECK (char_length(btrim(step)) BETWEEN 1 AND 80),
        employee_id text NOT NULL,
        employee_name text NOT NULL,
        status text NOT NULL CHECK (status IN ('running', 'done')),
        started_at timestamptz NOT NULL,
        finished_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (job_id, step)
      )$sql$, sch);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS scan_trial_runs_job_id_idx ON %I.scan_trial_runs (job_id)',
      sch
    );
    EXECUTE format('ALTER TABLE %I.scan_trial_runs ENABLE ROW LEVEL SECURITY', sch);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.scan_trial_runs TO service_role',
      sch
    );
  END LOOP;
END $$;
