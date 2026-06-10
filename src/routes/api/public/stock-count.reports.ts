// Public API: ให้ Curtain Flow (หรือระบบภายนอก) ดึงรายงานนับสต๊อกของ WSC
// ป้องกันด้วย header `x-wsc-secret` = WSC_REPORTS_SECRET
import { createFileRoute } from "@tanstack/react-router";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-wsc-secret",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}

function checkSecret(request: Request): boolean {
  const expected = process.env.WSC_REPORTS_SECRET;
  if (!expected) return false;
  const got = request.headers.get("x-wsc-secret") ?? "";
  if (got.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/stock-count/reports")({
  server: {
    handlers: {
      OPTIONS: async () => jsonRes({}, 204),
      GET: async ({ request }) => {
        if (!checkSecret(request)) return jsonRes({ error: "Unauthorized" }, 401);

        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? "submitted";
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const batchId = url.searchParams.get("batch_id");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1000);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // single-batch detail mode
        if (batchId) {
          const { data: batch, error: bErr } = await supabaseAdmin
            .from("stock_count_batches")
            .select(
              "id, batch_no, status, note, counted_by_emp_id, counted_by_emp_code, counted_by_name, submitted_at, created_at",
            )
            .eq("id", batchId)
            .maybeSingle();
          if (bErr) return jsonRes({ error: bErr.message }, 500);
          if (!batch) return jsonRes({ error: "not found" }, 404);

          const { data: lines, error: lErr } = await supabaseAdmin
            .from("stock_counts")
            .select(
              "id, batch_id, item_id, item_code, item_name, unit, counted_qty, system_qty, variance, status, note, created_at",
            )
            .eq("batch_id", batchId)
            .order("created_at", { ascending: true })
            .limit(5000);
          if (lErr) return jsonRes({ error: lErr.message }, 500);
          return jsonRes({ batch, lines: lines ?? [] });
        }

        // list mode
        let q = supabaseAdmin
          .from("stock_count_batches")
          .select(
            "id, batch_no, status, note, counted_by_emp_id, counted_by_emp_code, counted_by_name, submitted_at, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status !== "all") q = q.eq("status", status);
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);

        const { data: batches, error } = await q;
        if (error) return jsonRes({ error: error.message }, 500);
        const list = batches ?? [];

        const statsByBatch: Record<
          string,
          { total: number; match: number; short: number; over: number; mismatch: number }
        > = {};
        if (list.length) {
          const ids = list.map((b) => b.id);
          const { data: lines } = await supabaseAdmin
            .from("stock_counts")
            .select("batch_id, status")
            .in("batch_id", ids)
            .limit(50000);
          for (const l of lines ?? []) {
            if (!l.batch_id) continue;
            const s = (statsByBatch[l.batch_id] ??= {
              total: 0,
              match: 0,
              short: 0,
              over: 0,
              mismatch: 0,
            });
            s.total++;
            if (l.status === "match") s.match++;
            else if (l.status === "short") {
              s.short++;
              s.mismatch++;
            } else if (l.status === "over") {
              s.over++;
              s.mismatch++;
            }
          }
        }

        const batchesOut = list.map((b) => ({
          ...b,
          stats: statsByBatch[b.id] ?? { total: 0, match: 0, short: 0, over: 0, mismatch: 0 },
        }));

        return jsonRes({ batches: batchesOut });
      },
    },
  },
});
