// QC session HMAC token — thin wrapper around the shared dept-token factory.
import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const qc = createDeptTokenVerifier({
  prefix: "qc:",
  secretEnv: ["ADMIN_PASSWORD", "QC_PASSWORD"],
  passwordEnv: "QC_PASSWORD",
  passwordTag: "ptrack-qc-pw",
  label: "QC",
});

export const issueQcToken = qc.issue;
export const verifyQcToken = qc.verify;
export const checkQcPassword = qc.checkPassword;
