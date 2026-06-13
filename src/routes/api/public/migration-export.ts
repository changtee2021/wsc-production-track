// One-time cutover helper: export all legacy public tables using Lovable server service role.
// Auth: header x-wsc-secret = WSC_REPORTS_SECRET (same as stock-count reports API).
//
// Deploy/Publish on Lovable first, then:
//   node scripts/pull-wsc-from-lovable.mjs
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const WSC_PRODUCTION_TABLES = [
  "categories",
  "steps",
  "expense_categories",
  "office_asset_categories",
  "policies",
  "announcements",
  "home_banners",
  "system_logs",
  "employees",
  "qc_employees",
  "packing_employees",
  "maintenance_employees",
  "office_employees",
  "wh_employees",
  "wh_destinations",
  "wh_label_templates",
  "wh_scan_reason_codes",
  "wh_warehouse_zones",
  "wh_settings",
  "wh_vision_check_items",
  "assets",
  "spare_parts",
  "inventory_items",
  "office_assets",
  "production_jobs",
  "production_logs",
  "qc_checklists",
  "qc_reports",
  "qc_report_items",
  "packing_checklists",
  "packing_reports",
  "packing_report_items",
  "maintenance_tickets",
  "maintenance_parts_used",
  "spare_part_movements",
  "expenses",
  "expense_status_history",
  "stock_count_batches",
  "stock_counts",
  "feedbacks",
  "error_logs",
  "wh_boxes",
  "wh_pallets",
  "wh_pallet_scans",
  "wh_pallet_templates",
  "wh_receipts",
  "wh_shipments",
  "wh_shipment_pallets",
  "wh_sync_logs",
] as const;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function checkSecret(request: Request): boolean {
  const expected = process.env.WSC_REPORTS_SECRET;
  if (!expected) return false;
  const got = request.headers.get("x-wsc-secret") ?? "";
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function legacyAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  // Live Lovable legacy DB uses public schema (not wsc_production).
  const schema = url.includes("ylipwbnoyipzqfivmpjk") ? "public" : (process.env.SUPABASE_SCHEMA || "public");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });
}

export const Route = createFileRoute("/api/public/migration-export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!checkSecret(request)) return jsonRes({ error: "Unauthorized" }, 401);

        const url = new URL(request.url);
        const table = url.searchParams.get("table");
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? 500)), 2000);

        const sb = legacyAdmin();

        if (!table) {
          const summary = [];
          for (const t of WSC_PRODUCTION_TABLES) {
            const { count, error } = await sb.from(t).select("id", { count: "exact", head: true });
            summary.push({ table: t, count: error ? null : (count ?? 0), error: error?.message ?? null });
          }
          return jsonRes({ ok: true, tables: summary });
        }

        if (!WSC_PRODUCTION_TABLES.includes(table)) {
          return jsonRes({ error: "Unknown table" }, 400);
        }

        const { data, error, count } = await sb
          .from(table)
          .select("*", { count: "exact" })
          .order("id", { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) return jsonRes({ error: error.message }, 500);
        return jsonRes({ ok: true, table, offset, limit, count, rows: data ?? [] });
      },
    },
  },
});
