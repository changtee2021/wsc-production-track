import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_office_token");

export const setOfficeToken = s.setToken;
export const getOfficeToken = s.getToken;
export const clearOfficeSession = s.clearSession;
export const isOfficeSession = s.isSession;
