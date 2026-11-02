// WI reviewer sessionStorage helpers — thin wrapper around createDeptSession.
import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_wi_review_token");

export const setWiReviewToken = s.setToken;
export const getWiReviewToken = s.getToken;
export const clearWiReviewSession = s.clearSession;
export const isWiReviewSession = s.isSession;
