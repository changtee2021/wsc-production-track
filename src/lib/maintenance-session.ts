import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_maintenance_token");

export const setMaintenanceToken = s.setToken;
export const getMaintenanceToken = s.getToken;
export const clearMaintenanceSession = s.clearSession;
export const isMaintenanceSession = s.isSession;
