const KEY = "ptrack_admin_token";

export function setAdminToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function isAdminSession(): boolean {
  return !!getAdminToken();
}
