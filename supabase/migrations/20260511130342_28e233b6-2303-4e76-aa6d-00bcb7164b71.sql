-- Lock down production_logs SELECT: remove public read.
-- Reads will go through admin server functions using the service role.
DROP POLICY IF EXISTS "Anyone can read production logs" ON public.production_logs;
-- Public INSERT remains (scan page submits logs without auth).