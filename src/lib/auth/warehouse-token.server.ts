import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const warehouse = createDeptTokenVerifier({
  prefix: "wh:",
  secretEnv: ["ADMIN_PASSWORD", "PACKING_PASSWORD"],
  label: "Warehouse",
});

export const issueWarehouseToken = warehouse.issue;
export const verifyWarehouseToken = warehouse.verify;
