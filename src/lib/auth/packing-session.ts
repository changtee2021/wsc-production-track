import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_packing_token");
const EMP_KEY = "ptrack_packing_employee";

export type PackingSessionEmployee = {
  id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
};

export const setPackingToken = s.setToken;
export const getPackingToken = s.getToken;
export const isPackingSession = s.isSession;

export function setPackingEmployee(employee: PackingSessionEmployee) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(EMP_KEY, JSON.stringify(employee));
}

export function getPackingEmployee(): PackingSessionEmployee | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EMP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PackingSessionEmployee;
    if (!parsed?.id || typeof parsed.name !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPackingSession() {
  s.clearSession();
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(EMP_KEY);
}
