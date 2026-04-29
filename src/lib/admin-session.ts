const KEY = "ptrack_admin_session";

export function setAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, "1");
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function isAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}
