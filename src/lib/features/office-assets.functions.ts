// Office Supplies (B1 — สต๊อกสินทรัพย์ออฟฟิศ/โรงงาน) server functions.
// - public viewers use a free token issued by issueOfficeSession (mirrors packing)
// - admin CRUD requires the admin token
// - straight-line depreciation computed server-side
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { issueOfficeToken, verifyOfficeToken } from "@/lib/auth/office-token.server";

const tokenStr = z.string().min(1);

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}
function assertOfficeOrAdmin(token: string | undefined) {
  if (verifyOfficeToken(token)) return;
  if (verifyAdminToken(token)) return;
  throw new Error("Unauthorized");
}

// ============ SESSION ============
export const issueOfficeSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async () => ({ token: issueOfficeToken() }));

// ============ CATEGORIES ============
export const officeListCategories = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertOfficeOrAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("office_asset_categories")
      .select("id, name, default_useful_life_months, sort_order, active")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const categoryInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  default_useful_life_months: z.number().int().min(1).max(1200).default(36),
  sort_order: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const adminUpsertOfficeCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, category: categoryInput }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const c = data.category;
    const payload = {
      name: c.name,
      default_useful_life_months: c.default_useful_life_months,
      sort_order: c.sort_order,
      active: c.active,
    };
    if (c.id) {
      const { error } = await supabaseAdmin
        .from("office_asset_categories")
        .update(payload)
        .eq("id", c.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: c.id };
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("office_asset_categories")
        .insert(payload)
        .select("id")
        .single();
      if (error || !ins) throw new Error(error?.message || "บันทึกไม่สำเร็จ");
      return { ok: true, id: ins.id };
    }
  });

export const adminDeleteOfficeCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("office_asset_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListOfficeCategoriesAll = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("office_asset_categories")
      .select("id, name, default_useful_life_months, sort_order, active")
      .order("sort_order")
      .order("name");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ============ DEPRECIATION ============
type AssetRow = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  salvage_value: number | string | null;
  useful_life_months: number | null;
  warranty_until: string | null;
  location: string | null;
  assignee: string | null;
  image_url: string | null;
  note: string | null;
  vendor: string | null;
  status: string;
  active: boolean;
  stock_qty: number;
  min_qty: number;
  unit: string;
  created_at: string;
  updated_at: string;
};

function monthsBetween(from: Date, to: Date): number {
  const y = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  let total = y * 12 + m;
  if (to.getDate() < from.getDate()) total -= 1;
  return Math.max(0, total);
}

export type Depreciation = {
  useful_life_months: number | null;
  months_in_use: number;
  monthly_dep: number;
  accumulated_dep: number;
  book_value: number;
  fully_depreciated: boolean;
};

function calcDepreciation(
  a: Pick<AssetRow, "purchase_date" | "purchase_price" | "salvage_value" | "useful_life_months">,
  fallbackLife: number | null,
): Depreciation {
  const price = Number(a.purchase_price ?? 0);
  const salvage = Number(a.salvage_value ?? 0);
  const life = a.useful_life_months ?? fallbackLife;
  if (!a.purchase_date || !price || !life || life <= 0) {
    return {
      useful_life_months: life ?? null,
      months_in_use: 0,
      monthly_dep: 0,
      accumulated_dep: 0,
      book_value: price,
      fully_depreciated: false,
    };
  }
  const months = Math.min(life, monthsBetween(new Date(a.purchase_date), new Date()));
  const monthly = (price - salvage) / life;
  const accumulated = Math.min(price - salvage, monthly * months);
  const book = Math.max(salvage, price - accumulated);
  return {
    useful_life_months: life,
    months_in_use: months,
    monthly_dep: round2(monthly),
    accumulated_dep: round2(accumulated),
    book_value: round2(book),
    fully_depreciated: months >= life,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============ ASSETS — VIEW ============
export const officeListAssets = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        includeInactive: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertOfficeOrAdmin(data.token);
    let q = supabaseAdmin
      .from("office_assets")
      .select("*")
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    if (!data.includeInactive) q = q.eq("active", true);
    const { data: assets, error } = await q;
    if (error) throw new Error(error.message);
    const { data: cats } = await supabaseAdmin
      .from("office_asset_categories")
      .select("id, name, default_useful_life_months");
    const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
    const rows = (assets ?? []).map((a) => {
      const cat = a.category_id ? catMap.get(a.category_id) : null;
      const dep = calcDepreciation(a as AssetRow, cat?.default_useful_life_months ?? null);
      return {
        ...(a as AssetRow),
        category_name: cat?.name ?? null,
        depreciation: dep,
      };
    });
    return { rows };
  });

