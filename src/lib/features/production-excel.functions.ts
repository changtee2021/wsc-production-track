// Excel-like pivoted production history + Google Sheets sync (via connector gateway)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

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
    arr.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
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
              (new Date(l.created_at).getTime() -
                new Date(pendingStart.created_at).getTime()) /
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

    const pairs = pairLogs((logsRes.data ?? []) as LogRow[]).filter(
      (p) => !data.category_id || p.category_id === data.category_id,
    );

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
        jobCat.set(p.job_id, p.category_id ? catName.get(p.category_id) ?? null : null);
      }
    }

    const jobs: ExcelJob[] = [];
    for (const [job_id, steps] of byJob) {
      steps.sort(
        (a, b) =>
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
      );
      jobs.push({
        job_id,
        category_name: jobCat.get(job_id) ?? null,
        started_at: steps[0]?.started_at ?? "",
        finished_at: steps[steps.length - 1]?.finished_at ?? "",
        step_count: steps.length,
        steps,
      });
    }
    jobs.sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );

    const max_steps = jobs.reduce((m, j) => Math.max(m, j.steps.length), 0);

    return {
      jobs,
      max_steps,
      categories: catsRes.data ?? [],
      range: { start: startISO, end: endISO },
    };
  });

// -------- Google Sheets sync via Connector Gateway --------

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_sheets/v4";

async function sheetsFetch(
  path: string,
  init: RequestInit & { body?: string } = {},
) {
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
    throw new Error(`Google Sheets API ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
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

    if (data.mode === "replace") {
      // Clear entire sheet first
      await sheetsFetch(
        `/spreadsheets/${data.spreadsheet_id}/values/${encodeURIComponent(sheet)}:clear`,
        { method: "POST", body: JSON.stringify({}) },
      );
      // Write headers + rows starting at A1
      await sheetsFetch(
        `/spreadsheets/${data.spreadsheet_id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
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
      // Append: include header row only if sheet is empty
      const probe = await sheetsFetch(
        `/spreadsheets/${data.spreadsheet_id}/values/${encodeURIComponent(sheet + "!A1:A1")}`,
      ).catch(() => null as { values?: unknown[][] } | null);
      const isEmpty = !probe || !probe.values || probe.values.length === 0;
      const values = isEmpty ? [data.headers, ...data.rows] : data.rows;
      await sheetsFetch(
        `/spreadsheets/${data.spreadsheet_id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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
