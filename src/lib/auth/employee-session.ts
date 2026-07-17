// Client-side employee floor session (localStorage — survives tab close for a shift).

import type { Department } from "@/lib/staff-departments";
import { clearDeptTokens } from "@/lib/auth/apply-dept-tokens";

const TOKEN_KEY = "ptrack_employee_token";
const PROFILE_KEY = "ptrack_employee_profile";

export type EmployeeSessionProfile = {
  name: string;
  emp_code: string;
  departments: Department[];
  /** UUID per department table (production → employees.id, etc.) */
  ids?: Partial<Record<Department, string>>;
};

export function setEmployeeSession(token: string, profile: EmployeeSessionProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getEmployeeToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getEmployeeProfile(): EmployeeSessionProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as EmployeeSessionProfile;
    if (!p?.emp_code || !p?.name || !Array.isArray(p.departments)) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearEmployeeSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
  clearDeptTokens();
}

export function isEmployeeSession(): boolean {
  return !!getEmployeeToken();
}

/** Office staff see every work button; others only their departments. */
export function employeeHasDept(
  departments: readonly string[] | undefined,
  dept: Department | "production" | "qc" | "packing" | "stock" | "warehouse",
): boolean {
  if (!departments?.length) return false;
  if (departments.includes("office")) return true;
  return departments.includes(dept);
}
