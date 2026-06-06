import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_qc_token");

export const setQcToken = s.setToken;
export const getQcToken = s.getToken;
export const clearQcSession = s.clearSession;
export const isQcSession = s.isSession;
