// WI reviewer session HMAC token — separate password from admin so the
// person approving/publishing a WI is not just anyone with the admin login.
import { createDeptTokenVerifier } from "@/lib/auth/dept-token.server";

const wiReview = createDeptTokenVerifier({
  prefix: "wi-review:",
  secretEnv: ["ADMIN_PASSWORD", "WI_REVIEWER_PASSWORD"],
  passwordEnv: "WI_REVIEWER_PASSWORD",
  passwordTag: "ptrack-wi-review-pw",
  label: "WI reviewer",
});

export const issueWiReviewToken = wiReview.issue;
export const verifyWiReviewToken = wiReview.verify;
export const checkWiReviewPassword = wiReview.checkPassword;
