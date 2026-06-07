ALTER TABLE public.production_standards ADD COLUMN IF NOT EXISTS red_threshold integer;
DELETE FROM public.app_settings WHERE key = 'production_red_threshold';