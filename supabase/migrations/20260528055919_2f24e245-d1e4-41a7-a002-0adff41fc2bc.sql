
-- app_settings: convert permissive blocks to restrictive
DROP POLICY IF EXISTS "Block anon SELECT app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Block anon write app_settings" ON public.app_settings;

CREATE POLICY "Block anon SELECT app_settings"
ON public.app_settings AS RESTRICTIVE
FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "Block anon write app_settings"
ON public.app_settings AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

-- system_logs: convert permissive blocks to restrictive
DROP POLICY IF EXISTS "Block anon SELECT system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Block anon write system_logs" ON public.system_logs;

CREATE POLICY "Block anon SELECT system_logs"
ON public.system_logs AS RESTRICTIVE
FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "Block anon write system_logs"
ON public.system_logs AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

-- qc_employees: add restrictive block policies (mirror packing_employees / maintenance_employees)
CREATE POLICY "Block anon SELECT qc_employees"
ON public.qc_employees AS RESTRICTIVE
FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "Block anon write qc_employees"
ON public.qc_employees AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);
