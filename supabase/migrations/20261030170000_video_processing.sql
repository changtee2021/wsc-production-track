-- Track server-side video repair/compression so the daily GitHub Actions job
-- never reprocesses a healthy file, and retries failed ones up to 3 times.
-- Staff upload unchanged; this table is written only by the service_role script.

DO $$
DECLARE
  sch text := 'wsc_production';
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.video_processing (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      bucket text NOT NULL CHECK (bucket IN ('qc-media', 'packing-media', 'maintenance-media')),
      path text NOT NULL,
      status text NOT NULL CHECK (status IN ('converted', 'remuxed', 'ok', 'skipped', 'failed')),
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      size_before bigint,
      size_after bigint,
      error text,
      processed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (bucket, path)
    )$sql$, sch);

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS video_processing_status_idx ON %I.video_processing (status, attempts)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS video_processing_processed_at_idx ON %I.video_processing (processed_at DESC NULLS LAST)',
    sch
  );

  EXECUTE format('GRANT ALL ON %I.video_processing TO service_role', sch);
  EXECUTE format('ALTER TABLE %I.video_processing ENABLE ROW LEVEL SECURITY', sch);

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = sch AND tablename = 'video_processing' AND policyname = 'Block client access video_processing'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON %I.video_processing AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'Block client access video_processing',
      sch
    );
  END IF;

  -- Keep updated_at fresh on every upsert from the convert script.
  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.video_processing_set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$
  $sql$, sch);

  EXECUTE format('DROP TRIGGER IF EXISTS video_processing_set_updated_at ON %I.video_processing', sch);
  EXECUTE format($sql$
    CREATE TRIGGER video_processing_set_updated_at
    BEFORE UPDATE ON %1$I.video_processing
    FOR EACH ROW
    EXECUTE FUNCTION %1$I.video_processing_set_updated_at()
  $sql$, sch);

  EXECUTE format(
    'COMMENT ON TABLE %I.video_processing IS %L',
    sch,
    'Daily GitHub Actions convert job: one row per Storage video path. Leftovers (no row / failed attempts < 3) are picked up oldest-first next run.'
  );
END $$;
