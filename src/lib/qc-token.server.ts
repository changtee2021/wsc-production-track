// Server-only helpers for QC session tokens.
// Token format: `${expiresAtMs}.${hexSig}` where sig = HMAC-SHA256(payload, secret)
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 1000 * 60 * 60 * 12; // 12h
const DEFAULT_QC_PASSWORD = "wscqc123";

function qcPassword(): string {
  return process.env.QC_PASSWORD || DEFAULT_QC_PASSWORD;
}

function secret(): string {
  // Use admin password as HMAC secret if available; fall back to QC password
  return process.env.ADMIN_PASSWORD || qcPassword();
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update("qc:" + payload).digest("hex");
}

export function issueQcToken(): string {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyQcToken(token: string | undefined | null): boolean {
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

export function checkQcPassword(input: string): boolean {
  const a = createHmac("sha256", "ptrack-qc-pw").update(input).digest();
  const b = createHmac("sha256", "ptrack-qc-pw").update(qcPassword()).digest();
  return timingSafeEqual(a, b);
}
