// Server functions for managing policy/terms documents.
// Public read (no auth); admin-only write via admin token.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

const keyEnum = z.enum(["terms", "admin_policy"]);

export const getPolicy = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ key: keyEnum }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("policies")
      .select("key, title, content, version, updated_at, updated_by")
      .eq("key", data.key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { policy: row };
  });

export const adminUpdatePolicy = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        key: keyEnum,
        title: z.string().trim().min(1).max(200),
        content: z.string().max(50_000),
        updated_by: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    const { data: cur, error: e0 } = await supabaseAdmin
      .from("policies")
      .select("version")
      .eq("key", data.key)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    const nextVersion = (cur?.version ?? 0) + 1;
    const { error } = await supabaseAdmin
      .from("policies")
      .update({
        title: data.title,
        content: data.content,
        version: nextVersion,
        updated_by: data.updated_by ?? null,
      })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true, version: nextVersion };
  });
