// Expense scanner session HMAC token — thin wrapper around the dept-token factory.
import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const expense = createDeptTokenVerifier({
  prefix: "exp:",
  secretEnv: ["ADMIN_PASSWORD", "PACKING_PASSWORD"],
  label: "Expense",
});

export const issueExpenseToken = expense.issue;
export const verifyExpenseToken = expense.verify;
