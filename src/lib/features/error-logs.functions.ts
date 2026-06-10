// Server functions สำหรับหน้า /server-logs (admin-only ผ่าน admin token)
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

export type ErrorLogRow = {
  id: string;
  created_at: string;
  level: string;
  source: string;
  route_path: string | null;
  message: string;
  stack: string | null;
  status_code: number | null;
  request_url: string | null;
  user_agent: string | null;
};

export type HealthCheckItem = {
  path: string;
  ok: boolean;
  status: number;
  ms: number;
};

export const SSR_HEALTH_ROUTES = [
  "/",
  "/scan",
  "/feedback",
  "/qc",
  "/packing",
  "/maintenance",
  "/supplies",
  "/stock-count",
  "/admin",
] as const;

const tokenStr = z.string().min(1);

const listSchema = z.object({
  token: tokenStr,
  days: z.coerce.number().int().min(1).max(90).default(7),
  level: z.enum(["all", "error", "warn"]).default("all"),
  source: z.enum(["all", "ssr", "route", "client", "health"]).default("all"),
  search: z.string().max(200).optional().default(""),
});

export const adminListErrorLogs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data }): Promise<{ rows: ErrorLogRow[]; total: number }> => {
    assertAdmin(data.token);
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    let q = supabaseAdmin
      .from("error_logs")
      .select(
        "id, created_at, level, source, route_path, message, stack, status_code, request_url, user_agent",
        { count: "exact" },
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.level !== "all") q = q.eq("level", data.level);
    if (data.source !== "all") q = q.eq("source", data.source);
    if (data.search.trim()) {
      const s = data.search.trim().replace(/[%,]/g, "");
      q = q.or(`message.ilike.%${s}%,route_path.ilike.%${s}%`);
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // cleanup เก่ากว่า 30 วัน — best-effort
    void supabaseAdmin
      .from("error_logs")
      .delete()
      .lt("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .then(() => {});

    return { rows: (rows ?? []) as ErrorLogRow[], total: count ?? 0 };
  });

export const adminGetErrorLogStats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }): Promise<{ last24h: number }> => {
    assertAdmin(data.token);
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabaseAdmin
      .from("error_logs")
      .select("id", { count: "exact", head: true })
      .eq("level", "error")
      .gte("created_at", since);
    return { last24h: count ?? 0 };
  });

export const adminClearErrorLogs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("error_logs")
      .delete()
      .gte("created_at", "1970-01-01");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRunSsrHealthCheck = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }): Promise<{ items: HealthCheckItem[]; healthy: boolean }> => {
    assertAdmin(data.token);

    const req = getRequest();
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("host") ?? "";
    const origin = `${proto}://${host}`;

    const items = await Promise.all(
      SSR_HEALTH_ROUTES.map(async (path): Promise<HealthCheckItem> => {
        const start = Date.now();
        try {
          const res = await fetch(`${origin}${path}`, {
            headers: { "user-agent": "ssr-health-check" },
            redirect: "manual",
          });
          const ms = Date.now() - start;
          const ok = res.status < 500;
          if (!ok) {
            const { recordError } = await import("@/lib/error-logs.server");
            void recordError({
              source: "health",
              routePath: path,
              statusCode: res.status,
              message: `Health check failed: ${path} → HTTP ${res.status}`,
              requestUrl: `${origin}${path}`,
            });
          }
          return { path, ok, status: res.status, ms };
        } catch (e) {
          const ms = Date.now() - start;
          const { recordError } = await import("@/lib/error-logs.server");
          void recordError({
            source: "health",
            routePath: path,
            message: `Health check error: ${path} → ${(e as Error).message}`,
            requestUrl: `${origin}${path}`,
          });
          return { path, ok: false, status: 0, ms };
        }
      }),
    );

    return { items, healthy: items.every((i) => i.ok) };
  });
