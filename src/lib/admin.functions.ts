// Admin-only server functions. All mutations require a valid admin token
// (issued by `verifyAdminPassword`) and run with the service-role client,
// bypassing RLS safely on the server.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  issueAdminToken,
  verifyAdminToken,
  constantTimePasswordEquals,
} from "./admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) {
    throw new Error("Unauthorized");
  }
}

// ---- Auth ----------------------------------------------------------------

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return { ok: false as const, error: "Admin password not configured" };
    }
    if (!constantTimePasswordEquals(data.password, expected)) {
      return { ok: false as const, error: "รหัสผ่านไม่ถูกต้อง" };
    }
    return { ok: true as const, token: issueAdminToken() };
  });

export const checkAdminToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => ({ ok: verifyAdminToken(data.token) }));

// ---- Categories ----------------------------------------------------------

const tokenStr = z.string().min(1);

export const adminUpsertCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("categories")
        .update({ name: data.name })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("categories")
        .insert({ name: data.name });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Employees -----------------------------------------------------------

const employeePayload = z.object({
  token: tokenStr,
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  emp_code: z.string().trim().max(50).nullable().optional(),
  nationality: z.string().trim().max(50).nullable().optional(),
  avatar_url: z.string().url().max(2000).nullable().optional(),
  active: z.boolean().optional(),
});

export const adminUpsertEmployee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => employeePayload.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const row = {
      name: data.name,
      emp_code: data.emp_code ?? null,
      nationality: data.nationality ?? null,
      avatar_url: data.avatar_url ?? null,
      ...(data.active !== undefined ? { active: data.active } : {}),
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("employees")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("employees").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteEmployee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("employees")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Steps ---------------------------------------------------------------

const stepPayload = z.object({
  token: tokenStr,
  id: z.string().uuid().optional(),
  step_name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  image_url: z.string().url().max(2000).nullable().optional(),
  std_duration_minutes: z.number().int().min(0).max(100000).nullable().optional(),
  active: z.boolean().optional(),
});

export const adminUpsertStep = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => stepPayload.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const row = {
      step_name: data.step_name,
      description: data.description ?? null,
      image_url: data.image_url ?? null,
      std_duration_minutes: data.std_duration_minutes ?? null,
      ...(data.active !== undefined ? { active: data.active } : {}),
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("steps")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("steps").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteStep = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("steps")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Storage uploads -----------------------------------------------------
// Returns a signed upload URL the admin client can PUT to without RLS access.

export const adminCreateUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        bucket: z.enum(["avatars", "step-images", "banners"]),
        ext: z.string().regex(/^[a-zA-Z0-9]{1,8}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const path = `${crypto.randomUUID()}.${data.ext.toLowerCase()}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Could not sign upload");
    const { data: pub } = supabaseAdmin.storage.from(data.bucket).getPublicUrl(path);
    return { path, token: signed.token, publicUrl: pub.publicUrl };
  });

// ---- Home banners --------------------------------------------------------

export const adminInsertBanner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        image_path: z.string().min(1).max(500),
        sort_order: z.number().int().min(0).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin.from("home_banners").insert({
      image_path: data.image_path,
      sort_order: data.sort_order ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateBanner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid(),
        active: z.boolean().optional(),
        sort_order: z.number().int().min(0).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const row: { active?: boolean; sort_order?: number } = {};
    if (data.active !== undefined) row.active = data.active;
    if (data.sort_order !== undefined) row.sort_order = data.sort_order;
    if (Object.keys(row).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("home_banners")
      .update(row)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteBanner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid(), image_path: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    await supabaseAdmin.storage.from("banners").remove([data.image_path]);
    const { error } = await supabaseAdmin
      .from("home_banners")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Production logs (admin reads) ---------------------------------------

export const adminFetchLogs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        select: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(1000).optional(),
        paginate: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    if (data.paginate) {
      const PAGE = 1000;
      const all: Record<string, unknown>[] = [];
      let from = 0;
      for (let p = 0; p < 100; p++) {
        const { data: rows, error } = await supabaseAdmin
          .from("production_logs")
          .select(data.select)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        const chunk = rows ?? [];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return { rows: all };
    }
    const { data: rows, error } = await supabaseAdmin
      .from("production_logs")
      .select(data.select)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 1000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ---- Announcements --------------------------------------------------------

export const adminInsertAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        message: z.string().min(1).max(500),
        sort_order: z.number().int().min(0).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin.from("announcements").insert({
      message: data.message,
      sort_order: data.sort_order ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        id: z.string().uuid(),
        message: z.string().min(1).max(500).optional(),
        active: z.boolean().optional(),
        sort_order: z.number().int().min(0).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const row: { message?: string; active?: boolean; sort_order?: number; updated_at?: string } = {};
    if (data.message !== undefined) row.message = data.message;
    if (data.active !== undefined) row.active = data.active;
    if (data.sort_order !== undefined) row.sort_order = data.sort_order;
    if (Object.keys(row).length === 0) return { ok: true };
    row.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("announcements")
      .update(row)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
