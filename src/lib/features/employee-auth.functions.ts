// Employee floor login: emp_code + shared password → session + dept tokens.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  checkEmployeePassword,
  issueEmployeeToken,
  verifyEmployeeToken,
} from "@/lib/auth/employee-token.server";
import { issueQcToken } from "@/lib/auth/qc-token.server";
import { issuePackingToken } from "@/lib/auth/packing-token.server";
import { issueWarehouseToken } from "@/lib/auth/warehouse-token.server";
import { issueStockToken } from "@/lib/auth/stock-token.server";
import { DEPARTMENTS, type Department } from "@/lib/staff-departments";
import { loadEmployeeAggregateProfile } from "@/lib/features/employee-profile.functions";

const DEPT_TABLE: Record<Department, string> = {
  production: "employees",
  qc: "qc_employees",
  packing: "packing_employees",
  maintenance: "maintenance_employees",
  office: "office_employees",
  stock: "stock_employees",
  warehouse: "wh_employees",
  transport: "transport_employees",
};

type FoundRow = {
  dept: Department;
  id: string;
  name: string;
  emp_code: string;
  active: boolean;
};

async function resolveStaffByEmpCode(empCode: string): Promise<{
  name: string;
  emp_code: string;
  departments: Department[];
  ids: Partial<Record<Department, string>>;
} | null> {
  const code = empCode.trim();
  if (!code) return null;

  const found: FoundRow[] = [];
  await Promise.all(
    DEPARTMENTS.map(async (dept) => {
      const table = DEPT_TABLE[dept];
      // warehouse select historically omits avatar; all tables we care about have active except some legacy.
      const cols =
        dept === "warehouse" ? "id, name, emp_code, active" : "id, name, emp_code, active";
      const { data, error } = await (
        supabaseAdmin.from(table as never) as unknown as {
          select: (s: string) => {
            eq: (
              a: string,
              b: string,
            ) => Promise<{
              data: Record<string, unknown>[] | null;
              error: { message: string } | null;
            }>;
          };
        }
      )
        .select(cols)
        .eq("emp_code", code);
      if (error) {
        // Retry without active if column missing on a table
        if (/active/i.test(error.message)) {
          const retry = await (
            supabaseAdmin.from(table as never) as unknown as {
              select: (s: string) => {
                eq: (
                  a: string,
                  b: string,
                ) => Promise<{
                  data: Record<string, unknown>[] | null;
                  error: { message: string } | null;
                }>;
              };
            }
          )
            .select("id, name, emp_code")
            .eq("emp_code", code);
          if (retry.error) throw new Error(`${dept}: ${retry.error.message}`);
          for (const row of retry.data ?? []) {
            found.push({
              dept,
              id: String(row.id),
              name: String(row.name ?? ""),
              emp_code: code,
              active: true,
            });
          }
          return;
        }
        throw new Error(`${dept}: ${error.message}`);
      }
      for (const row of data ?? []) {
        if (row.active === false) continue;
        found.push({
          dept,
          id: String(row.id),
          name: String(row.name ?? ""),
          emp_code: code,
          active: true,
        });
      }
    }),
  );

  if (found.length === 0) return null;

  // Prefer production name if present, else first match.
  const primary = found.find((f) => f.dept === "production") ?? found[0];
  const departments: Department[] = [];
  const ids: Partial<Record<Department, string>> = {};
  for (const f of found) {
    if (!departments.includes(f.dept)) departments.push(f.dept);
    ids[f.dept] = f.id;
  }

  // Align with staff-directory grouping: same emp_code may have slight name drift — use primary.
  return {
    name: primary.name,
    emp_code: code,
    departments,
    ids,
  };
}

function issueDeptTokensFor(departments: Department[]) {
  const all = departments.includes("office");
  const tokens: {
    qc?: string;
    packing?: string;
    warehouse?: string;
    stock?: string;
  } = {};
  try {
    if (all || departments.includes("qc")) tokens.qc = issueQcToken();
  } catch {
    /* secret missing in local — ignore */
  }
  try {
    if (all || departments.includes("packing")) tokens.packing = issuePackingToken();
  } catch {
    /* ignore */
  }
  try {
    if (all || departments.includes("warehouse")) tokens.warehouse = issueWarehouseToken();
  } catch {
    /* ignore */
  }
  try {
    if (all || departments.includes("stock")) tokens.stock = issueStockToken();
  } catch {
    /* ignore */
  }
  return tokens;
}

export const employeeLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        empCode: z.string().trim().min(1).max(50),
        password: z.string().min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!checkEmployeePassword(data.password)) {
      throw new Error("รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง");
    }
    const staff = await resolveStaffByEmpCode(data.empCode);
    if (!staff) {
      throw new Error("รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง");
    }
    const token = issueEmployeeToken({ emp_code: staff.emp_code, name: staff.name });
    const deptTokens = issueDeptTokensFor(staff.departments);
    return {
      token,
      name: staff.name,
      emp_code: staff.emp_code,
      departments: staff.departments,
      ids: staff.ids,
      deptTokens,
    };
  });

export const employeeMe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const payload = verifyEmployeeToken(data.token);
    if (!payload) throw new Error("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    const staff = await resolveStaffByEmpCode(payload.emp_code);
    if (!staff) throw new Error("ไม่พบพนักงานในระบบ");
    // Re-issue token so shift stays warm while actively using the app
    const token = issueEmployeeToken({ emp_code: staff.emp_code, name: staff.name });
    const deptTokens = issueDeptTokensFor(staff.departments);
    return {
      token,
      name: staff.name,
      emp_code: staff.emp_code,
      departments: staff.departments,
      ids: staff.ids,
      deptTokens,
    };
  });

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const employeeGetMyProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        range: z.enum(["day", "week", "month"]).default("day"),
        anchor: dateYmd,
        from: dateYmd.nullable().optional(),
        to: dateYmd.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const payload = verifyEmployeeToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    // Always resolve by emp_code (login identity) so name drift cannot hide depts.
    const byCode = await resolveStaffByEmpCode(payload.emp_code);
    if (!byCode) throw new Error("ไม่พบพนักงาน");
    return loadEmployeeAggregateProfile({
      name: byCode.name,
      emp_code: byCode.emp_code,
      range: data.range,
      anchor: data.anchor,
      from: data.from,
      to: data.to,
    });
  });
