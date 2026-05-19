// Sign storage paths/URLs from the private buckets `qc-media` and
// `log-notes` into short-lived signed URLs. Accepts a mix of legacy
// public URLs and new-style storage paths so we don't need a data
// backfill for existing rows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";
import { verifyQcToken } from "./qc-token.server";
import {
  parseStorageRef,
  parseStorageRefWithDefault,
} from "./storage-refs.server";

const ALLOWED = ["qc-media", "log-notes"] as const;
const SIGN_TTL = 60 * 60; // 1 hour

async function signRefs(
  refs: string[],
  defaultBucket: "qc-media" | "log-notes" | null,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  // Dedupe
  const unique = Array.from(new Set(refs.filter((r) => typeof r === "string" && r.length > 0)));

  // Group by bucket
  const byBucket = new Map<string, { ref: string; path: string }[]>();
  for (const ref of unique) {
    const parsed = defaultBucket
      ? parseStorageRefWithDefault(ref, defaultBucket, ALLOWED)
      : parseStorageRef(ref, ALLOWED);
    if (!parsed) continue;
    const list = byBucket.get(parsed.bucket) ?? [];
    list.push({ ref, path: parsed.path });
    byBucket.set(parsed.bucket, list);
  }

  for (const [bucket, entries] of byBucket) {
    const paths = entries.map((e) => e.path);
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrls(paths, SIGN_TTL);
    if (error || !data) continue;
    data.forEach((row, i) => {
      if (row.signedUrl) out[entries[i].ref] = row.signedUrl;
    });
  }
  return out;
}

const refsSchema = z.array(z.string().min(1).max(2000)).max(200);

export const adminSignMediaUrls = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        refs: refsSchema,
        defaultBucket: z.enum(ALLOWED).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyAdminToken(data.token)) throw new Error("Unauthorized");
    const urlMap = await signRefs(data.refs, data.defaultBucket ?? null);
    return { urlMap };
  });

export const qcSignMediaUrls = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        refs: refsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!verifyQcToken(data.token)) throw new Error("Unauthorized");
    const urlMap = await signRefs(data.refs, "qc-media");
    return { urlMap };
  });