export const officeGetAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    assertOfficeOrAdmin(data.token);
    const { data: a, error } = await supabaseAdmin
      .from("office_assets")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !a) throw new Error(error?.message || "ไม่พบสินทรัพย์");
    let cat: { name: string; default_useful_life_months: number } | null = null;
    if (a.category_id) {
      const { data: c } = await supabaseAdmin
        .from("office_asset_categories")
        .select("name, default_useful_life_months")
        .eq("id", a.category_id)
        .single();
      cat = c ?? null;
    }
    const dep = calcDepreciation(a as AssetRow, cat?.default_useful_life_months ?? null);
    return { row: { ...(a as AssetRow), category_name: cat?.name ?? null, depreciation: dep } };
  });

// ============ ASSETS — ADMIN CRUD ============
const assetInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  category_id: z.string().uuid().nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  serial_no: z.string().trim().max(100).nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  purchase_price: z.number().nullable().optional(),
  salvage_value: z.number().min(0).default(0),
  useful_life_months: z.number().int().min(1).max(1200).nullable().optional(),
  warranty_until: z.string().nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  assignee: z.string().trim().max(200).nullable().optional(),
  image_url: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  vendor: z.string().trim().max(200).nullable().optional(),
  status: z.enum(["in_use", "repair", "retired", "lost"]).default("in_use"),
  active: z.boolean().default(true),
  stock_qty: z.number().int().min(0).max(999999).default(0),
  min_qty: z.number().int().min(0).max(999999).default(0),
  unit: z.string().trim().min(1).max(30).default("ชิ้น"),
});

export const adminUpsertOfficeAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, asset: assetInput }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const a = data.asset;
    const payload = {
      name: a.name,
      category_id: a.category_id ?? null,
      brand: a.brand ?? null,
      model: a.model ?? null,
      serial_no: a.serial_no ?? null,
      purchase_date: a.purchase_date || null,
      purchase_price: a.purchase_price ?? null,
      salvage_value: a.salvage_value,
      useful_life_months: a.useful_life_months ?? null,
      warranty_until: a.warranty_until || null,
      location: a.location ?? null,
      assignee: a.assignee ?? null,
      image_url: a.image_url ?? null,
      note: a.note ?? null,
      vendor: a.vendor ?? null,
      status: a.status,
      active: a.active,
      stock_qty: a.stock_qty,
      min_qty: a.min_qty,
      unit: a.unit,
    };
    if (a.id) {
      const { error } = await supabaseAdmin.from("office_assets").update(payload).eq("id", a.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: a.id };
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("office_assets")
        .insert(payload)
        .select("id")
        .single();
      if (error || !ins) throw new Error(error?.message || "บันทึกไม่สำเร็จ");
      return { ok: true, id: ins.id };
    }
  });

