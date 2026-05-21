// Server-only helpers for Packing session tokens (mirrors qc-token.server.ts).
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 1000 * 60 * 60 * 12; // 12h

function packingPassword(): string {
  const pw = process.env.PACKING_PASSWORD;
  if (!pw || pw.length < 6)
    throw new Error("PACKING_PASSWORD is not configured on the server");
  return pw;
}

function secret(): string {
  const s = process.env.ADMIN_PASSWORD || process.env.PACKING_PASSWORD;
  if (!s || s.length < 6)
    throw new Error("Packing signing secret is not configured on the server");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update("pack:" + payload).digest("hex");
}

export function issuePackingToken(): string {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyPackingToken(token: string | undefined | null): boolean {
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

export function checkPackingPassword(input: string): boolean {
  const a = createHmac("sha256", "ptrack-pack-pw").update(input).digest();
  const b = createHmac("sha256", "ptrack-pack-pw").update(packingPassword()).digest();
  return timingSafeEqual(a, b);
}
