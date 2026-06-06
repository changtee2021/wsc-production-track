import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_packing_token");

export const setPackingToken = s.setToken;
export const getPackingToken = s.getToken;
export const clearPackingSession = s.clearSession;
export const isPackingSession = s.isSession;
