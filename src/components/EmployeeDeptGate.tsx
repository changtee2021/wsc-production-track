import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type FloorDept, employeeCanAccessFloor } from "@/lib/auth/require-employee-dept";
import { isEmployeeSession } from "@/lib/auth/employee-session";

const DEPT_LABEL: Record<FloorDept, string> = {
  production: "ผลิต (สแกน)",
  qc: "QC",
  packing: "แพ็คของ",
  stock: "นับสต็อก",
  warehouse: "คลัง",
};

function GateShell({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      {children ?? (
        <Button asChild>
          <Link to="/">กลับหน้าแรก</Link>
        </Button>
      )}
    </div>
  );
}

/** Any logged-in employee (e.g. แจ้งซ่อม) — no department membership required. */
export function EmployeeSessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "deny">("checking");

  useEffect(() => {
    setState(isEmployeeSession() ? "ok" : "deny");
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "deny") {
    return (
      <GateShell
        title="กรุณาเข้าสู่ระบบพนักงานก่อน"
        detail="ล็อกอินที่หน้าแรกด้วยรหัสพนักงาน แล้วจึงเข้างานที่ได้รับมอบหมาย"
      />
    );
  }

  return <>{children}</>;
}

/**
 * Client gate: require employee floor login + matching department (office = all).
 */
export function EmployeeDeptGate({ dept, children }: { dept: FloorDept; children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "deny">("checking");

  useEffect(() => {
    setState(employeeCanAccessFloor(dept) ? "ok" : "deny");
  }, [dept]);

  if (state === "checking") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "deny") {
    const loggedIn = isEmployeeSession();
    return (
      <GateShell
        title={loggedIn ? "ไม่มีสิทธิ์เข้าหน้านี้" : "กรุณาเข้าสู่ระบบพนักงานก่อน"}
        detail={
          loggedIn
            ? `บัญชีของคุณไม่ได้ถูกกำหนดแผนก ${DEPT_LABEL[dept]}`
            : "ล็อกอินที่หน้าแรกด้วยรหัสพนักงาน แล้วจึงเข้างานที่ได้รับมอบหมาย"
        }
      />
    );
  }

  return <>{children}</>;
}
