import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

const tokenStr = z.string().min(1);

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const adminWhDashboardKpis = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    const from = todayStart();

    const [receipts, pallets, pendingExport, incomplete] = await Promise.all([
      supabaseAdmin
        .from("wh_receipts")
        .select("received_boxes")
        .eq("status", "confirmed")
        .gte("confirmed_at", from),
      supabaseAdmin
        .from("wh_pallets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", from),
      supabaseAdmin
        .from("wh_pallets")
        .select("id", { count: "exact", head: true })
        .eq("status", "complete"),
      supabaseAdmin
        .from("wh_pallets")
        .select("id", { count: "exact", head: true })
        .eq("status", "incomplete"),
    ]);

    const boxesToday = (receipts.data ?? []).reduce(
      (s, r) => s + Number(r.received_boxes ?? 0),
      0,
    );

    const statusCounts = await supabaseAdmin.from("wh_pallets").select("status");
    const byStatus: Record<string, number> = {};
    for (const row of statusCounts.data ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    }

    const last7: { date: string; boxes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      const { data: dayRows } = await supabaseAdmin
        .from("wh_receipts")
        .select("received_boxes")
        .eq("status", "confirmed")
        .gte("confirmed_at", d.toISOString())
        .lte("confirmed_at", end.toISOString());
      const boxes = (dayRows ?? []).reduce((s, r) => s + Number(r.received_boxes ?? 0), 0);
      last7.push({
        date: d.toISOString().slice(0, 10),
        boxes,
      });
    }

    return {
      boxes_received_today: boxesToday,
      pallets_today: pallets.count ?? 0,
      pending_export: pendingExport.count ?? 0,
      incomplete_counts: incomplete.count ?? 0,
      pallet_status: byStatus,
      boxes_last_7_days: last7,
    };
  });

export const adminWhExportReportCsv = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        type: z.enum(["receipts", "pallets", "shipments"]).default("pallets"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    const table =
      data.type === "receipts"
        ? "wh_receipts"
        : data.type === "shipments"
          ? "wh_shipments"
          : "wh_pallets";
    const { data: rows, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return "empty";
    const headers = Object.keys(list[0] as object);
    const lines = [
      headers.join(","),
      ...list.map((r) =>
        headers
          .map((h) => {
            const v = (r as Record<string, unknown>)[h];
            const s = v == null ? "" : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ];
    return lines.join("\n");
  });
