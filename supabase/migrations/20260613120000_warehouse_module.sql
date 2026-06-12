-- Warehouse module: Receiving + Palletizing + Export (WSC)

CREATE SEQUENCE IF NOT EXISTS public.wh_receipt_no_seq;
CREATE SEQUENCE IF NOT EXISTS public.wh_pallet_no_seq;
CREATE SEQUENCE IF NOT EXISTS public.wh_shipment_no_seq;

CREATE TABLE IF NOT EXISTS public.wh_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wh_pallet_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text NOT NULL DEFAULT '',
  item_name text NOT NULL DEFAULT '',
  boxes_per_layer integer NOT NULL DEFAULT 12 CHECK (boxes_per_layer > 0),
  layers integer NOT NULL DEFAULT 8 CHECK (layers > 0),
  label_template_id uuid,
  active boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_pallet_templates_item_idx ON public.wh_pallet_templates (item_code) WHERE active;

CREATE TABLE IF NOT EXISTS public.wh_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  country text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wh_warehouse_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'storage' CHECK (zone_type IN ('receiving','storage','staging','dock')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wh_scan_reason_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  reason_type text NOT NULL DEFAULT 'incomplete' CHECK (reason_type IN ('incomplete','reject','override')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wh_label_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  template_type text NOT NULL DEFAULT 'box' CHECK (template_type IN ('box','pallet','packing_list')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wh_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text NOT NULL UNIQUE,
  backoffice_po_id uuid,
  po_number text NOT NULL DEFAULT '',
  backoffice_item_id uuid,
  item_code text NOT NULL DEFAULT '',
  item_name text NOT NULL DEFAULT '',
  lot_no text NOT NULL DEFAULT '',
  mfg_date date,
  exp_date date,
  barcode_mode text NOT NULL DEFAULT 'ask_each_receipt' CHECK (barcode_mode IN ('system','supplier','ask_each_receipt')),
  expected_boxes integer NOT NULL DEFAULT 0 CHECK (expected_boxes >= 0),
  received_boxes integer NOT NULL DEFAULT 0 CHECK (received_boxes >= 0),
  qty_per_box numeric(18,4) NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','cancelled')),
  zone_id uuid REFERENCES public.wh_warehouse_zones(id) ON DELETE SET NULL,
  received_by_emp_code text NOT NULL DEFAULT '',
  received_by_name text NOT NULL DEFAULT '',
  confirmed_at timestamptz,
  backoffice_synced_at timestamptz,
  backoffice_sync_error text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_receipts_status_idx ON public.wh_receipts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wh_pallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_no text NOT NULL UNIQUE,
  receipt_id uuid NOT NULL REFERENCES public.wh_receipts(id) ON DELETE RESTRICT,
  boxes_per_layer integer NOT NULL DEFAULT 12 CHECK (boxes_per_layer > 0),
  layers integer NOT NULL DEFAULT 8 CHECK (layers > 0),
  target_boxes integer NOT NULL DEFAULT 96 CHECK (target_boxes > 0),
  counted_boxes integer NOT NULL DEFAULT 0 CHECK (counted_boxes >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','counting','complete','incomplete','loaded')),
  opened_by_emp_code text NOT NULL DEFAULT '',
  opened_by_name text NOT NULL DEFAULT '',
  closed_reason_code text NOT NULL DEFAULT '',
  closed_note text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_pallets_status_idx ON public.wh_pallets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wh_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_code text NOT NULL UNIQUE,
  receipt_id uuid NOT NULL REFERENCES public.wh_receipts(id) ON DELETE CASCADE,
  lot_no text NOT NULL DEFAULT '',
  seq_no integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','on_pallet','exported','scrapped')),
  pallet_id uuid REFERENCES public.wh_pallets(id) ON DELETE SET NULL,
  scanned_at timestamptz,
  scanned_by_emp_code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_boxes_receipt_idx ON public.wh_boxes (receipt_id);
CREATE INDEX IF NOT EXISTS wh_boxes_pallet_idx ON public.wh_boxes (pallet_id) WHERE pallet_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.wh_pallet_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id uuid NOT NULL REFERENCES public.wh_pallets(id) ON DELETE CASCADE,
  box_id uuid REFERENCES public.wh_boxes(id) ON DELETE SET NULL,
  box_code text NOT NULL DEFAULT '',
  scan_result text NOT NULL CHECK (scan_result IN ('ok','duplicate','wrong_lot','wrong_product','over_capacity','not_found')),
  scanned_by_emp_code text NOT NULL DEFAULT '',
  scanned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_pallet_scans_pallet_idx ON public.wh_pallet_scans (pallet_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS public.wh_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_no text NOT NULL UNIQUE,
  container_no text NOT NULL DEFAULT '',
  seal_no text NOT NULL DEFAULT '',
  destination_id uuid REFERENCES public.wh_destinations(id) ON DELETE SET NULL,
  destination_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sealed','shipped')),
  total_pallets integer NOT NULL DEFAULT 0,
  total_boxes integer NOT NULL DEFAULT 0,
  sealed_by text NOT NULL DEFAULT '',
  sealed_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wh_shipment_pallets (
  shipment_id uuid NOT NULL REFERENCES public.wh_shipments(id) ON DELETE CASCADE,
  pallet_id uuid NOT NULL REFERENCES public.wh_pallets(id) ON DELETE RESTRICT,
  PRIMARY KEY (shipment_id, pallet_id)
);

CREATE TABLE IF NOT EXISTS public.wh_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  event_type text NOT NULL,
  ref_id uuid,
  ref_no text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','error')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

INSERT INTO public.wh_settings (key, value) VALUES
  ('general', '{"passcode_enabled":true,"passcode":"wscwarehouse123","session_ttl_hours":12,"company_code":"WSC"}'::jsonb),
  ('receiving', '{"po_required":true,"adhoc_receipt_allowed":false,"lot_no_required":true,"mfg_date_required":false,"exp_date_required":false,"default_barcode_mode":"ask_each_receipt","box_code_format":"BOX-{receipt_no}-{seq:04d}","qty_unit":"per_box_scan","auto_confirm_on_full_scan":false}'::jsonb),
  ('pallet', '{"mixed_lot_allowed":false,"mixed_product_allowed":false,"pallet_no_format":"PLT-{date:YYYYMMDD}-{seq:03d}","default_boxes_per_layer":12,"default_layers":8,"allow_manual_close_incomplete":true,"require_supervisor_pin":false}'::jsonb),
  ('scan', '{"duplicate_scan_action":"reject","over_capacity_action":"block","wrong_lot_action":"block","sound_enabled":true,"vibration_enabled":true,"almost_full_threshold_pct":80}'::jsonb),
  ('export', '{"container_no_required":true,"seal_no_required":true,"destination_required":true,"seal_no_regex":"","container_no_regex":"","only_complete_pallets":true,"allow_incomplete_with_approval":true}'::jsonb),
  ('integration', '{"stock_sync_trigger":"on_receipt","backoffice_sync_enabled":true,"webhook_retry_count":3}'::jsonb),
  ('labels', '{"pdf_footer_text":"","show_lot_on_label":true,"show_exp_on_label":true}'::jsonb),
  ('audit', '{"scan_log_retention_days":365}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.wh_scan_reason_codes (code, label, reason_type, sort_order) VALUES
  ('SHORT', 'นับไม่ครบ — ขาดกล่อง', 'incomplete', 1),
  ('DAMAGE', 'กล่องเสียหาย', 'reject', 2),
  ('MIXED', 'สลับล็อต', 'incomplete', 3)
ON CONFLICT (code) DO NOTHING;
