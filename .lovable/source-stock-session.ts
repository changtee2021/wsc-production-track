import { getCompany, type Company } from "./tenant";
const KEY = "ptrack_stock_token";
const KEY_CO = "ptrack_stock_company";

export function setStockToken(token: string, company: Company = getCompany()) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
  sessionStorage.setItem(KEY_CO, company);
}
export function getStockToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}
export function clearStockSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY_CO);
}
export function isStockSession(): boolean {
  return !!getStockToken();
}
