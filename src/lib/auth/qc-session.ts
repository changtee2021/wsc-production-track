import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_qc_token");
const EMP_KEY = "ptrack_qc_employee";

export type QcSessionEmployee = {
  id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
};

export const setQcToken = s.setToken;
export const getQcToken = s.getToken;
export const isQcSession = s.isSession;

export function setQcEmployee(employee: QcSessionEmployee) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(EMP_KEY, JSON.stringify(employee));
}

export function getQcEmployee(): QcSessionEmployee | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EMP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QcSessionEmployee;
    if (!parsed?.id || typeof parsed.name !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearQcSession() {
  s.clearSession();
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(EMP_KEY);
}
