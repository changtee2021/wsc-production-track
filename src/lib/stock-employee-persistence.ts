/** Shared employee selection for warehouse floor + stock count (same browser). */
export const STOCK_EMP_STORAGE_KEY = "wsc_stock_last_emp";

const LEGACY_WH_KEY = "ptrack_wh_emp";

export type StoredStockEmployee = {
  id: string;
  code: string;
  name: string;
};

function parseStored(raw: string): StoredStockEmployee | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const code = parsed.code ?? parsed.emp_code ?? "";
    const name = parsed.name ?? "";
    const id = parsed.id ?? "";
    if (!code || !name) return null;
    return { id, code, name };
  } catch {
    return null;
  }
}

/** Load persisted employee, migrating legacy keys if needed. */
export function loadStoredStockEmployee(): StoredStockEmployee | null {
  if (typeof window === "undefined") return null;

  const current = localStorage.getItem(STOCK_EMP_STORAGE_KEY);
  if (current) {
    const emp = parseStored(current);
    if (emp) return emp;
  }

  const legacyWh = localStorage.getItem(LEGACY_WH_KEY);
  if (legacyWh) {
    const emp = parseStored(legacyWh);
    if (emp) {
      saveStoredStockEmployee(emp);
      return emp;
    }
  }

  return null;
}

export function saveStoredStockEmployee(emp: StoredStockEmployee): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STOCK_EMP_STORAGE_KEY,
    JSON.stringify({ id: emp.id, code: emp.code, name: emp.name }),
  );
}
