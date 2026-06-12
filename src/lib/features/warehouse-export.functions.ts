import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { loadSettingSection } from "@/lib/features/warehouse-settings.functions";

const tokenStr = z.string().min(1);

async function nextShipmentNo(): Promise<string> {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const { count } = await supabaseAdmin
    .from("wh_shipments")
    .select("id", { count: "exact", head: true });
  return `SHP-${date}-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

export const adminWhCreateShipment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        container_no: z.string().max(100).default(""),
        seal_no: z.string().max(100).default(""),
        destination_id: z.string().uuid().nullable().optional(),
        destination_text: z.string().max(200).default(""),
        pallet_ids: z.array(z.string().uuid()).min(1).max(200),
        note: z.string().max(500).default(""),
        sealed_by: z.string().max(200).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    const exportSettings = await loadSettingSection("export");

    if (exportSettings.container_no_required && !data.container_no.trim()) {
      throw new Error("ต้องระบุ Container No.");
    }
    if (exportSettings.seal_no_required && !data.seal_no.trim()) {
      throw new Error("ต้องระบุ Seal No.");
    }
    if (exportSettings.destination_required && !data.destination_id && !data.destination_text.trim()) {
      throw new Error("ต้องระบุปลายทาง");
    }

    const { data: pallets, error: pErr } = await supabaseAdmin
      .from("wh_pallets")
      .select("*")
      .in("id", data.pallet_ids);
    if (pErr) throw new Error(pErr.message);

    for (const p of pallets ?? []) {
      if (exportSettings.only_complete_pallets && p.status !== "complete") {
        if (!(exportSettings.allow_incomplete_with_approval && p.status === "incomplete")) {
          throw new Error(`Pallet ${p.pallet_no} ยังไม่พร้อมส่งออก (${p.status})`);
        }
      }
      if (p.status === "loaded") throw new Error(`Pallet ${p.pallet_no} โหลดแล้ว`);
    }

    const totalBoxes = (pallets ?? []).reduce((s, p) => s + (p.counted_boxes ?? 0), 0);
    const shipmentNo = await nextShipmentNo();
    const sealedAt = new Date().toISOString();

    const { data: shipment, error } = await supabaseAdmin
      .from("wh_shipments")
      .insert({
        shipment_no: shipmentNo,
        container_no: data.container_no.trim(),
        seal_no: data.seal_no.trim(),
        destination_id: data.destination_id ?? null,
        destination_text: data.destination_text.trim(),
        status: "sealed",
        total_pallets: data.pallet_ids.length,
        total_boxes: totalBoxes,
        sealed_by: data.sealed_by.trim(),
        sealed_at: sealedAt,
        note: data.note,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("wh_shipment_pallets").insert(
      data.pallet_ids.map((pallet_id) => ({
        shipment_id: shipment.id,
        pallet_id,
      })),
    );

    await supabaseAdmin
      .from("wh_pallets")
      .update({ status: "loaded", updated_at: sealedAt })
      .in("id", data.pallet_ids);

    await supabaseAdmin
      .from("wh_boxes")
      .update({ status: "exported" })
      .in("pallet_id", data.pallet_ids);

    return shipment;
  });

export const adminWhListShipments = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        status: z.enum(["draft", "sealed", "shipped", "all"]).default("all"),
        limit: z.number().int().max(500).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    let q = supabaseAdmin
      .from("wh_shipments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhListDestinationsForExport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    const { data: rows, error } = await supabaseAdmin
      .from("wh_destinations")
      .select("id, code, name, country")
      .eq("active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
