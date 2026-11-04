import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import {
  TRIAL_FLOWS,
  TRIAL_STAFF_SOURCES,
  flowForProductName,
  trialBadgeRoster,
  type TrialFlowId,
  type TrialStaffRow,
  type TrialStaffSource,
} from "@/lib/scan-trial";

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

const STAFF_TABLE: Record<TrialStaffSource, string> = {
  production: "employees",
  qc: "qc_employees",
  packing: "packing_employees",
  maintenance: "maintenance_employees",
  office: "office_employees",
  stock: "stock_employees",
  warehouse: "wh_employees",
  transport: "transport_employees",
};

type StaffQuery = {
  select: (columns: string) => PromiseLike<{
    data: Array<{
      id: string;
      name: string;
      emp_code: string | null;
      avatar_url?: string | null;
    }> | null;
    error: { message: string } | null;
  }>;
};

/** Public badge list for the trial app. Same people as the staff menu, including QC. */
export const listTrialStaff = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({}).parse(input ?? {}))
  .handler(async () => {
    if (!allow(clientIp(), 60)) throw new Error("โหลดรายชื่อถี่เกินไป โปรดลองใหม่");
    const groups = await Promise.all(
      TRIAL_STAFF_SOURCES.map(async (source) => {
        const columns =
          source === "warehouse" ? "id, name, emp_code" : "id, name, emp_code, avatar_url";
        const { data, error } = await (
          supabaseAdmin.from(STAFF_TABLE[source] as never) as unknown as StaffQuery
        ).select(columns);
        if (error) throw new Error("โหลดรายชื่อไม่สำเร็จ");
        return (data ?? []).map((row): TrialStaffRow => ({
          id: row.id,
          name: row.name,
          emp_code: row.emp_code,
          avatar_url: row.avatar_url ?? null,
          source,
        }));
      }),
    );
    return { rows: trialBadgeRoster(groups.flat()) };
  });

/** Live QC or packing checklist for a trial product. Does not write a report. */
export const listTrialChecklist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ flow: productSchema, kind: z.enum(["qc", "packing"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!allow(clientIp(), 60)) throw new Error("โหลดรายการตรวจถี่เกินไป โปรดลองใหม่");
    const { data: categories, error } = await supabaseAdmin
      .from("categories")
      .select("id, name")
      .eq("active", true);
    if (error) throw new Error("โหลดรายการตรวจไม่สำเร็จ");
    const matched = (categories ?? []).filter(
      (row) => flowForProductName(row.name)?.id === data.flow,
    );
    if (!matched.length) return { categoryName: null as string | null, items: [] };

    const table = data.kind === "qc" ? "qc_checklists" : "packing_checklists";
    const { data: rows, error: itemError } = await supabaseAdmin
      .from(table)
      .select("id, category_id, item_text, item_order")
      .in(
        "category_id",
        matched.map((row) => row.id),
      )
      .eq("is_active", true);
    if (itemError) throw new Error("โหลดรายการตรวจไม่สำเร็จ");

    const byCategory = new Map<string, { id: string; item_text: string; item_order: number }[]>();
    for (const row of rows ?? []) {
      const list = byCategory.get(row.category_id) ?? [];
      list.push({ id: row.id, item_text: row.item_text, item_order: row.item_order });
      byCategory.set(row.category_id, list);
    }
    const label = TRIAL_FLOWS.find((flow) => flow.id === data.flow)?.label ?? "";
    const chosen = [...matched].sort((a, b) => {
      const score = (name: string, id: string) => {
        const body = name.replace(/^\d+\.\s*/, "");
        return (body.startsWith(label) ? 1000 : 0) + (byCategory.get(id)?.length ?? 0);
      };
      return score(b.name, b.id) - score(a.name, a.id);
    })[0];
    const items = [...(byCategory.get(chosen.id) ?? [])].sort(
      (a, b) => a.item_order - b.item_order,
    );
    return { categoryName: chosen.name, items };
  });

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

type CodeQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => PromiseLike<{
      data: Array<{ name: string; emp_code: string | null }> | null;
      error: { message: string } | null;
    }>;
  };
};

/** Office edits and deletes must name a real badge, same roster as scan v2. */
async function findTrialEmployee(code: string): Promise<{ name: string; emp_code: string } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  for (const source of TRIAL_STAFF_SOURCES) {
    const { data, error } = await (
      supabaseAdmin.from(STAFF_TABLE[source] as never) as unknown as CodeQuery
    )
      .select("id, name, emp_code")
      .eq("emp_code", trimmed);
    if (error) throw new Error("ตรวจรหัสพนักงานไม่สำเร็จ");
    const row = (data ?? []).find((item) => (item.emp_code ?? "").trim() === trimmed);
    if (row?.name) return { name: row.name, emp_code: trimmed };
  }
  return null;
}

