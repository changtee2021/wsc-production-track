// Employee floor session: HMAC token with identity payload.
// Format: `${expMs}.${base64url(json({emp_code,name}))}.${hexHmac}`
import { createHmac, timingSafeEqual } from "crypto";
import { constantTimePasswordEquals } from "@/lib/auth/admin-token.server";

const TTL_MS = 1000 * 60 * 60 * 14; // 14h — full shift
const PREFIX = "emp:";

export type EmployeeTokenPayload = {
  emp_code: string;
  name: string;
};

function signingSecret(): string {
  const a = process.env.EMPLOYEE_DEFAULT_PASSWORD;
  if (a && a.length >= 6) return a;
  const b = process.env.ADMIN_PASSWORD;
  if (b && b.length >= 6) return b;
  return "000000";
}

export function expectedEmployeePassword(): string {
  const a = process.env.EMPLOYEE_DEFAULT_PASSWORD;
  if (a && a.length >= 6) return a;
  return "000000";
}

export function checkEmployeePassword(input: string): boolean {
  return constantTimePasswordEquals(input, expectedEmployeePassword());
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(PREFIX + payload).digest("hex");
}

export function issueEmployeeToken(identity: EmployeeTokenPayload): string {
  const exp = String(Date.now() + TTL_MS);
  const body = b64urlEncode(JSON.stringify({ emp_code: identity.emp_code, name: identity.name }));
  const mid = `${exp}.${body}`;
  return `${mid}.${sign(mid)}`;
}

export function verifyEmployeeToken(token: string | undefined | null): EmployeeTokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [expStr, body, sig] = parts;
  const mid = `${expStr}.${body}`;
  const expected = sign(mid);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() >= exp) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(body)) as EmployeeTokenPayload;
    if (!parsed?.emp_code || !parsed?.name) return null;
    return { emp_code: String(parsed.emp_code), name: String(parsed.name) };
  } catch {
    return null;
  }
}
