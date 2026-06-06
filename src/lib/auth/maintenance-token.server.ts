// Maintenance session HMAC token — thin wrapper around the shared dept-token factory.
import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const maintenance = createDeptTokenVerifier({
  prefix: "maint:",
  secretEnv: ["ADMIN_PASSWORD", "MAINTENANCE_PASSWORD"],
  passwordEnv: "MAINTENANCE_PASSWORD",
  passwordTag: "ptrack-maint-pw",
  label: "Maintenance",
});

export const issueMaintenanceToken = maintenance.issue;
export const verifyMaintenanceToken = maintenance.verify;
export const checkMaintenancePassword = maintenance.checkPassword;
