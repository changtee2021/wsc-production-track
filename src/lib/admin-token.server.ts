// Server-only helpers for issuing/verifying admin session tokens.
// Token format: `${expiresAtMs}.${hexSig}` where sig = HMAC-SHA256(payload, ADMIN_PASSWORD)
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 1000 * 60 * 60 * 8; // 8h

function secret(): string {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD not configured");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function issueAdminToken(): string {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
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

export function constantTimePasswordEquals(a: string, b: string): boolean {
  // Hash both sides so the comparison is over equal-length buffers,
  // eliminating any length side-channel.
  const ha = createHmac("sha256", "ptrack-pw-check").update(a).digest();
  const hb = createHmac("sha256", "ptrack-pw-check").update(b).digest();
  return timingSafeEqual(ha, hb);
}
