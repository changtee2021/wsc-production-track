-- Reset warehouse floor passcode (WSC): wscadmin123
UPDATE wsc_production.wh_settings
SET
  value = jsonb_set(COALESCE(value, '{}'::jsonb), '{passcode}', '"wscadmin123"'::jsonb),
  updated_at = now()
WHERE key = 'general';
