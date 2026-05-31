// Expense session token (free-issue, sessionStorage).
const KEY = "ptrack_expense_token";

export function setExpenseToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, token);
}
export function getExpenseToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}
export function clearExpenseSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
export function isExpenseSession(): boolean {
  return !!getExpenseToken();
}
