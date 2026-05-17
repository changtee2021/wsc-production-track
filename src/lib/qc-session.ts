const KEY = "ptrack_qc_token";

export function setQcToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
}

export function getQcToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function clearQcSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function isQcSession(): boolean {
  return !!getQcToken();
}
