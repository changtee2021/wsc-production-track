// Admin session HMAC token — thin wrapper around the shared dept-token factory.
import { createHmac, timingSafeEqual } from "crypto";
import { createDeptTokenVerifier } from "./dept-token.server";

const admin = createDeptTokenVerifier({
  prefix: "",
  secretEnv: ["ADMIN_PASSWORD"],
  ttlMs: 1000 * 60 * 60 * 8, // 8h
  label: "Admin",
});

export const issueAdminToken = admin.issue;
export const verifyAdminToken = admin.verify;

export function constantTimePasswordEquals(a: string, b: string): boolean {
  // Hash both sides so the comparison is over equal-length buffers,
  // eliminating any length side-channel.
  const ha = createHmac("sha256", "ptrack-pw-check").update(a).digest();
  const hb = createHmac("sha256", "ptrack-pw-check").update(b).digest();
  return timingSafeEqual(ha, hb);
}
