// Factory for per-department HMAC session tokens (server-only).
// Token format: `${expiresAtMs}.${hexSig}` where sig = HMAC-SHA256(prefix+payload, secret)
// IMPORTANT: prefix + secret resolution preserves existing behavior so tokens
// already issued by *-token.server.ts files remain valid.
import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12; // 12h

export interface DeptTokenOptions {
  /** Token namespace prefix (e.g. "qc:", "pack:", "maint:"). Empty string for admin. */
  prefix: string;
  /** Env var names to try for HMAC secret, in order. First defined wins. */
  secretEnv: string[];
  /** TTL in ms. Defaults to 12h. */
  ttlMs?: number;
  /** Optional password env var for checkPassword(). */
  passwordEnv?: string;
  /** Tag used to namespace the password-comparison HMAC. */
  passwordTag?: string;
  /** Human label for error messages. */
  label: string;
}

export function createDeptTokenVerifier(opts: DeptTokenOptions) {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;

  function secret(): string {
    for (const name of opts.secretEnv) {
      const v = process.env[name];
      if (v && v.length >= 6) return v;
    }
    throw new Error(`${opts.label} signing secret is not configured on the server`);
  }

  function sign(payload: string): string {
    return createHmac("sha256", secret()).update(opts.prefix + payload).digest("hex");
  }

  function issue(): string {
    const exp = String(Date.now() + ttl);
    return `${exp}.${sign(exp)}`;
  }

  function verify(token: string | undefined | null): boolean {
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

  function checkPassword(input: string): boolean {
    if (!opts.passwordEnv || !opts.passwordTag) {
      throw new Error(`${opts.label} password check not configured`);
    }
    const pw = process.env[opts.passwordEnv];
    if (!pw || pw.length < 6) {
      throw new Error(`${opts.passwordEnv} is not configured on the server`);
    }
    const a = createHmac("sha256", opts.passwordTag).update(input).digest();
    const b = createHmac("sha256", opts.passwordTag).update(pw).digest();
    return timingSafeEqual(a, b);
  }

  return { issue, verify, checkPassword };
}
