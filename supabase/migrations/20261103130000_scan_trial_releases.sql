-- Trial-only map from a scanned job id to the product an office
-- worker already sent to the line. Shop-floor phones read this instead
-- of choosing a product. It is not a production log.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['wp_production', 'wsc_production'] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.scan_trial_releases (
        job_id text PRIMARY KEY CHECK (char_length(btrim(job_id)) BETWEEN 1 AND 80),
        product text NOT NULL CHECK (product IN ('roller', 'wood', 'aluminum', 'shade')),
        sent_by_name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )$sql$, sch);
    EXECUTE format('ALTER TABLE %I.scan_trial_releases ENABLE ROW LEVEL SECURITY', sch);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.scan_trial_releases TO service_role',
      sch);
  END LOOP;
END $$;
