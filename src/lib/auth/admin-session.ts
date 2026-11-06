// Admin sessionStorage helpers — thin wrapper around createDeptSession.
import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_admin_token");
const ACTOR_KEY = "wsc:admin-actor";

export type AdminActor = { id: string; name: string; empCode: string; avatarUrl: string | null };

export const setAdminToken = s.setToken;
export const getAdminToken = s.getToken;
export const isAdminSession = s.isSession;

export function saveAdminActor(actor: AdminActor) {
  sessionStorage.setItem(ACTOR_KEY, JSON.stringify(actor));
}

export function loadAdminActor(): AdminActor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminActor;
    if (!parsed?.id || !parsed.name || !parsed.empCode) return null;
    return { ...parsed, avatarUrl: parsed.avatarUrl ?? null };
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  s.clearSession();
  if (typeof window !== "undefined") sessionStorage.removeItem(ACTOR_KEY);
}
