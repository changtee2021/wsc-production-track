// Factory for per-department sessionStorage token helpers.
// All client-side dept sessions follow the exact same shape — this avoids
// repeating 20 lines per department.
export function createDeptSession(storageKey: string) {
  return {
    setToken(token: string) {
      if (typeof window === "undefined") return;
      sessionStorage.setItem(storageKey, token);
    },
    getToken(): string | null {
      if (typeof window === "undefined") return null;
      return sessionStorage.getItem(storageKey);
    },
    clearSession() {
      if (typeof window === "undefined") return;
      sessionStorage.removeItem(storageKey);
    },
    isSession(): boolean {
      if (typeof window === "undefined") return false;
      return !!sessionStorage.getItem(storageKey);
    },
  };
}
