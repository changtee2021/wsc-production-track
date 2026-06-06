import { createDeptSession } from "./dept-session";

const s = createDeptSession("ptrack_expense_token");

export const setExpenseToken = s.setToken;
export const getExpenseToken = s.getToken;
export const clearExpenseSession = s.clearSession;
export const isExpenseSession = s.isSession;
