// Expense scanner session HMAC token — thin wrapper around the dept-token factory,
// plus an employee-bound "mine token" used by /expense-mine so a kiosk session
// can only read its own employee's expense history (mitigates IDOR).
import { createHmac, timingSafeEqual } from "crypto";
import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const expense = createDeptTokenVerifier({
  prefix: "exp:",
  secretEnv: ["ADMIN_PASSWORD", "PACKING_PASSWORD"],
  label: "Expense",
});

export const issueExpenseToken = expense.issue;
export const verifyExpenseToken = expense.verify;

// ----- employee-bound mine token -----
// Format: `mine.${expiresAtMs}.${employee_id}.${sig}`
//   sig = HMAC-SHA256("exp-mine:" + exp + "|" + employee_id, secret)
const MINE_TTL_MS = 1000 * 60 * 60 * 12; // 12h
function mineSecret(): string {
  const v = process.env.ADMIN_PASSWORD || process.env.PACKING_PASSWORD || "";
  if (!v || v.length < 6) throw new Error("Expense signing secret is not configured");
  return v;
}
function mineSign(exp: string, empId: string): string {
  return createHmac("sha256", mineSecret()).update(`exp-mine:${exp}|${empId}`).digest("hex");
}
export function issueExpenseMineToken(employeeId: string): string {
  const exp = String(Date.now() + MINE_TTL_MS);
  return `mine.${exp}.${employeeId}.${mineSign(exp, employeeId)}`;
}
/** Returns employee_id if the token is a valid (unexpired) mine-token, else null. */
export function verifyExpenseMineToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string" || !token.startsWith("mine.")) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [, expStr, empId, sig] = parts;
  const expected = mineSign(expStr, empId);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() >= exp) return null;
  return empId;
}
