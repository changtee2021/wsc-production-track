import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import type { TrialFlowId } from "@/lib/scan-trial";

const productSchema = z.enum(["roller", "wood", "aluminum", "shade"]);
const jobIdSchema = z.string().trim().min(1).max(80);

const buckets = new Map<string, number[]>();

function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    (getRequestHeader("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function allow(ip: string, limit: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((at) => at > now - 60_000);
  if (recent.length >= limit) {
    buckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  buckets.set(ip, recent);
  return true;
}

export const lookupTrialRelease = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ jobId: jobIdSchema }).parse(input))
  .handler(async ({ data }) => {
    if (!allow(clientIp(), 180)) throw new Error("ตรวจรหัสงานถี่เกินไป โปรดลองใหม่");
    const { data: row, error } = await supabaseAdmin
      .from("scan_trial_releases")
      .select("product")
      .eq("job_id", data.jobId)
      .maybeSingle();
    if (error) throw new Error("ตรวจรหัสงานไม่สำเร็จ");
    const product = productSchema.safeParse(row?.product);
    return { product: product.success ? (product.data as TrialFlowId) : null };
  });

export const releaseTrialJobs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        jobs: z
          .array(z.object({ jobId: jobIdSchema, product: productSchema }))
          .min(1)
          .max(200),
        sentByName: z.string().trim().max(120).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!allow(clientIp(), 40)) throw new Error("ส่งถี่เกินไป โปรดลองใหม่");
    const now = new Date().toISOString();
    const rows = data.jobs.map((job) => ({
      job_id: job.jobId,
      product: job.product,
      sent_by_name: data.sentByName,
      updated_at: now,
    }));
    const { error } = await supabaseAdmin
      .from("scan_trial_releases")
      .upsert(rows, { onConflict: "job_id" });
    if (error) throw new Error("ส่งเข้าไลน์ผลิตไม่สำเร็จ");
    return { ok: true as const, sentAt: now };
  });

export const withdrawTrialJobs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ jobIds: z.array(jobIdSchema).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!allow(clientIp(), 40)) throw new Error("แก้ไขถี่เกินไป โปรดลองใหม่");
    const { error } = await supabaseAdmin
      .from("scan_trial_releases")
      .delete()
      .in("job_id", data.jobIds);
    if (error) throw new Error("ถอนงานออกจากไลน์ผลิตไม่สำเร็จ");
    return { ok: true as const };
  });

function assertAdmin(token: string) {
  if (!verifyAdminToken(token)) throw new Error("ไม่มีสิทธิ์แอดมิน");
}

const adminToken = z.object({ token: z.string().min(1) });

export const adminListTrialReleases = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminToken.parse(input))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("scan_trial_releases")
      .select("job_id, product, sent_by_name, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("โหลดรายการไม่สำเร็จ");
    return { rows: rows ?? [] };
  });

export const adminUpdateTrialRelease = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    adminToken.extend({ jobId: jobIdSchema, product: productSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("scan_trial_releases")
      .update({ product: data.product, updated_at: new Date().toISOString() })
      .eq("job_id", data.jobId);
    if (error) throw new Error("แก้สินค้าไม่สำเร็จ");
    return { ok: true as const };
  });

export const adminDeleteTrialRelease = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminToken.extend({ jobId: jobIdSchema }).parse(input))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("scan_trial_releases")
      .delete()
      .eq("job_id", data.jobId);
    if (error) throw new Error("ลบงานไม่สำเร็จ");
    return { ok: true as const };
  });
