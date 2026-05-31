// Server-only token helpers for expense scanner (HMAC signed, 12h TTL).
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 1000 * 60 * 60 * 12;

function secret(): string {
  const s = process.env.ADMIN_PASSWORD || process.env.PACKING_PASSWORD;
  if (!s || s.length < 6) throw new Error("Expense signing secret is not configured");
  return s;
}
function sign(payload: string): string {
  return createHmac("sha256", secret()).update("exp:" + payload).digest("hex");
}
export function issueExpenseToken(): string {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}
export function verifyExpenseToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() < exp;
}
