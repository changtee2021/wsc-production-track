// Office Supplies session token (free-issue, like Packing).
const KEY = "ptrack_office_token";

export function setOfficeToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
}

export function getOfficeToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function clearOfficeSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function isOfficeSession(): boolean {
  return !!getOfficeToken();
}
