const KEY = "ptrack_packing_token";

export function setPackingToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
}

export function getPackingToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function clearPackingSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function isPackingSession(): boolean {
  return !!getPackingToken();
}
