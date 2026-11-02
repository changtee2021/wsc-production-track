// Unified staff directory across 8 department tables:
//   employees, qc_employees, packing_employees, maintenance_employees, office_employees,
//   stock_employees, wh_employees, transport_employees.
// Rows are grouped by (name + emp_code) — same person can belong to several departments.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyAdminToken } from "@/lib/auth/admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
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
  is_sub?: boolean | null;
};

type StaffEntry = {
  key: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  nationality: string | null;
  is_sub: boolean;
  departments: Department[];
  ids: Partial<Record<Department, string>>;
  active: Partial<Record<Department, boolean>>;
};

type EmpTable = {
  select: (s: string) => {
    order: (c: string) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
  };
  insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  update: (row: Record<string, unknown>) => {
    eq: (a: string, b: string) => Promise<{ error: { message: string } | null }>;
  };
  delete: () => {
    eq: (a: string, b: string) => Promise<{ error: { message: string } | null }>;
  };
};

function deptTbl(dept: Department): EmpTable {
  return supabaseAdmin.from(DEPT_TABLE[dept] as never) as unknown as EmpTable;
}

async function fetchDept(dept: Department): Promise<Row[]> {
  const select =
    dept === "production"
      ? "id, name, emp_code, avatar_url, active, nationality, is_sub"
      : dept === "warehouse"
        ? "id, name, emp_code, active, is_sub"
        : "id, name, emp_code, avatar_url, active, is_sub";
  const { data, error } = await deptTbl(dept).select(select).order("name");
  if (error) throw new Error(`${dept}: ${error.message}`);
  return (data ?? []).map((r) => ({
    ...r,
    avatar_url: r.avatar_url ?? null,
  }));
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
            is_sub: !!r.is_sub,
            departments: [],
            ids: {},
            active: {},
          };
          map.set(key, e);
        }
        if (!e.avatar_url && r.avatar_url) e.avatar_url = r.avatar_url;
        if (!e.nationality && r.nationality) e.nationality = r.nationality;
        if (r.is_sub) e.is_sub = true;
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

/** Accept https URLs; coerce blank/invalid legacy values to null so toggles don't 400. */
const optionalAvatarUrl = z.preprocess((v) => {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return v.slice(0, 2000);
  } catch {
    return null;
  }
}, z.string().url().max(2000).nullable());

export const adminToggleStaffDepartment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        name: z.string().trim().min(1).max(100),
        emp_code: z.string().trim().max(50).nullable().optional(),
        avatar_url: optionalAvatarUrl.optional(),
        nationality: z.string().trim().max(50).nullable().optional(),
        is_sub: z.boolean().optional(),
        department: deptEnum,
        enabled: z.boolean(),
        existingId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    const tbl = deptTbl(data.department);

    if (data.enabled) {
      if (data.existingId) return { ok: true };
      const row: Record<string, unknown> = {
        name: data.name,
        emp_code: data.emp_code ?? null,
        active: true,
        is_sub: data.is_sub ?? false,
      };
      if (data.department !== "warehouse") {
        row.avatar_url = data.avatar_url ?? null;
      }
      if (data.department === "production") {
        row.nationality = data.nationality ?? "Thai";
      }
      const { error } = await tbl.insert(row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (!data.existingId) return { ok: true };
    const { error } = await tbl.delete().eq("id", data.existingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateStaffMeta = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        targets: z
          .array(z.object({ department: deptEnum, id: z.string().uuid() }))
          .min(1)
          .max(10),
        name: z.string().trim().min(1).max(100),
        emp_code: z.string().trim().max(50).nullable().optional(),
        avatar_url: optionalAvatarUrl.optional(),
        nationality: z.string().trim().max(50).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    for (const t of data.targets) {
      const patch: Record<string, unknown> = {
        name: data.name,
        emp_code: data.emp_code ?? null,
      };
      if (t.department !== "warehouse") {
        patch.avatar_url = data.avatar_url ?? null;
      }
      if (t.department === "production" && data.nationality) {
        patch.nationality = data.nationality;
      }
      const { error } = await deptTbl(t.department).update(patch).eq("id", t.id);
      if (error) throw new Error(`${t.department}: ${error.message}`);
    }
    return { ok: true };
  });

const staffTarget = z.object({ department: deptEnum, id: z.string().uuid() });

const staffPerson = z.object({
  targets: z.array(staffTarget).min(1).max(8),
  name: z.string().trim().min(1).max(100),
  emp_code: z.string().trim().max(50).nullable().optional(),
  avatar_url: optionalAvatarUrl.optional(),
  nationality: z.string().trim().max(50).nullable().optional(),
  is_sub: z.boolean().optional(),
});

/** Remove a person from every department they belong to. Job history stays; the name link is cleared. */
export const adminDeleteStaffMany = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        people: z.array(staffPerson).min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    for (const person of data.people) {
      for (const t of person.targets) {
        const { error } = await deptTbl(t.department).delete().eq("id", t.id);
        if (error) throw new Error(`${person.name} / ${t.department}: ${error.message}`);
      }
    }
    return { ok: true, deleted: data.people.length };
  });

/** Set nationality and/or add or remove one department for many people at once. */
export const adminBulkEditStaff = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: tokenStr,
        people: z.array(staffPerson).min(1).max(100),
        nationality: z.string().trim().max(50).optional(),
        department: deptEnum.optional(),
        departmentEnabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    if (!data.nationality && !data.department) throw new Error("ไม่มีอะไรให้แก้");
    let nationalitySkipped = 0;

    for (const person of data.people) {
      const existing = data.department
        ? person.targets.find((t) => t.department === data.department)
        : undefined;
      if (data.department && data.departmentEnabled != null) {
        if (data.departmentEnabled) {
          if (!existing) {
            const row: Record<string, unknown> = {
              name: person.name,
              emp_code: person.emp_code ?? null,
              active: true,
              is_sub: person.is_sub ?? false,
            };
            if (data.department !== "warehouse") row.avatar_url = person.avatar_url ?? null;
            if (data.department === "production") {
              row.nationality = data.nationality ?? person.nationality ?? "Thai";
            }
            const { error } = await deptTbl(data.department).insert(row);
            if (error) throw new Error(`${person.name}: ${error.message}`);
          }
        } else if (existing) {
          const { error } = await deptTbl(data.department).delete().eq("id", existing.id);
          if (error) throw new Error(`${person.name}: ${error.message}`);
        }
      }

      if (!data.nationality) continue;
      const production = person.targets.find((t) => t.department === "production");
      const addedProduction =
        data.department === "production" && data.departmentEnabled === true && !production;
      const removedProduction =
        data.department === "production" && data.departmentEnabled === false && !!production;
      if (addedProduction || removedProduction) continue;
      if (!production) {
        nationalitySkipped += 1;
        continue;
      }
      const { error } = await deptTbl("production")
        .update({ nationality: data.nationality })
        .eq("id", production.id);
      if (error) throw new Error(`${person.name}: ${error.message}`);
    }

    return { ok: true, nationalitySkipped };
  });
