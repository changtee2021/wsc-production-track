import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

const BUCKETS = ["avatars", "step-images", "banners", "log-notes", "qc-media"] as const;

async function bucketSize(
  bucket: string,
): Promise<{ name: string; size_bytes: number; file_count: number }> {
  let total = 0;
  let count = 0;
  // recursive walk
  const walk = async (prefix: string) => {
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(prefix, { limit: PAGE, offset });
      if (error) throw new Error(`${bucket}: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const item of data) {
        // folder entries have null id
        if (item.id === null) {
          await walk(prefix ? `${prefix}/${item.name}` : item.name);
        } else {
          count += 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const size = (item.metadata as any)?.size ?? 0;
          total += typeof size === "number" ? size : 0;
        }
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  };
  await walk("");
  return { name: bucket, size_bytes: total, file_count: count };
}

export const getStorageUsage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");

    const { data: dbStats, error: dbErr } = await supabaseAdmin.rpc("get_db_usage_stats");
    if (dbErr) throw new Error(dbErr.message);

    const buckets = await Promise.all(
      BUCKETS.map((b) =>
        bucketSize(b).catch((e) => ({
          name: b,
          size_bytes: 0,
          file_count: 0,
          error: e instanceof Error ? e.message : String(e),
        })),
      ),
    );

    const storageTotal = buckets.reduce((a, b) => a + b.size_bytes, 0);

    return {
      generated_at: new Date().toISOString(),
      database: dbStats as {
        total_bytes: number;
        tables: Array<{ name: string; size_bytes: number; row_count: number }>;
      },
      storage: {
        total_bytes: storageTotal,
        buckets: buckets.sort((a, b) => b.size_bytes - a.size_bytes),
      },
    };
  });
