// Admin sessionStorage helpers — thin wrapper around createDeptSession.
import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_admin_token");

export const setAdminToken = s.setToken;
export const getAdminToken = s.getToken;
export const clearAdminSession = s.clearSession;
export const isAdminSession = s.isSession;
