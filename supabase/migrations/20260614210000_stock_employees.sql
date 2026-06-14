-- Stock-count department employees (linked from /stock-count picker + admin staff directory)

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['wp_production', 'wsc_production'] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I.stock_employees (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        emp_code text,
        avatar_url text,
        active boolean NOT NULL DEFAULT true,
        nationality text,
        created_at timestamptz NOT NULL DEFAULT now()
      )$sql$, sch);

    EXECUTE format('GRANT ALL ON %I.stock_employees TO service_role', sch);
    EXECUTE format('ALTER TABLE %I.stock_employees ENABLE ROW LEVEL SECURITY', sch);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = sch AND tablename = 'stock_employees'
        AND policyname = 'Block anon SELECT stock_employees'
    ) THEN
      EXECUTE format($sql$
        CREATE POLICY "Block anon SELECT stock_employees"
          ON %1$I.stock_employees AS RESTRICTIVE FOR SELECT
          TO anon, authenticated USING (false)$sql$, sch);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = sch AND tablename = 'stock_employees'
        AND policyname = 'Block anon write stock_employees'
    ) THEN
      EXECUTE format($sql$
        CREATE POLICY "Block anon write stock_employees"
          ON %1$I.stock_employees AS RESTRICTIVE FOR ALL
          TO anon, authenticated USING (false) WITH CHECK (false)$sql$, sch);
    END IF;

    -- HR detail columns (match other department employee tables)
    EXECUTE format($sql$
      ALTER TABLE %1$I.stock_employees
        ADD COLUMN IF NOT EXISTS personal_email text,
        ADD COLUMN IF NOT EXISTS phone text,
        ADD COLUMN IF NOT EXISTS line_id text,
        ADD COLUMN IF NOT EXISTS current_address text,
        ADD COLUMN IF NOT EXISTS national_id text,
        ADD COLUMN IF NOT EXISTS date_of_birth date,
        ADD COLUMN IF NOT EXISTS registered_address text,
        ADD COLUMN IF NOT EXISTS country_of_origin text,
        ADD COLUMN IF NOT EXISTS social_security_number text,
        ADD COLUMN IF NOT EXISTS passport_number text,
        ADD COLUMN IF NOT EXISTS passport_expiry date,
        ADD COLUMN IF NOT EXISTS work_permit_number text,
        ADD COLUMN IF NOT EXISTS work_permit_expiry date,
        ADD COLUMN IF NOT EXISTS visa_type text,
        ADD COLUMN IF NOT EXISTS visa_expiry date,
        ADD COLUMN IF NOT EXISTS pink_card_number text,
        ADD COLUMN IF NOT EXISTS pink_card_expiry date,
        ADD COLUMN IF NOT EXISTS job_title text,
        ADD COLUMN IF NOT EXISTS department text,
        ADD COLUMN IF NOT EXISTS employment_type text,
        ADD COLUMN IF NOT EXISTS join_date date,
        ADD COLUMN IF NOT EXISTS probation_end_date date,
        ADD COLUMN IF NOT EXISTS bank_name text,
        ADD COLUMN IF NOT EXISTS bank_account_number text,
        ADD COLUMN IF NOT EXISTS bank_account_name text,
        ADD COLUMN IF NOT EXISTS payment_type text,
        ADD COLUMN IF NOT EXISTS base_salary numeric,
        ADD COLUMN IF NOT EXISTS sso_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS tax_allowances integer
    $sql$, sch);

    -- employee_documents owner_table check
    IF to_regclass(format('%I.employee_documents', sch)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.employee_documents DROP CONSTRAINT IF EXISTS employee_documents_owner_table_check',
        sch
      );
      EXECUTE format($sql$
        ALTER TABLE %1$I.employee_documents
          ADD CONSTRAINT employee_documents_owner_table_check
          CHECK (owner_table IN (
            'employees','qc_employees','packing_employees','maintenance_employees',
            'office_employees','stock_employees'
          ))$sql$, sch);
    END IF;
  END LOOP;
END $$;
