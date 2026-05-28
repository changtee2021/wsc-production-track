// Unified staff directory across 5 department tables:
//   employees (production), qc_employees, packing_employees, maintenance_employees, office_employees.
// Rows are grouped by (name + emp_code) — same person can belong to several departments.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "./admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

const tokenStr = z.string().min(1);

export const DEPARTMENTS = ["production", "qc", "packing", "maintenance", "office"] as const;
export type Department = (typeof DEPARTMENTS)[number];

const DEPT_TABLE: Record<Department, string> = {
  production: "employees",
  qc: "qc_employees",
  packing: "packing_employees",
  maintenance: "maintenance_employees",
  office: "office_employees",
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
      : "id, name, emp_code, avatar_url, active";
  // Cast for tables not yet present in generated types.
  const { data, error } = await (
    supabaseAdmin.from(table as never) as unknown as {
      select: (s: string) => { order: (c: string) => Promise<{ data: Row[] | null; error: { message: string } | null }> };
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
    const [prod, qc, pack, maint, office] = await Promise.all([
      fetchDept("production"),
      fetchDept("qc"),
      fetchDept("packing"),
      fetchDept("maintenance"),
      fetchDept("office"),
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
    const table = DEPT_TABLE[data.department];
    const tbl = supabaseAdmin.from(table as never) as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      delete: () => { eq: (a: string, b: string) => Promise<{ error: { message: string } | null }> };
    };

    if (data.enabled) {
      if (data.existingId) return { ok: true };
      const row: Record<string, unknown> = {
        name: data.name,
        emp_code: data.emp_code ?? null,
        avatar_url: data.avatar_url ?? null,
        active: true,
      };
      if (data.department === "production") {
        row.nationality = data.nationality ?? "Thai";
      }
      const { error } = await tbl.insert(row);
      if (error) throw new Error(error.message);
      return { ok: true };
    } else {
      if (!data.existingId) return { ok: true };
      const { error } = await tbl.delete().eq("id", data.existingId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
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
          .max(8),
        name: z.string().trim().min(1).max(100),
        emp_code: z.string().trim().max(50).nullable().optional(),
        avatar_url: z.string().url().max(2000).nullable().optional(),
        nationality: z.string().trim().max(50).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    for (const t of data.targets) {
      const table = DEPT_TABLE[t.department];
      const patch: Record<string, unknown> = {
        name: data.name,
        emp_code: data.emp_code ?? null,
        avatar_url: data.avatar_url ?? null,
      };
      if (t.department === "production" && data.nationality) {
        patch.nationality = data.nationality;
      }
      const tbl = supabaseAdmin.from(table as never) as unknown as {
        update: (row: Record<string, unknown>) => { eq: (a: string, b: string) => Promise<{ error: { message: string } | null }> };
      };
      const { error } = await tbl.update(patch).eq("id", t.id);
      if (error) throw new Error(`${t.department}: ${error.message}`);
    }
    return { ok: true };
  });
