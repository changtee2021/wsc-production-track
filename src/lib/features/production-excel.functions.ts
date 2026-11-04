// Excel-like pivoted production history + Google Sheets sync (via connector gateway)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";
import { flowForProductName, trialProductLabel } from "@/lib/scan-trial";
import {
  LINE_RELEASE_STEP_NAME,
  compareExcelSteps,
  lineReleaseStep,
  trialRunStep,
} from "@/lib/utils/production-excel-steps";

export { LINE_RELEASE_STEP_NAME };

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

type LogRow = {
  id: string;
  job_id: string;
  employee_id: string | null;
  step_id: string;
  category_id: string | null;
  action: "start" | "finish";
  created_at: string;
};

function pairLogs(logs: LogRow[]) {
  const byKey = new Map<string, LogRow[]>();
  for (const l of logs) {
    const k = `${l.job_id}|${l.step_id}|${l.employee_id ?? ""}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(l);
  }
  const pairs: {
    job_id: string;
    employee_id: string | null;
    step_id: string;
    category_id: string | null;
    started_at: string;
    finished_at: string;
    actual_seconds: number;
  }[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let pendingStart: LogRow | null = null;
    for (const l of arr) {
      if (l.action === "start") pendingStart = l;
      else if (l.action === "finish" && pendingStart) {
        pairs.push({
          job_id: l.job_id,
          employee_id: l.employee_id,
          step_id: l.step_id,
          category_id: l.category_id ?? pendingStart.category_id,
          started_at: pendingStart.created_at,
          finished_at: l.created_at,
          actual_seconds: Math.max(
            1,
            Math.round(
              (new Date(l.created_at).getTime() - new Date(pendingStart.created_at).getTime()) /
                1000,
            ),
          ),
        });
        pendingStart = null;
      }
    }
  }
  return pairs;
}

export type ExcelStep = {
  step_name: string;
  employee_name: string;
  emp_code: string | null;
  started_at: string;
  finished_at: string;
  actual_seconds: number;
};

export type ExcelJob = {
  job_id: string;
  category_name: string | null;
  started_at: string;
  finished_at: string;
  step_count: number;
  steps: ExcelStep[];
};

const tokenStr = z.string().min(1);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const adminGetProductionExcel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        start: dateStr,
        end: dateStr,
        category_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const startISO = `${data.start}T00:00:00.000Z`;
    const endISO = `${data.end}T23:59:59.999Z`;

    const [logsRes, stepsRes, catsRes, empsRes] = await Promise.all([
      supabaseAdmin
        .from("production_logs")
        .select("id, job_id, employee_id, step_id, category_id, action, created_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("steps").select("id, step_name"),
      supabaseAdmin.from("categories").select("id, name").order("name"),
      supabaseAdmin.from("employees").select("id, name, emp_code"),
    ]);
    if (logsRes.error) throw new Error(logsRes.error.message);

    const stepName = new Map((stepsRes.data ?? []).map((s) => [s.id, s.step_name]));
    const catName = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]));
    const empMap = new Map((empsRes.data ?? []).map((e) => [e.id, e]));

    const [releasesInRange, runsStarted, runsFinished] = await Promise.all([
      supabaseAdmin
        .from("scan_trial_releases")
        .select("job_id, product, sent_by_name, created_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO),
      trialRunsBetween("started_at", startISO, endISO),
      trialRunsBetween("finished_at", startISO, endISO),
    ]);
    if (releasesInRange.error) throw new Error(releasesInRange.error.message);

    const pairs = pairLogs((logsRes.data ?? []) as LogRow[]).filter(
      (p) => !data.category_id || p.category_id === data.category_id,
    );

    const runs = dedupeRuns([...(runsStarted ?? []), ...(runsFinished ?? [])]);
    const releaseByJob = new Map(
      (releasesInRange.data ?? []).map((row) => [row.job_id, row]),
    );
    const extraJobIds = [
      ...new Set([
        ...pairs.map((p) => p.job_id),
        ...runs.map((run) => run.job_id),
      ]),
    ].filter((jobId) => !releaseByJob.has(jobId));
    for (const row of await releasesForJobs(extraJobIds)) releaseByJob.set(row.job_id, row);

    // group by job_id
    const byJob = new Map<string, ExcelStep[]>();
    const jobCat = new Map<string, string | null>();
    for (const p of pairs) {
      const emp = p.employee_id ? empMap.get(p.employee_id) : null;
      const step: ExcelStep = {
        step_name: stepName.get(p.step_id) ?? "—",
        employee_name: emp?.name ?? "—",
        emp_code: emp?.emp_code ?? null,
        started_at: p.started_at,
        finished_at: p.finished_at,
        actual_seconds: p.actual_seconds,
      };
      if (!byJob.has(p.job_id)) byJob.set(p.job_id, []);
      byJob.get(p.job_id)!.push(step);
      if (!jobCat.has(p.job_id)) {
        jobCat.set(p.job_id, p.category_id ? (catName.get(p.category_id) ?? null) : null);
      }
    }

    const selectedCategory = data.category_id ? (catName.get(data.category_id) ?? null) : null;
    for (const [jobId, release] of releaseByJob) {
      const matches =
        !data.category_id ||
        byJob.has(jobId) ||
        (selectedCategory != null && flowForProductName(selectedCategory)?.id === release.product);
      if (!matches) continue;
      pushExcelStep(byJob, jobId, lineReleaseStep(release.sent_by_name, release.created_at));
      if (!jobCat.has(jobId)) jobCat.set(jobId, trialProductLabel(release.product));
    }
    for (const run of runs) {
      const release = releaseByJob.get(run.job_id);
      const matches =
        !data.category_id ||
        byJob.has(run.job_id) ||
        (selectedCategory != null &&
          (release
            ? flowForProductName(selectedCategory)?.id === release.product
            : flowForProductName(selectedCategory)?.id === run.flow));
      if (!matches) continue;
      const emp = empMap.get(run.employee_id);
      pushExcelStep(byJob, run.job_id, trialRunStep(run, emp?.emp_code ?? null));
      if (!jobCat.has(run.job_id)) {
        jobCat.set(run.job_id, release ? trialProductLabel(release.product) : trialProductLabel(run.flow));
      }
    }

    const jobs: ExcelJob[] = [];
    for (const [job_id, steps] of byJob) {
      steps.sort(compareExcelSteps);
      jobs.push({
        job_id,
        category_name: jobCat.get(job_id) ?? null,
        started_at: steps[0]?.started_at ?? "",
        finished_at: steps[steps.length - 1]?.finished_at ?? "",
        step_count: steps.length,
        steps,
      });
    }
    jobs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    const max_steps = jobs.reduce((m, j) => Math.max(m, j.steps.length), 0);

    return {
      jobs,
      max_steps,
      categories: catsRes.data ?? [],
      range: { start: startISO, end: endISO },
    };
  });

type TrialRunRow = {
  job_id: string;
  flow: string;
  step: string;
  employee_id: string;
  employee_name: string;
  status: "running" | "done";
  started_at: string;
  finished_at: string | null;
};

type TrialRunQuery = {
  select: (columns: string) => {
    gte: (
      column: string,
      value: string,
    ) => {
      lte: (
        column: string,
        value: string,
      ) => PromiseLike<{ data: TrialRunRow[] | null; error: { message: string } | null }>;
    };
  };
};

function trialRunsTable(): TrialRunQuery {
  return supabaseAdmin.from("scan_trial_runs" as never) as unknown as TrialRunQuery;
}

async function trialRunsBetween(column: "started_at" | "finished_at", startISO: string, endISO: string) {
  const { data, error } = await trialRunsTable()
    .select("job_id, flow, step, employee_id, employee_name, status, started_at, finished_at")
    .gte(column, startISO)
    .lte(column, endISO);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function dedupeRuns(rows: TrialRunRow[]): TrialRunRow[] {
  const byKey = new Map<string, TrialRunRow>();
  for (const row of rows) byKey.set(`${row.job_id}|${row.step}`, row);
  return [...byKey.values()];
}

async function releasesForJobs(jobIds: string[]) {
  const out: {
    job_id: string;
    product: string;
    sent_by_name: string | null;
    created_at: string;
  }[] = [];
  for (let i = 0; i < jobIds.length; i += 150) {
    const slice = jobIds.slice(i, i + 150);
    const { data, error } = await supabaseAdmin
      .from("scan_trial_releases")
      .select("job_id, product, sent_by_name, created_at")
      .in("job_id", slice);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

function pushExcelStep(byJob: Map<string, ExcelStep[]>, jobId: string, step: ExcelStep) {
  if (!byJob.has(jobId)) byJob.set(jobId, []);
  const steps = byJob.get(jobId)!;
  const duplicate = steps.some(
    (row) => row.step_name === step.step_name && row.started_at === step.started_at,
  );
  if (!duplicate) steps.push(step);
}

// -------- Google Sheets sync via Connector Gateway --------

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_sheets/v4";

async function sheetsFetch(path: string, init: RequestInit & { body?: string } = {}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error(
      "ยังไม่ได้เชื่อม Google Sheets — กรุณาเชื่อม Google Sheets Connector ในโปรเจกต์ก่อน",
    );
  }
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Google Sheets API ${res.status}: ${text.slice(0, 400)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

// Ensure a sheet tab exists; create it if missing.
async function ensureSheetExists(spreadsheetId: string, sheetName: string) {
  try {
    const meta = (await sheetsFetch(
      `/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`,
    )) as { sheets?: { properties?: { title?: string } }[] };
    const exists = meta.sheets?.some((s) => s.properties?.title === sheetName);
    if (exists) return;
    await sheetsFetch(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) {
      throw new Error(
        "ไม่พบ Spreadsheet — ตรวจสอบ Spreadsheet ID และตรวจว่าบัญชี Google ที่เชื่อมต่อมีสิทธิ์เข้าถึงไฟล์นี้",
      );
    }
    throw e;
  }
}

export const adminSyncProductionExcelToSheets = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        spreadsheet_id: z.string().min(10).max(200),
        sheet_name: z.string().min(1).max(100).default("Sheet1"),
        mode: z.enum(["append", "replace"]).default("append"),
        headers: z.array(z.string()).min(1).max(500),
        rows: z.array(z.array(z.string())).min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const sheet = data.sheet_name;
    const range = `${sheet}!A1`;

    await ensureSheetExists(data.spreadsheet_id, sheet);

    if (data.mode === "replace") {
      await sheetsFetch(`/spreadsheets/${data.spreadsheet_id}/values/${sheet}:clear`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await sheetsFetch(
        `/spreadsheets/${data.spreadsheet_id}/values/${range}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          body: JSON.stringify({
            range,
            majorDimension: "ROWS",
            values: [data.headers, ...data.rows],
          }),
        },
      );
    } else {
      const probe = (await sheetsFetch(
        `/spreadsheets/${data.spreadsheet_id}/values/${sheet}!A1:A1`,
      ).catch(() => null)) as { values?: unknown[][] } | null;
      const isEmpty = !probe || !probe.values || probe.values.length === 0;
      const values = isEmpty ? [data.headers, ...data.rows] : data.rows;
      await sheetsFetch(
        `/spreadsheets/${data.spreadsheet_id}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          body: JSON.stringify({
            range,
            majorDimension: "ROWS",
            values,
          }),
        },
      );
    }

    return { ok: true, written: data.rows.length };
  });
