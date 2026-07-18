// Unified staff directory across 8 department tables:
//   employees, qc_employees, packing_employees, maintenance_employees, office_employees,
//   stock_employees, wh_employees, transport_employees.
// Rows are grouped by (name + emp_code) — same person can belong to several departments.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

import { hrFloorStaffUrl } from "@/lib/hr-app-url";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

function rejectStaffWrites() {
  throw new Error(`จัดการพนักงานย้ายไป HR: ${hrFloorStaffUrl("WSC")}`);
}

const tokenStr = z.string().min(1);

export const DEPARTMENTS = [
  "production",
  "qc",
  "packing",
  "maintenance",
  "office",
  "stock",
  "warehouse",
  "transport",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

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

type Row = {
  id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  active: boolean;
  nationality?: string | null;
};

type StaffEntry = {
  key: string; // `${name}|${emp_code ?? ""}`
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  nationality: string | null;
  departments: Department[];
  ids: Partial<Record<Department, string>>;
  active: Partial<Record<Department, boolean>>;
};

async function fetchDept(dept: Department): Promise<Row[]> {
  const table = DEPT_TABLE[dept];
  const select =
    dept === "production"
      ? "id, name, emp_code, avatar_url, active, nationality"
      : dept === "warehouse"
        ? "id, name, emp_code, active"
        : "id, name, emp_code, avatar_url, active";
  // Cast for tables not yet present in generated types.
  const { data, error } = await (
    supabaseAdmin.from(table as never) as unknown as {
      select: (s: string) => {
        order: (c: string) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
      };
    }
  )
    .select(select)
    .order("name");
  if (error) throw new Error(`${dept}: ${error.message}`);
  return data ?? [];
}

export const adminListAllStaff = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenStr }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const [prod, qc, pack, maint, office, stock, warehouse, transport] = await Promise.all([
      fetchDept("production"),
      fetchDept("qc"),
      fetchDept("packing"),
      fetchDept("maintenance"),
      fetchDept("office"),
      fetchDept("stock"),
      fetchDept("warehouse"),
      fetchDept("transport"),
    ]);

    const map = new Map<string, StaffEntry>();
    const ingest = (rows: Row[], dept: Department) => {
      for (const r of rows) {
        const key = `${r.name.trim()}|${(r.emp_code ?? "").trim()}`;
        let e = map.get(key);
        if (!e) {
          e = {
            key,
            name: r.name,
            emp_code: r.emp_code,
            avatar_url: r.avatar_url,
            nationality: r.nationality ?? null,
            departments: [],
            ids: {},
            active: {},
          };
          map.set(key, e);
        }
        if (!e.avatar_url && r.avatar_url) e.avatar_url = r.avatar_url;
        if (!e.nationality && r.nationality) e.nationality = r.nationality;
        if (!e.departments.includes(dept)) e.departments.push(dept);
        e.ids[dept] = r.id;
        e.active[dept] = r.active;
      }
    };
    ingest(prod, "production");
    ingest(qc, "qc");
    ingest(pack, "packing");
    ingest(maint, "maintenance");
    ingest(office, "office");
    ingest(stock, "stock");
    ingest(warehouse, "warehouse");
    ingest(transport, "transport");

    const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "th"));
    return { rows };
  });

const deptEnum = z.enum(DEPARTMENTS);

export const adminToggleStaffDepartment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        name: z.string().trim().min(1).max(100),
        emp_code: z.string().trim().max(50).nullable().optional(),
        avatar_url: z.string().url().max(2000).nullable().optional(),
        nationality: z.string().trim().max(50).nullable().optional(),
        department: deptEnum,
        enabled: z.boolean(),
        existingId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    rejectStaffWrites();
  });

export const adminUpdateStaffMeta = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        // Pairs of (department, id) to update with the new meta
        targets: z
          .array(z.object({ department: deptEnum, id: z.string().uuid() }))
          .min(1)
          .max(10),
        name: z.string().trim().min(1).max(100),
        emp_code: z.string().trim().max(50).nullable().optional(),
        avatar_url: z.string().url().max(2000).nullable().optional(),
        nationality: z.string().trim().max(50).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    rejectStaffWrites();
  });
