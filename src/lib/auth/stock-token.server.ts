// Stock-count session HMAC token — thin wrapper around the shared dept-token factory.
import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const stock = createDeptTokenVerifier({
  prefix: "stk:",
  secretEnv: ["ADMIN_PASSWORD", "PACKING_PASSWORD"],
  label: "Stock",
});

export const issueStockToken = stock.issue;
export const verifyStockToken = stock.verify;
