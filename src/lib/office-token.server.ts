// Office Supplies session HMAC token — thin wrapper around the dept-token factory.
import { createDeptTokenVerifier } from "./dept-token.server";

const office = createDeptTokenVerifier({
  prefix: "off:",
  secretEnv: ["ADMIN_PASSWORD", "PACKING_PASSWORD"],
  label: "Office",
});

export const issueOfficeToken = office.issue;
export const verifyOfficeToken = office.verify;
