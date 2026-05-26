const KEY = "ptrack_maintenance_token";

export function setMaintenanceToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
}

export function getMaintenanceToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function clearMaintenanceSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function isMaintenanceSession(): boolean {
  return !!getMaintenanceToken();
}