export const adminDeleteOfficeAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin.from("office_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ SUMMARY (depreciation report) ============
export const adminOfficeSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const [{ data: assets, error: aerr }, { data: cats, error: cerr }] = await Promise.all([
      supabaseAdmin.from("office_assets").select("*").eq("active", true),
      supabaseAdmin
        .from("office_asset_categories")
        .select("id, name, default_useful_life_months, sort_order"),
    ]);
    if (aerr) throw new Error(aerr.message);
    if (cerr) throw new Error(cerr.message);
    const catMap = new Map((cats ?? []).map((c) => [c.id, c]));

    const byCategory = new Map<
      string,
      {
        category_id: string | null;
        category_name: string;
        count: number;
        cost: number;
        accumulated: number;
        book: number;
        fully: number;
      }
    >();
    const byYear = new Map<
      number,
      {
        year: number;
        count: number;
        cost: number;
        accumulated: number;
        book: number;
      }
    >();
    let totalCount = 0,
      totalCost = 0,
      totalAcc = 0,
      totalBook = 0,
      totalFully = 0;

    for (const raw of (assets ?? []) as AssetRow[]) {
      const cat = raw.category_id ? catMap.get(raw.category_id) : null;
      const dep = calcDepreciation(raw, cat?.default_useful_life_months ?? null);
      const price = Number(raw.purchase_price ?? 0);

      const cKey = cat?.id ?? "__none__";
      const cName = cat?.name ?? "ไม่ระบุหมวด";
      const c = byCategory.get(cKey) ?? {
        category_id: cat?.id ?? null,
        category_name: cName,
        count: 0,
        cost: 0,
        accumulated: 0,
        book: 0,
        fully: 0,
      };
      c.count += 1;
      c.cost += price;
      c.accumulated += dep.accumulated_dep;
      c.book += dep.book_value;
      if (dep.fully_depreciated) c.fully += 1;
      byCategory.set(cKey, c);

      if (raw.purchase_date) {
        const yr = new Date(raw.purchase_date).getFullYear();
        const y = byYear.get(yr) ?? { year: yr, count: 0, cost: 0, accumulated: 0, book: 0 };
        y.count += 1;
        y.cost += price;
        y.accumulated += dep.accumulated_dep;
        y.book += dep.book_value;
        byYear.set(yr, y);
      }

      totalCount += 1;
      totalCost += price;
      totalAcc += dep.accumulated_dep;
      totalBook += dep.book_value;
      if (dep.fully_depreciated) totalFully += 1;
    }

    const fullyDepreciatedList = ((assets ?? []) as AssetRow[])
      .map((raw) => {
        const cat = raw.category_id ? catMap.get(raw.category_id) : null;
        const dep = calcDepreciation(raw, cat?.default_useful_life_months ?? null);
        return { raw, dep, cat };
      })
      .filter(({ dep }) => dep.fully_depreciated)
      .map(({ raw, dep, cat }) => ({
        id: raw.id,
        code: raw.code,
        name: raw.name,
        category_name: cat?.name ?? null,
        purchase_date: raw.purchase_date,
        purchase_price: Number(raw.purchase_price ?? 0),
        book_value: dep.book_value,
      }));

    return {
      total: {
        count: totalCount,
        cost: round2(totalCost),
        accumulated: round2(totalAcc),
        book: round2(totalBook),
        fully: totalFully,
      },
      byCategory: Array.from(byCategory.values())
        .map((r) => ({
          ...r,
          cost: round2(r.cost),
          accumulated: round2(r.accumulated),
          book: round2(r.book),
        }))
        .sort((a, b) => b.cost - a.cost),
      byYear: Array.from(byYear.values())
        .map((r) => ({
          ...r,
          cost: round2(r.cost),
          accumulated: round2(r.accumulated),
          book: round2(r.book),
        }))
        .sort((a, b) => a.year - b.year),
      fullyDepreciatedList,
    };
  });

// ============ Storage upload — office-assets bucket (public) ============
export const adminOfficeCreateUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        ext: z.string().regex(/^[a-zA-Z0-9]{1,8}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const path = `${crypto.randomUUID()}.${data.ext.toLowerCase()}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("office-assets")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Could not sign upload");
    const { data: pub } = supabaseAdmin.storage.from("office-assets").getPublicUrl(path);
    return { path, token: signed.token, publicUrl: pub.publicUrl };
  });
