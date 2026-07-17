import type { Department } from "@/lib/staff-departments";
import {
  employeeHasDept,
  getEmployeeProfile,
  isEmployeeSession,
} from "@/lib/auth/employee-session";

/** Depts that unlock a given floor route. */
export type FloorDept = Extract<
  Department,
  "production" | "qc" | "packing" | "stock" | "warehouse"
>;

export function employeeCanAccessFloor(dept: FloorDept): boolean {
  if (!isEmployeeSession()) return false;
  const profile = getEmployeeProfile();
  return employeeHasDept(profile?.departments, dept);
}
