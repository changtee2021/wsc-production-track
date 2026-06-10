import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_stock_token");

export const setStockToken = s.setToken;
export const getStockToken = s.getToken;
export const clearStockSession = s.clearSession;
export const isStockSession = s.isSession;
