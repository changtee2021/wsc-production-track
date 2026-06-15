import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { verifyWarehouseToken } from "@/lib/auth/warehouse-token.server";
import { hrFloorStaffUrl } from "@/lib/hr-app-url";
import { WH_SETTINGS_DEFAULTS, type WhSettingsKey } from "@/lib/warehouse/types";

const SETTINGS_KEYS = Object.keys(WH_SETTINGS_DEFAULTS) as WhSettingsKey[];

function requireAdmin(token: string | undefined): void {
  if (!verifyAdminToken(token ?? "")) throw new Error("Unauthorized");
}

function requireWorker(token: string | undefined): void {
  if (!verifyWarehouseToken(token ?? "")) throw new Error("Unauthorized");
}

export async function loadAllSettings(): Promise<Record<string, Record<string, unknown>>> {
  const { data, error } = await supabaseAdmin.from("wh_settings").select("key, value");
  if (error) throw new Error(error.message);
  const out: Record<string, Record<string, unknown>> = {};
  for (const k of SETTINGS_KEYS) {
    const row = (data ?? []).find((r) => r.key === k);
    out[k] = { ...WH_SETTINGS_DEFAULTS[k], ...((row?.value as Record<string, unknown>) ?? {}) };
  }
  return out;
}

export async function loadSettingSection(key: WhSettingsKey): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin
    .from("wh_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { ...WH_SETTINGS_DEFAULTS[key], ...((data?.value as Record<string, unknown>) ?? {}) };
}

export const whGetAuthConfig = createServerFn({ method: "GET" }).handler(async () => {
  const general = await loadSettingSection("general");
  return { passcode_enabled: !!general.passcode_enabled };
});

export const whListEmployees = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("stock_employees" as never)
      .select("id, name, emp_code")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      emp_code: String(r.emp_code ?? ""),
    }));
  });

export const whListVisionItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const vision = await loadSettingSection("vision");
    if (!vision.enabled) return [];
    const { data: rows, error } = await supabaseAdmin
      .from("wh_vision_check_items")
      .select("id, label, required")
      .eq("active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (rows ?? []) as { id: string; label: string; required: boolean }[];
  });

export const whIssueSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        passcode: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const general = await loadSettingSection("general");
    if (general.passcode_enabled) {
      const expected = String(general.passcode ?? "");
      if (!data.passcode || data.passcode !== expected) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }
    }
    const { issueWarehouseToken } = await import("@/lib/auth/warehouse-token.server");
    return { token: issueWarehouseToken() };
  });

export const whGetPublicSettings = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const all = await loadAllSettings();
    return {
      general: {
        company_code: all.general.company_code,
      },
      receiving: all.receiving,
      pallet: all.pallet,
      scan: all.scan,
    };
  });

export const adminWhGetSettings = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    return loadAllSettings();
  });

export const adminWhUpdateSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        key: z.enum([
          "general",
          "receiving",
          "pallet",
          "scan",
          "export",
          "integration",
          "labels",
          "audit",
          "vision",
        ]),
        value: z.record(z.string(), z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const merged = { ...WH_SETTINGS_DEFAULTS[data.key], ...data.value };
    const { error } = await supabaseAdmin
      .from("wh_settings")
      .upsert({ key: data.key, value: merged, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return merged;
  });

export const adminWhResetSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        key: z.enum([
          "general",
          "receiving",
          "pallet",
          "scan",
          "export",
          "integration",
          "labels",
          "audit",
          "vision",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const defaults = WH_SETTINGS_DEFAULTS[data.key];
    const { error } = await supabaseAdmin
      .from("wh_settings")
      .upsert({ key: data.key, value: defaults, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return defaults;
  });

// ── Master data CRUD ──────────────────────────────────────────

const tokenStr = z.string().min(1);

export const adminWhListTemplates = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_pallet_templates")
      .select("*")
      .order("item_code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhUpsertTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        item_code: z.string().min(1).max(64),
        item_name: z.string().max(200).default(""),
        boxes_per_layer: z.number().int().positive().max(200),
        layers: z.number().int().positive().max(50),
        active: z.boolean().default(true),
        note: z.string().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const row = {
      item_code: data.item_code.trim(),
      item_name: data.item_name.trim(),
      boxes_per_layer: data.boxes_per_layer,
      layers: data.layers,
      active: data.active,
      note: data.note,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("wh_pallet_templates")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await supabaseAdmin
      .from("wh_pallet_templates")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const adminWhListDestinations = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_destinations")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhUpsertDestination = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        code: z.string().min(1).max(32),
        name: z.string().min(1).max(200),
        country: z.string().max(100).default(""),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const row = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      country: data.country.trim(),
      active: data.active,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("wh_destinations")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await supabaseAdmin
      .from("wh_destinations")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const adminWhListZones = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_warehouse_zones")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhUpsertZone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        code: z.string().min(1).max(32),
        name: z.string().min(1).max(200),
        zone_type: z.enum(["receiving", "storage", "staging", "dock"]).default("storage"),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const row = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      zone_type: data.zone_type,
      active: data.active,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("wh_warehouse_zones")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await supabaseAdmin
      .from("wh_warehouse_zones")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const adminWhListReasonCodes = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_scan_reason_codes")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhUpsertReasonCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        code: z.string().min(1).max(32),
        label: z.string().min(1).max(200),
        reason_type: z.enum(["incomplete", "reject", "override"]).default("incomplete"),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const row = {
      code: data.code.trim().toUpperCase(),
      label: data.label.trim(),
      reason_type: data.reason_type,
      active: data.active,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("wh_scan_reason_codes")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await supabaseAdmin
      .from("wh_scan_reason_codes")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const adminWhListLabelTemplates = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_label_templates")
      .select("*")
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhUpsertLabelTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        code: z.string().min(1).max(32),
        name: z.string().min(1).max(200),
        template_type: z.enum(["box", "pallet", "packing_list"]).default("box"),
        config: z.record(z.string(), z.unknown()).default({}),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const row = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      template_type: data.template_type,
      config: data.config,
      active: data.active,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("wh_label_templates")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await supabaseAdmin
      .from("wh_label_templates")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const adminWhListEmployees = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_employees")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhUpsertEmployee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(200),
        emp_code: z.string().max(64).default(""),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    throw new Error(`จัดการพนักงานคลังย้ายไป HR: ${hrFloorStaffUrl("WSC")}`);
  });

export const adminWhListVisionItems = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_vision_check_items")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminWhUpsertVisionItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        label: z.string().min(1).max(500),
        required: z.boolean().default(true),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const row = {
      label: data.label.trim(),
      required: data.required,
      active: data.active,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("wh_vision_check_items")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await supabaseAdmin
      .from("wh_vision_check_items")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const adminWhListSyncLogs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, limit: z.number().int().max(200).default(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("wh_sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