async function requireTrialEmployee(code: string): Promise<{ name: string; emp_code: string }> {
  const person = await findTrialEmployee(code);
  if (!person) throw new Error("ไม่พบรหัสพนักงานนี้");
  return person;
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

const empCodeSchema = z.string().trim().min(1).max(40);
const reasonSchema = z.string().trim().min(1, "ใส่สาเหตุก่อน").max(500);

export const adminLookupTrialEmployee = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminToken.extend({ empCode: empCodeSchema }).parse(input))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    return requireTrialEmployee(data.empCode);
  });

export const adminUpdateTrialRelease = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    adminToken
      .extend({
        jobId: jobIdSchema,
        product: productSchema,
        empCode: empCodeSchema,
        reason: reasonSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const editor = await requireTrialEmployee(data.empCode);
    if (!data.reason.trim()) throw new Error("ใส่สาเหตุก่อน");
    const { error } = await supabaseAdmin
      .from("scan_trial_releases")
      .update({ product: data.product, updated_at: new Date().toISOString() })
      .eq("job_id", data.jobId);
    if (error) throw new Error("แก้สินค้าไม่สำเร็จ");
    return { ok: true as const, editorName: editor.name };
  });

export const adminDeleteTrialRelease = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    adminToken
      .extend({ jobId: jobIdSchema, empCode: empCodeSchema, reason: reasonSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    if (!data.reason.trim()) throw new Error("ใส่สาเหตุก่อน");
    await requireTrialEmployee(data.empCode);
    const { error: runsError } = await runsTable().delete().eq("job_id", data.jobId);
    if (runsError) throw new Error("ลบขั้นตอนไม่สำเร็จ");
    const { error } = await supabaseAdmin
      .from("scan_trial_releases")
      .delete()
      .eq("job_id", data.jobId);
    if (error) throw new Error("ลบงานไม่สำเร็จ");
    return { ok: true as const };
  });

const runRowSchema = z.object({
  jobId: jobIdSchema,
  flow: productSchema,
  step: z.string().trim().min(1).max(80),
  employeeId: z.string().trim().min(1).max(80),
  employeeName: z.string().trim().min(1).max(120),
  status: z.enum(["running", "done"]),
  startedAt: z.number().int().positive(),
  finishedAt: z.number().int().positive().nullable(),
});

type TrialRunDb = {
  job_id: string;
  flow: TrialFlowId;
  step: string;
  employee_id: string;
  employee_name: string;
  status: "running" | "done";
  started_at: string;
  finished_at: string | null;
};

type RunQuery = {
  upsert: (
    row: Record<string, string | null>,
    options: { onConflict: string },
  ) => PromiseLike<{ error: { message: string } | null }>;
  delete: () => {
    eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
  };
  select: (columns: string) => {
    eq: (column: string, value: string) => PromiseLike<{
      data: TrialRunDb[] | null;
      error: { message: string } | null;
    }>;
    in: (
      column: string,
      values: string[],
    ) => PromiseLike<{
      data: TrialRunDb[] | null;
      error: { message: string } | null;
    }>;
  };
};

function runsTable(): RunQuery {
  return supabaseAdmin.from("scan_trial_runs" as never) as unknown as RunQuery;
}

function toClientRun(row: TrialRunDb) {
  return {
    jobId: row.job_id,
    flow: row.flow,
    step: row.step,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    status: row.status,
    startedAt: new Date(row.started_at).getTime(),
    finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : null,
  };
}

/** Floor phones publish one step so the office list can follow it live. */
export const saveTrialRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runRowSchema.parse(input))
  .handler(async ({ data }) => {
    if (!allow(clientIp(), 120)) throw new Error("บันทึกขั้นถี่เกินไป โปรดลองใหม่");
    const { error } = await runsTable().upsert(
      {
        job_id: data.jobId,
        flow: data.flow,
        step: data.step,
        employee_id: data.employeeId,
        employee_name: data.employeeName,
        status: data.status,
        started_at: new Date(data.startedAt).toISOString(),
        finished_at: data.finishedAt ? new Date(data.finishedAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job_id,step" },
    );
    if (error) throw new Error("บันทึกขั้นตอนไม่สำเร็จ");
    return { ok: true as const };
  });

export const listTrialJobRuns = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ jobId: jobIdSchema }).parse(input))
  .handler(async ({ data }) => {
    if (!allow(clientIp(), 180)) throw new Error("โหลดขั้นตอนถี่เกินไป โปรดลองใหม่");
    const { data: rows, error } = await runsTable()
      .select(
        "job_id, flow, step, employee_id, employee_name, status, started_at, finished_at",
      )
      .eq("job_id", data.jobId);
    if (error) throw new Error("โหลดขั้นตอนไม่สำเร็จ");
    return { runs: (rows ?? []).map(toClientRun) };
  });

export const adminListTrialRuns = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    adminToken.extend({ jobIds: z.array(jobIdSchema).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    if (!data.jobIds.length) return { runs: [] as ReturnType<typeof toClientRun>[] };
    const { data: rows, error } = await runsTable()
      .select(
        "job_id, flow, step, employee_id, employee_name, status, started_at, finished_at",
      )
      .in("job_id", data.jobIds);
    if (error) throw new Error("โหลดความคืบหน้าไม่สำเร็จ");
    return { runs: (rows ?? []).map(toClientRun) };
  });
