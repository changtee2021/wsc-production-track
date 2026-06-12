import { createHmac } from "crypto";
import { loadSettingSection } from "@/lib/features/warehouse-settings.functions";

function integrationsEnabled(): boolean {
  const v = process.env.INTEGRATIONS_ENABLED;
  if (v === undefined || v === "") return true;
  return v !== "false" && v !== "0";
}

export type ReceiptConfirmedPayload = {
  event: "receipt_confirmed";
  receipt_no: string;
  backoffice_po_id: string | null;
  backoffice_item_id: string | null;
  item_code: string;
  lot_no: string;
  mfg_date: string | null;
  exp_date: string | null;
  box_count: number;
  qty_per_box: number;
  company_id: string;
};

export type ForwardResult = { ok: boolean; error: string | null };

export async function forwardReceiptConfirmed(
  payload: ReceiptConfirmedPayload,
): Promise<ForwardResult> {
  const integration = await loadSettingSection("integration");
  if (!integration.backoffice_sync_enabled) {
    return { ok: false, error: "backoffice sync disabled in settings" };
  }
  if (!integrationsEnabled()) {
    return { ok: false, error: "integrations disabled (INTEGRATIONS_ENABLED=false)" };
  }
  const secret = process.env.WAREHOUSE_INTAKE_SECRET;
  if (!secret) {
    return { ok: false, error: "WAREHOUSE_INTAKE_SECRET not configured" };
  }
  const url =
    process.env.WAREHOUSE_INTAKE_URL ||
    (process.env.BACKOFFICE_PUBLIC_URL
      ? `${process.env.BACKOFFICE_PUBLIC_URL}/api/public/warehouse-intake`
      : "");
  if (!url) {
    return { ok: false, error: "WAREHOUSE_INTAKE_URL not configured" };
  }

  try {
    const raw = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-intake-signature": signature,
      },
      body: raw,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `backoffice ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 300) };
  }
}
