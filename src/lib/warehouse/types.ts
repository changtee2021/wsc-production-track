export type WhSettingsKey =
  | "general"
  | "receiving"
  | "pallet"
  | "scan"
  | "export"
  | "integration"
  | "labels"
  | "audit"
  | "vision";

export type BarcodeMode = "system" | "supplier" | "ask_each_receipt";
export type ReceiptStatus = "draft" | "confirmed" | "cancelled";
export type BoxStatus = "received" | "on_pallet" | "exported" | "scrapped";
export type PalletStatus = "open" | "counting" | "complete" | "incomplete" | "loaded";
export type ScanResult =
  | "ok"
  | "duplicate"
  | "wrong_lot"
  | "wrong_product"
  | "over_capacity"
  | "not_found";
export type ShipmentStatus = "draft" | "sealed" | "shipped";

export type WhReceipt = {
  id: string;
  receipt_no: string;
  backoffice_po_id: string | null;
  po_number: string;
  backoffice_item_id: string | null;
  item_code: string;
  item_name: string;
  lot_no: string;
  mfg_date: string | null;
  exp_date: string | null;
  barcode_mode: BarcodeMode;
  expected_boxes: number;
  received_boxes: number;
  qty_per_box: number;
  status: ReceiptStatus;
  zone_id: string | null;
  received_by_emp_code: string;
  received_by_name: string;
  confirmed_at: string | null;
  backoffice_synced_at: string | null;
  backoffice_sync_error: string;
  note: string;
  created_at: string;
  updated_at: string;
};

export type WhBox = {
  id: string;
  box_code: string;
  receipt_id: string;
  lot_no: string;
  seq_no: number;
  status: BoxStatus;
  pallet_id: string | null;
  scanned_at: string | null;
  scanned_by_emp_code: string;
  created_at: string;
};

export type WhPallet = {
  id: string;
  pallet_no: string;
  receipt_id: string;
  boxes_per_layer: number;
  layers: number;
  target_boxes: number;
  counted_boxes: number;
  status: PalletStatus;
  opened_by_emp_code: string;
  opened_by_name: string;
  closed_reason_code: string;
  closed_note: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhShipment = {
  id: string;
  shipment_no: string;
  container_no: string;
  seal_no: string;
  destination_id: string | null;
  destination_text: string;
  status: ShipmentStatus;
  total_pallets: number;
  total_boxes: number;
  sealed_by: string;
  sealed_at: string | null;
  note: string;
  created_at: string;
  updated_at: string;
};

export const WH_SETTINGS_DEFAULTS: Record<WhSettingsKey, Record<string, unknown>> = {
  general: {
    passcode_enabled: true,
    passcode: "wscwarehouse123",
    session_ttl_hours: 12,
    company_code: "WSC",
  },
  receiving: {
    po_required: true,
    adhoc_receipt_allowed: false,
    lot_no_required: true,
    mfg_date_required: false,
    exp_date_required: false,
    default_barcode_mode: "ask_each_receipt",
    box_code_format: "BOX-{receipt_no}-{seq:04d}",
    qty_unit: "per_box_scan",
    auto_confirm_on_full_scan: false,
  },
  pallet: {
    mixed_lot_allowed: false,
    mixed_product_allowed: false,
    pallet_no_format: "PLT-{date:YYYYMMDD}-{seq:03d}",
    default_boxes_per_layer: 12,
    default_layers: 8,
    allow_manual_close_incomplete: true,
    require_supervisor_pin: false,
  },
  scan: {
    duplicate_scan_action: "reject",
    over_capacity_action: "block",
    wrong_lot_action: "block",
    sound_enabled: true,
    vibration_enabled: true,
    almost_full_threshold_pct: 80,
  },
  export: {
    container_no_required: true,
    seal_no_required: true,
    destination_required: true,
    seal_no_regex: "",
    container_no_regex: "",
    only_complete_pallets: true,
    allow_incomplete_with_approval: true,
  },
  integration: {
    stock_sync_trigger: "on_receipt",
    backoffice_sync_enabled: true,
    webhook_retry_count: 3,
  },
  labels: {
    pdf_footer_text: "",
    show_lot_on_label: true,
    show_exp_on_label: true,
  },
  audit: {
    scan_log_retention_days: 365,
  },
  vision: {
    enabled: true,
    require_all_before_confirm: true,
  },
};
