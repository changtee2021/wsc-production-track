// Provides a single dialog instance + hook used everywhere a staff name
// appears, so clicking a name opens a Popup instead of navigating away.
import { createContext, useContext, useState, type ReactNode } from "react";
import { EmployeeProfileDialog } from "./EmployeeProfileDialog";

type Target = { name: string; emp_code: string | null };
const Ctx = createContext<((t: Target) => void) | null>(null);

export function EmployeeProfileProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  return (
    <Ctx.Provider value={(t) => setTarget(t)}>
      {children}
      <EmployeeProfileDialog target={target} onClose={() => setTarget(null)} />
    </Ctx.Provider>
  );
}

export function useOpenEmployeeProfile() {
  const ctx = useContext(Ctx);
  return (
    ctx ??
    (() => {
      // No-op fallback if used outside the provider (shouldn't happen under _protected)
    })
  );
}
