import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_warehouse_token");

export const setWarehouseToken = s.setToken;
export const getWarehouseToken = s.getToken;
export const clearWarehouseSession = s.clearSession;
export const isWarehouseSession = s.isSession;
