// Server functions for the LogUpdate / system_logs feature.
// Admin-only — gated by the same admin token issued by `verifyAdminPassword`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) {
    throw new Error("Unauthorized");
  }
}

const tokenStr = z.string().min(1);
const categoryEnum = z.enum(["feature", "bugfix", "security", "ui", "refactor"]);

export const adminFetchSystemLogs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        limit: z.number().int().min(1).max(500).optional(),
        category: categoryEnum.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    let q = supabaseAdmin
      .from("system_logs")
      .select("id, title, summary, category, version, paths, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const adminGetLatestSystemLog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("system_logs")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { latest: row };
  });

export const adminInsertSystemLog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().min(1).max(2000),
        category: categoryEnum,
        version: z.string().trim().max(50).nullable().optional(),
        paths: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin.from("system_logs").insert({
      title: data.title,
      summary: data.summary,
      category: data.category,
      version: data.version ?? null,
      paths: data.paths ?? [],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteSystemLog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: tokenStr, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("system_logs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
