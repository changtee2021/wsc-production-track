// Packing session HMAC token — thin wrapper around the shared dept-token factory.
import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const packing = createDeptTokenVerifier({
  prefix: "pack:",
  secretEnv: ["ADMIN_PASSWORD", "PACKING_PASSWORD"],
  passwordEnv: "PACKING_PASSWORD",
  passwordTag: "ptrack-pack-pw",
  label: "Packing",
});

export const issuePackingToken = packing.issue;
export const verifyPackingToken = packing.verify;
export const checkPackingPassword = packing.checkPassword;
